#!/usr/bin/env python3
"""Gaia node loop (aggregate computing part).

Every node runs this same program. It only talks to the neighbours listed in
the NEIGHBORS environment variable (simulated topology, see README), and
computes by itself:
  - dist:  hops from the nearest hazard (gradient), 0 = I am the hazard, 99 = unknown
  - alert: consensus alarm with hysteresis (needs agreeing neighbours)
  - escape_to: alive neighbour that is furthest from the hazard (optional, task 7)
It also forwards, for the dashboard and Gemma's report only (the node itself
never decides on them): `temperature` / `humidity` (the raw reading) and
Chuqi's `bytes_sent` / `bytes_if_raw_data` green-AI counters. Field names are
the ones Pietro's gateway validates.

The model parameters (`mu`, `sigma`, `n`) ride in one heartbeat out of
PARAM_EVERY and are absent from the others: that is what federated learning
actually costs. Whoever reads the messages keeps the last value it saw.

No server, no cloud: the dashboard is only a passive listener.

Run (two boards / two laptops on the same Wi-Fi, broadcast):
    NODE_ID=1 NEIGHBORS=2 python3 node.py
    NODE_ID=2 NEIGHBORS=1 python3 node.py

Run (three boards whose access point blocks broadcast, explicit addresses):
    NODE_ID=1 NEIGHBORS=2 PEERS=2=192.168.1.12 python3 node.py
    NODE_ID=2 NEIGHBORS=1,3 PEERS=1=192.168.1.11,3=192.168.1.13 python3 node.py

Run (several nodes on ONE laptop, unicast on 127.0.0.1, port 5000+id):
    MODE=unicast NODE_ID=1 NEIGHBORS=2 python3 node.py
    MODE=unicast NODE_ID=2 NEIGHBORS=1,3 python3 node.py

Type `a` + Enter to toggle the fake anomaly, a number (0..1) to set it,
`q` + Enter to quit. Without a sensor, `temperature` / `humidity` carry
plausible values derived from the fake anomaly, flagged `"simulated": true`;
FAKE_SENSOR=0 sends `null` instead.

Chuqi's model has no read_sensor() yet, so the keyboard still drives the
anomaly. ANOMALY_SRC=model runs her real anomaly_score() on those fake
readings: it tests the whole chain without hardware.
"""

import ipaddress
import json
import os
import socket
import subprocess
import sys
import threading
import time

# ---------------------------------------------------------------- config ----

def _env_ids(name, default=""):
    """Parse a comma list of node ids, tolerating spaces and empty values."""
    raw = os.environ.get(name, default)
    return set(int(x) for x in raw.replace(" ", "").split(",") if x)

def _env_peers(name):
    """`PEERS=1=192.168.1.11,3=192.168.1.13`: one address per neighbour, used
    instead of broadcast. Needed when the access point isolates its clients,
    which most phone hotspots and guest networks do."""
    out = {}
    for part in os.environ.get(name, "").replace(" ", "").split(","):
        if "=" in part:
            nid, host = part.split("=", 1)
            out[int(nid)] = host
    return out

NODE_ID   = int(os.environ.get("NODE_ID", 1))
NEIGHBORS = _env_ids("NEIGHBORS", "2")
MODE      = os.environ.get("MODE", "broadcast").lower()   # broadcast | unicast
BROADCAST = os.environ.get("BROADCAST", "255.255.255.255")
UNI_HOST  = os.environ.get("UNICAST_HOST", "127.0.0.1")
PEERS     = _env_peers("PEERS")                           # {neighbour id: address}

# In unicast mode each node owns its own port (5000+id) so that N nodes can run
# on one laptop; in broadcast mode every node shares port 5005.
PORT      = int(os.environ.get("PORT", 5000 + NODE_ID if MODE == "unicast" else 5005))

