#!/usr/bin/env python3
"""EchoField node loop (aggregate computing part).

Every node runs this same program. It only talks to the neighbours listed in
the NEIGHBORS environment variable (simulated topology, see README), and
computes by itself:
  - dist:  hops from the nearest hazard (gradient), 0 = I am the hazard, 99 = unknown
  - alert: consensus alarm with hysteresis (needs agreeing neighbours)
  - escape_to: alive neighbour that is furthest from the hazard (optional, task 7)

No server, no cloud: the dashboard is only a passive listener.

Run (two boards / two laptops on the same Wi-Fi, broadcast):
    NODE_ID=1 NEIGHBORS=2 python3 node.py
    NODE_ID=2 NEIGHBORS=1 python3 node.py

Run (several nodes on ONE laptop, unicast on 127.0.0.1, port 5000+id):
    MODE=unicast NODE_ID=1 NEIGHBORS=2 python3 node.py
    MODE=unicast NODE_ID=2 NEIGHBORS=1,3 python3 node.py

Type `a` + Enter to toggle the fake anomaly, a number (0..1) to set it,
`q` + Enter to quit.
"""

import json
import os
import socket
import sys
import threading
import time

# ---------------------------------------------------------------- config ----

def _env_ids(name, default=""):
    """Parse a comma list of node ids, tolerating spaces and empty values."""
    raw = os.environ.get(name, default)
    return set(int(x) for x in raw.replace(" ", "").split(",") if x)

NODE_ID   = int(os.environ.get("NODE_ID", 1))
NEIGHBORS = _env_ids("NEIGHBORS", "2")
MODE      = os.environ.get("MODE", "broadcast").lower()   # broadcast | unicast
BROADCAST = os.environ.get("BROADCAST", "255.255.255.255")
UNI_HOST  = os.environ.get("UNICAST_HOST", "127.0.0.1")

# In unicast mode each node owns its own port (5000+id) so that N nodes can run
# on one laptop; in broadcast mode every node shares port 5005.
PORT      = int(os.environ.get("PORT", 5000 + NODE_ID if MODE == "unicast" else 5005))

TIMEOUT     = float(os.environ.get("TIMEOUT", 4))        # a neighbour is alive if heard within this
HEARTBEAT   = float(os.environ.get("HEARTBEAT", 1))      # seconds between messages
PARAM_EVERY = float(os.environ.get("PARAM_EVERY", 15))   # seconds between model merges (task 6)
ALERT_ON    = float(os.environ.get("ALERT_ON", 0.7))
ALERT_OFF   = float(os.environ.get("ALERT_OFF", 0.4))
AGREE_MIN   = int(os.environ.get("AGREE_MIN", 1))        # agreeing neighbours needed for the alert
UNKNOWN     = 99                                         # "I don't know where the hazard is"

# --------------------------------------------------------- shared state ----

state  = {"anomaly": 0.0, "dist": UNKNOWN, "alert": False, "escape_to": None}
params = {"mu": 0.0, "sigma": 1.0, "n": 0}    # overwritten by Chuqi's get_params()
table  = {}                                   # neighbour id -> (message, last_seen)
lock   = threading.Lock()                     # protects state, params and table
fake   = {"anomaly": float(os.environ.get("ANOMALY", 0.0))}   # keyboard-driven test value
running = threading.Event()
running.set()

# ----------------------------------------------------------- model hook ----
# Chuqi's module (sensing_ml/model.py). Until it exists we run on the fake anomaly.
# The node must never crash because the model is missing or raises.
anomaly_score = get_params = merge_params = read_sensor = None
try:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from sensing_ml.model import anomaly_score, get_params, merge_params  # noqa: F401
    try:
        from sensing_ml.model import read_sensor  # only if Chuqi exposes the sensor read too
    except ImportError:
        read_sensor = None
except ImportError:
    pass

def get_anomaly():
    """The ONE place where the anomaly comes from (task 2).

    Today: fake value from the keyboard. When Chuqi's module is ready and also
    exposes read_sensor(), this automatically becomes anomaly_score(read_sensor()).
    """
    if anomaly_score is not None and read_sensor is not None:
        try:
            return max(0.0, min(1.0, float(anomaly_score(read_sensor()))))
        except Exception as e:                      # model problems must not stop the node
            print("model error, falling back to fake anomaly:", e)
    return fake["anomaly"]

def local_params():
    """Model parameters to put in the heartbeat."""
    if get_params is not None:
        try:
            p = get_params()
            return {"mu": float(p["mu"]), "sigma": float(p["sigma"]), "n": int(p["n"])}
        except Exception:
            pass
    return dict(params)

# -------------------------------------------------------------- network ----

def destinations():
    """Where a heartbeat goes: one broadcast address, or each neighbour's port."""
    if MODE == "unicast":
        return [(UNI_HOST, 5000 + nid) for nid in sorted(NEIGHBORS)]
    return [(BROADCAST, PORT)]