TIMEOUT     = float(os.environ.get("TIMEOUT", 4))        # a neighbour is alive if heard within this
HEARTBEAT   = float(os.environ.get("HEARTBEAT", 1))      # seconds between messages
PARAM_EVERY = float(os.environ.get("PARAM_EVERY", 15))   # seconds between model merges (task 6)
ALERT_ON    = float(os.environ.get("ALERT_ON", 0.7))
ALERT_OFF   = float(os.environ.get("ALERT_OFF", 0.4))
AGREE_MIN   = int(os.environ.get("AGREE_MIN", 1))        # agreeing neighbours needed for the alert
FAKE_SENSOR = os.environ.get("FAKE_SENSOR", "1").lower() not in ("0", "false", "no")
ANOMALY_SRC = os.environ.get("ANOMALY_SRC", "auto").lower()   # auto | model | fake
UNKNOWN     = 99                                         # "I don't know where the hazard is"

# --------------------------------------------------------- shared state ----

state  = {"anomaly": 0.0, "dist": UNKNOWN, "via": None, "alert": False, "escape_to": None}
params = {"mu": 0.0, "sigma": 1.0, "n": 0}    # overwritten by Chuqi's get_params()
table  = {}                                   # neighbour id -> (message, last_seen)
drops  = {}                                   # id -> messages heard but not in NEIGHBORS
peers  = {}                                   # id -> last {mu, sigma, n} seen from it
lock   = threading.Lock()                     # protects state, params and table
fake   = {"anomaly": float(os.environ.get("ANOMALY", 0.0))}   # keyboard-driven test value
sensor = {"last": None}                       # last raw reading, sent for the dashboard
running = threading.Event()
running.set()

# ----------------------------------------------------------- model hook ----
# Chuqi's module (sensing_ml/model.py). Until it exists we run on the fake anomaly.
# The node must never crash because the model is missing or raises.
anomaly_score = get_params = merge_params = read_sensor = bytes_report = None
try:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from sensing_ml.model import anomaly_score, get_params, merge_params  # noqa: F401
    try:
        from sensing_ml.model import read_sensor  # only if Chuqi exposes the sensor read too
    except ImportError:
        read_sensor = None
    try:
        from sensing_ml.model import bytes_report  # green-AI counters, for Pietro's panel
    except ImportError:
        bytes_report = None
except ImportError:
    pass

def clean_reading(d):
    """Keep only the numeric values of a reading, as plain floats.

    Whatever read_sensor() returns ends up in json.dumps() inside the send
    loop: a numpy float or a stray object would raise there and kill the
    heartbeat thread without a word.
    """
    if not isinstance(d, dict):
        return None
    out = {}
    for k, v in list(d.items())[:8]:                # a heartbeat is not a log file
        if k == "fake":                             # a flag, not a measurement
            out["fake"] = bool(v)
            continue
        try:
            out[str(k)] = round(float(v), 2)
        except (TypeError, ValueError):
            continue
    return out or None

def fake_reading(a):
    """Plausible temp/hum from the fake anomaly, so the dashboard panel can be
    built before the Modulino is wired. Flagged, so nobody reads it as real."""
    return {"temp": round(20.0 + 30.0 * a, 1),
            "hum": round(45.0 - 25.0 * a, 1), "fake": True}

def anomaly_source():
    """What actually drives the anomaly right now, for the startup line."""
    if anomaly_score is None:
        return "keyboard (no model)"
    if ANOMALY_SRC == "model":
        return "Chuqi's model on fake readings"
    if ANOMALY_SRC == "auto" and read_sensor is not None:
        return "Chuqi's model on the sensor"
    if ANOMALY_SRC == "auto":
        return "keyboard (model found, no read_sensor)"
    return "keyboard"

def reading_fields(r):
    """The last reading as the dashboard expects it: flat `temperature` and
    `humidity`, both `null` when there is no sensor, plus `simulated` to say
    the values were derived from the fake anomaly instead of measured."""
    r = r or {}
    return {"temperature": r.get("temp"), "humidity": r.get("hum"),
            "simulated": bool(r.get("fake"))}

def byte_counters():
    """Chuqi's green-AI counters, forwarded in the heartbeat: the dashboard is
    a passive listener, so this is its only way to see them. Absent (not zero)
    when the model is not there, so the panel can say "awaiting counters"."""
    if bytes_report is None:
        return {}
    try:
        b = bytes_report()
        if int(b["bytes_if_raw_data"]) <= 0:        # the model is loaded but not
            return {}                               # scoring (no read_sensor yet):
                                                    # sending only bytes_sent would
                                                    # mean a negative saving
        return {"bytes_sent": int(b["bytes_sent"]),
                "bytes_if_raw_data": int(b["bytes_if_raw_data"])}
    except Exception:                               # never break the heartbeat
        return {}

def get_anomaly():
    """The ONE place where the anomaly comes from (task 2).

    It also stores the raw reading in sensor["last"]: the node itself only ever
    looks at the score, the dashboard and Gemma's report need the degrees.

    Sources, chosen by ANOMALY_SRC:
      auto   (default) Chuqi's model if it can read the sensor itself, else the
             keyboard value. Her model has no read_sensor() yet, so: keyboard.
      model  her anomaly_score() on fake readings, to test the whole chain with
             no hardware. Careful in a demo: a jump of degrees is a jump of
             score, so the keyboard knob becomes coarse (anything = alarm).
      fake   the keyboard value, even when the model is importable.
    """
    use_model = anomaly_score is not None and (
        ANOMALY_SRC == "model" or (ANOMALY_SRC == "auto" and read_sensor is not None))
    if use_model:
        try:
            reading = read_sensor() if read_sensor else fake_reading(fake["anomaly"])
            a = max(0.0, min(1.0, float(anomaly_score(reading))))
            sensor["last"] = clean_reading(reading)
            return a
        except Exception as e:                      # model problems must not stop the node
            print("model error, falling back to fake anomaly:", e)
    a = fake["anomaly"]
    sensor["last"] = fake_reading(a) if FAKE_SENSOR else None
    return a

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

def local_ip():
    """The address of the interface that reaches the network, or None."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))              # picks the route, sends nothing
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()

_bcast = None                                   # broadcast_addrs() cache

def iface_networks():
    """Every non-loopback IPv4 address of this machine, with its real netmask,
    read from `ip -o -4 addr`. Empty when there is no `ip` command (Windows).

    The netmask has to be read, not guessed: the Junction Wi-Fi is a /20
    (10.0.32.0/20), where 10.0.38.255 is not a broadcast address but just
    another host, so a packet sent there reaches nobody.
    """
    try:
        out = subprocess.run(["ip", "-o", "-4", "addr"], capture_output=True,
                             text=True, timeout=2).stdout
    except (OSError, ValueError, subprocess.SubprocessError):
        return []
    found = []
    for line in out.splitlines():
        for token in line.split():
            if "/" in token and token[0].isdigit():
                try:
                    itf = ipaddress.ip_interface(token)
                except ValueError:
                    break
                if itf.version == 4 and not itf.ip.is_loopback:
                    found.append(itf)
                break
    return found

def broadcast_addrs():
    """255.255.255.255 plus the subnet broadcast of EVERY local interface.

    One address is not enough. Both Windows and Linux send the limited
    broadcast out of a single interface, the one with the best route, and that
    is not necessarily the Wi-Fi: measured on the demo laptop, 255.255.255.255
    left through the VirtualBox adapter while only the subnet-directed address
    reached the Wi-Fi. A board with its USB link up behaves the same way, which
    is how three boards on the same Wi-Fi end up hearing nothing.

    So we send one copy per interface. A neighbour reachable twice receives two
    identical heartbeats per second, which is harmless (the neighbour table just
    overwrites), and the dashboard de-duplicates by node id anyway.

    BROADCAST=<addr> overrides all of it and sends to that one address only;
    PEERS bypasses broadcast entirely.
    """
    global _bcast
    if _bcast is not None:                          # computed once: `ip` is not
        return _bcast                               # worth a subprocess per
    if "BROADCAST" in os.environ:                   # second, and the warning is
        _bcast = [os.environ["BROADCAST"]]          # not worth repeating
        return _bcast
    addrs = ["255.255.255.255"]
    for itf in iface_networks():
        b = str(itf.network.broadcast_address)
        if b not in addrs:
            addrs.append(b)
    if len(addrs) == 1:                             # no `ip` command: one guess
        ip = local_ip()
        if ip and not ip.startswith("127.") and ip.count(".") == 3:
            print("warning: cannot read the netmasks, assuming /24 for %s. On a "
                  "wider network (a /20 conference Wi-Fi, say) that address "
                  "belongs to nobody: set BROADCAST=<x.y.z.255> or use PEERS."
                  % ip, flush=True)
            addrs.append(ip.rsplit(".", 1)[0] + ".255")
    _bcast = addrs
    return _bcast

BCAST = broadcast_addrs()

def destinations():
    """Where a heartbeat goes: explicit peers, each neighbour's port, or broadcast."""
    if PEERS:
        return [(host, PORT) for nid, host in sorted(PEERS.items()) if nid in NEIGHBORS]
    if MODE == "unicast":
        return [(UNI_HOST, 5000 + nid) for nid in sorted(NEIGHBORS)]
    return [(addr, PORT) for addr in BCAST]