def send_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    while running.is_set():
        with lock:
            params.update(local_params())
            msg = {"id": NODE_ID, **state, **params, "ts": time.time()}
        data = json.dumps(msg).encode()
        for dest in destinations():
            try:
                s.sendto(data, dest)
            except OSError as e:                    # e.g. Wi-Fi down: keep the node alive
                print("send failed to", dest, ":", e)
        time.sleep(HEARTBEAT)

def recv_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("", PORT))
    while running.is_set():
        try:
            data, _ = s.recvfrom(2048)
            m = json.loads(data)
        except (ValueError, OSError):               # invalid JSON or socket hiccup
            continue
        mid = m.get("id")
        if not isinstance(mid, int) or mid == NODE_ID or mid not in NEIGHBORS:
            continue                                # ignore myself, strangers, junk
        with lock:
            table[mid] = (m, time.time())

# -------------------------------------------------------- aggregate core ----

def alive_locked():
    """Neighbour messages heard recently; drops the ones that timed out.
    Caller must already hold the lock."""
    now = time.time()
    for nid in [nid for nid, (_, t) in table.items() if now - t >= TIMEOUT]:
        del table[nid]                              # a dead neighbour leaves the table
    return [m for m, _ in table.values()]

def update():
    """One round of the aggregate computation: gradient + consensus + escape."""
    with lock:
        nb = alive_locked()
        # --- gradient: 0 at the hazard, otherwise min(neighbours) + 1 ---
        if state["anomaly"] > ALERT_ON:
            state["dist"] = 0
        else:
            best = min((int(m.get("dist", UNKNOWN)) for m in nb), default=UNKNOWN - 1)
            state["dist"] = min(best + 1, UNKNOWN)
        # --- consensus alert with hysteresis: no flicker, no lone noisy node ---
        agreeing = sum(1 for m in nb if float(m.get("anomaly", 0.0)) > ALERT_ON)
        if state["anomaly"] > ALERT_ON and agreeing >= AGREE_MIN:
            state["alert"] = True
        elif state["anomaly"] < ALERT_OFF and agreeing == 0:
            state["alert"] = False
        # --- escape direction: the alive neighbour furthest from the hazard ---
        if nb:
            far = max(nb, key=lambda m: int(m.get("dist", UNKNOWN)))
            state["escape_to"] = far["id"] if int(far.get("dist", UNKNOWN)) > state["dist"] else None
        else:
            state["escape_to"] = None

def param_loop():
    """Merge neighbour model parameters every PARAM_EVERY seconds (task 6).

    Runs in its own thread so the 1 s heartbeat is never delayed by the merge.
    """
    while running.is_set():
        time.sleep(PARAM_EVERY)
        if merge_params is None:
            continue
        with lock:
            others = [{"mu": m["mu"], "sigma": m["sigma"], "n": m["n"]}
                      for m in alive_locked()
                      if all(k in m for k in ("mu", "sigma", "n"))]
        if not others:
            continue
        try:
            merge_params(others)                    # called outside the lock: may be slow
            print("merged params from", len(others), "neighbours")
        except Exception as e:
            print("merge_params failed:", e)

# ------------------------------------------------------------------- CLI ----

def key_loop():
    """`a` toggles the fake anomaly, a number sets it, `q` quits."""
    for line in sys.stdin:                          # ends quietly when stdin is closed
        cmd = line.strip().lower()
        if cmd == "a":
            fake["anomaly"] = 0.0 if fake["anomaly"] > ALERT_ON else 1.0
            print("fake anomaly ->", fake["anomaly"])
        elif cmd in ("q", "quit", "exit"):
            running.clear()
            return
        else:
            try:
                fake["anomaly"] = max(0.0, min(1.0, float(cmd)))
                print("fake anomaly ->", fake["anomaly"])
            except ValueError:
                print("commands: a = toggle anomaly, 0..1 = set anomaly, q = quit")

def status_line(t0):
    with lock:
        nb = sorted(table.items())
        own = dict(state)
        now = time.time()
        seen = [(nid, m, now - t) for nid, (m, t) in nb]
    parts = ["%-3d d=%-2s a=%.2f age=%.1fs%s" %
             (nid, m.get("dist", "?"), float(m.get("anomaly", 0)), age,
              " ALERT" if m.get("alert") else "")
             for nid, m, age in seen]
    return "[%6.1fs] id=%d anom=%.2f dist=%-2d alert=%-3s esc=%-4s | %s" % (
        time.time() - t0, NODE_ID, own["anomaly"], own["dist"],
        "ON" if own["alert"] else "off", own["escape_to"],
        "  ".join(parts) if parts else "(no alive neighbour)")

if __name__ == "__main__":
    print("node %d  mode=%s port=%d neighbours=%s  model=%s"
          % (NODE_ID, MODE, PORT, sorted(NEIGHBORS),
             "Chuqi's" if anomaly_score else "fake anomaly"))
    for fn in (send_loop, recv_loop, param_loop, key_loop):
        threading.Thread(target=fn, daemon=True).start()
    t0 = time.time()
    last_print = 0.0
    while running.is_set():
        with lock:
            state["anomaly"] = get_anomaly()
        update()
        if time.time() - last_print >= 1.0:         # status once per second
            print(status_line(t0), flush=True)
            last_print = time.time()
        time.sleep(0.5)