def send_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    next_params = 0.0                               # the first heartbeat carries them
    while running.is_set():
        now = time.time()
        with lock:
            msg = {"id": NODE_ID, **state,
                   **reading_fields(sensor["last"]), **byte_counters(),
                   "ts": now}
            if now >= next_params:
                # Chuqi's decision (14/11): the parameters go out once every
                # PARAM_EVERY seconds instead of in every heartbeat. Her
                # bytes_sent counter is incremented inside get_params(), so
                # calling it only here makes the green-AI figure measure what we
                # really spend on learning, instead of fifteen copies the
                # dashboard did not need. Readers keep the last value they saw.
                params.update(local_params())
                msg.update(params)
                next_params = now + PARAM_EVERY
        data = json.dumps(msg).encode()
        for dest in destinations():
            try:
                s.sendto(data, dest)
            except OSError as e:                    # e.g. Wi-Fi down: keep the node alive
                print("send failed to", dest, ":", e)
        time.sleep(HEARTBEAT)

def recv_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    if MODE != "unicast":
        # On one machine several programs may listen to the broadcast port
        # (a node and Pietro's dashboard), so sharing it is allowed there.
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("", PORT))
    except OSError as e:
        # Without this check two nodes with the same id share the port and
        # each receives only part of the messages: very hard to debug.
        print("cannot listen on port %d: %s" % (PORT, e), flush=True)
        print("is another node with NODE_ID=%d already running?" % NODE_ID, flush=True)
        os._exit(1)                                 # kills the whole node, not just this thread
    while running.is_set():
        try:
            data, _ = s.recvfrom(2048)
            m = json.loads(data)
        except (ValueError, OSError):               # invalid JSON or socket hiccup
            continue
        mid = m.get("id")
        if not isinstance(mid, int) or mid == NODE_ID:
            continue                                # ignore myself and junk
        if mid not in NEIGHBORS:
            # Heard, but not in my NEIGHBORS: on real boards this is the usual
            # reason why "the others do not see the alarm". Counted and shown in
            # the status line instead of being dropped in silence.
            with lock:
                drops[mid] = drops.get(mid, 0) + 1
            continue
        with lock:
            table[mid] = (m, time.time())
            try:
                # Only one heartbeat in PARAM_EVERY carries these, so they are
                # kept aside: the last message alone is not enough to merge.
                peers[mid] = {"mu": float(m["mu"]), "sigma": float(m["sigma"]),
                              "n": int(m["n"])}
            except (KeyError, TypeError, ValueError):
                pass                                # no parameters this time

# -------------------------------------------------------- aggregate core ----

def alive_locked():
    """Neighbour messages heard recently; drops the ones that timed out.
    Caller must already hold the lock."""
    now = time.time()
    for nid in [nid for nid, (_, t) in table.items() if now - t >= TIMEOUT]:
        del table[nid]                              # a dead neighbour leaves the table
        peers.pop(nid, None)                        # and takes its parameters with it
    return [m for m, _ in table.values()]

def update():
    """One round of the aggregate computation: gradient + consensus + escape."""
    with lock:
        nb = alive_locked()
        # --- gradient: 0 at the hazard, otherwise min(neighbours) + 1 ---
        if state["anomaly"] > ALERT_ON:
            state["dist"], state["via"] = 0, None       # I am the hazard
        else:
            # Only trust a neighbour whose own distance does NOT come from me:
            # otherwise two nodes keep adding 1 to each other for ever
            # (count to infinity: 2, 4, 6 ... 99). A neighbour at UNKNOWN has
            # nothing to offer either.
            offers = [m for m in nb
                      if m.get("via") != NODE_ID and int(m.get("dist", UNKNOWN)) < UNKNOWN]
            if offers:
                best = min(offers, key=lambda m: int(m["dist"]))
                state["dist"] = min(int(best["dist"]) + 1, UNKNOWN)
                state["via"] = best["id"]
            else:
                state["dist"], state["via"] = UNKNOWN, None
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
            alive = set()
            for m in alive_locked():
                if isinstance(m.get("id"), int):
                    alive.add(m["id"])
            others = [p for nid, p in peers.items() if nid in alive]
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

def temp_of(m):
    """` t=23.1` when the message carries a temperature, nothing otherwise."""
    t = m.get("temperature")
    return " t=%.1f" % t if isinstance(t, (int, float)) else ""

def status_line(t0):
    with lock:
        nb = sorted(table.items())
        own = dict(state)
        own["temperature"] = (sensor["last"] or {}).get("temp")
        now = time.time()
        seen = [(nid, m, now - t) for nid, (m, t) in nb]
        ignored = dict(sorted(drops.items()))
    parts = ["%-3d d=%-2s a=%.2f%s age=%.1fs%s" %
             (nid, m.get("dist", "?"), float(m.get("anomaly", 0)), temp_of(m), age,
              " ALERT" if m.get("alert") else "")
             for nid, m, age in seen]
    line = "[%6.1fs] id=%d anom=%.2f%s dist=%-2d via=%-4s alert=%-3s esc=%-4s | %s" % (
        time.time() - t0, NODE_ID, own["anomaly"], temp_of(own), own["dist"], own["via"],
        "ON" if own["alert"] else "off", own["escape_to"],
        "  ".join(parts) if parts else "(no alive neighbour)")
    if ignored:
        # e.g. ignored:{2: 37} -> node 2 is on the air and I am throwing it away
        line += "  ignored:%s" % ignored
    return line

def main(sensor=None, score=None):
    """Run the node; blocks until `q` on stdin or running.clear().

    The App Lab app on the board calls it with its own functions:

        import node                                  # aggregate/node.py
        node.main(sensor=read_sensor, score=anomaly_score)

    because on the board the Modulino is only reachable through the App Lab
    Bridge, which sensing_ml/model.py cannot import. If App Lab's user_loop owns
    the main thread, start this in a thread instead:

        threading.Thread(target=node.main,
                         kwargs={"sensor": read_sensor,
                                 "score": anomaly_score}, daemon=True).start()
    """
    global read_sensor, anomaly_score
    if sensor is not None:
        read_sensor = sensor
    if score is not None:
        anomaly_score = score
    print("node %d  mode=%s port=%d neighbours=%s  anomaly=%s  sensor=%s"
          % (NODE_ID, MODE, PORT, sorted(NEIGHBORS), anomaly_source(),
             "real" if read_sensor else ("fake" if FAKE_SENSOR else "off")), flush=True)
    print("my address %s, sending to %s"
          % (local_ip() or "unknown", ", ".join("%s:%d" % d for d in destinations())),
          flush=True)
    state["anomaly"] = get_anomaly()                # the first heartbeat already
                                                    # carries anomaly and sensor
    for fn in (send_loop, recv_loop, param_loop, key_loop):
        threading.Thread(target=fn, daemon=True).start()
    t0 = time.time()
    last_print = 0.0
    while running.is_set():
        # Read OUTSIDE the lock. On the board read_sensor() goes through the App
        # Lab Bridge over I2C: if that call hangs, holding the lock here would
        # block send_loop too and the node would vanish from the network while
        # still running. A stale anomaly for one round is survivable, silence is
        # not.
        a = get_anomaly()
        with lock:
            state["anomaly"] = a
        update()
        if time.time() - last_print >= 1.0:         # status once per second
            print(status_line(t0), flush=True)
            last_print = time.time()
        time.sleep(0.5)

if __name__ == "__main__":
    main()
