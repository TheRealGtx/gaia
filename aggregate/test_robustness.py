"""P0.1 and P0.3 from docs/IMPLEMENTATION_GAP_ANALYSIS.md, against a real node.

    python3 aggregate/test_robustness.py

Node 2 runs for real, in unicast on 127.0.0.1 (safe with the boards on the
air). This script plays its neighbours 1 and 3, and a hostile device on the
same network:

- a neighbour at dist 99 is never chosen as the way out (escape_to);
- 10 000 malformed packets (lists, strings, NaN, huge or negative numbers,
  nested objects, invalid UTF-8, truncated JSON, some with a real neighbour's
  id) do not stop the node, do not replace a neighbour's last valid state, and
  are counted in the status line.
"""
import json
import os
import random
import socket
import subprocess
import sys
import threading
import time

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))
NODE = os.path.join(REPO, "aggregate", "node.py")
N2 = ("127.0.0.1", 5202)                  # node 2's port in unicast (5200 + id)
seen = []
stop = threading.Event()


def listen():
    """Node 2 sends to its neighbours 1 and 3: be node 3 and read what it says."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("127.0.0.1", 5203))
    s.settimeout(0.3)
    while not stop.is_set():
        try:
            seen.append(json.loads(s.recvfrom(4096)[0]))
        except Exception:
            pass


def send(sock, obj):
    sock.sendto(obj if isinstance(obj, bytes) else json.dumps(obj).encode(), N2)


def neighbour(nid, dist, anomaly=0.0, via=None):
    return {"id": nid, "anomaly": anomaly, "dist": dist, "via": via,
            "alert": False, "escape_to": None, "ts": time.time()}


def latest():
    return seen[-1] if seen else {}


threading.Thread(target=listen, daemon=True).start()
env = dict(os.environ, MODE="unicast", NODE_ID="2", NEIGHBORS="1,3",
           PYTHONUNBUFFERED="1", FAKE_SENSOR="0")
proc = subprocess.Popen([sys.executable, NODE], env=env, cwd=REPO,
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT, text=True, bufsize=1)
tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
failures = []


def check(ok, msg):
    print("   %s %s" % ("OK  " if ok else "FAIL", msg), flush=True)
    if not ok:
        failures.append(msg)


def feed(seconds, n1, n3):
    """Neighbours 1 and 3 send their heartbeat a few times a second."""
    end = time.time() + seconds
    while time.time() < end:
        send(tx, n1)
        send(tx, n3)
        time.sleep(0.25)


try:
    time.sleep(1.0)
    print("== P0.1: a neighbour at 99 is not a way out ==")
    feed(3, neighbour(1, 0, anomaly=1.0), neighbour(3, 99))
    s = latest()
    check(s.get("dist") == 1 and s.get("via") == 1, "node 2 is one hop from source 1 (dist=%s via=%s)" % (s.get("dist"), s.get("via")))
    check(s.get("escape_to") is None, "escape_to is null, not node 3 at 99 (got %r)" % s.get("escape_to"))
    feed(3, neighbour(1, 0, anomaly=1.0), neighbour(3, 2, via=2))
    check(latest().get("escape_to") == 3, "with node 3 at a known dist 2, escape_to is 3 (got %r)" % latest().get("escape_to"))

    print("== P0.3: 10000 malformed packets ==")
    junk = [
        [1, 2, 3], "hello", 42, None, True, {"id": "x"}, {"id": -1},
        {"id": 1, "dist": "abc"}, {"id": 1, "dist": float("nan")},
        {"id": 1, "dist": 10 ** 30}, {"id": 1, "dist": -4}, {"id": 1, "dist": 1.5},
        {"id": 1, "anomaly": "hot"}, {"id": 1, "anomaly": float("inf")},
        {"id": 1, "anomaly": 7}, {"id": 1, "alert": "yes"}, {"id": 1, "via": "me"},
        {"id": 1, "dist": {"nested": [1, {"deep": True}]}}, {"id": True, "dist": 0},
        {"id": 3, "dist": 0, "mu": float("nan"), "sigma": 1, "n": 5},
    ]
    raw = [b"\xff\xfe\x00not utf8", b'{"id": 1, "dist": 0', b"", b"[" * 1000]
    for i in range(10000):
        if i % 4 == 0:
            send(tx, random.choice(raw))
        else:
            send(tx, json.dumps(random.choice(junk), allow_nan=True).encode())
        if i % 500 == 0:                    # the real neighbours keep talking meanwhile
            send(tx, neighbour(1, 0, anomaly=1.0))
            send(tx, neighbour(3, 2, via=2))
    feed(3, neighbour(1, 0, anomaly=1.0), neighbour(3, 2, via=2))
    check(proc.poll() is None, "node 2 is still running")
    before = len(seen)
    time.sleep(2.5)
    check(len(seen) > before, "node 2 still sends heartbeats (%d new in 2.5 s)" % (len(seen) - before))
    s = latest()
    check(s.get("dist") == 1 and s.get("via") == 1,
          "junk claiming to be node 1 did not replace node 1's real state (dist=%s via=%s)"
          % (s.get("dist"), s.get("via")))
finally:
    stop.set()
    try:
        proc.stdin.write("q\n")
        proc.stdin.flush()
    except Exception:
        pass
    try:
        out = proc.communicate(timeout=5)[0]
    except Exception:
        proc.kill()
        out = proc.communicate()[0]

status = [l for l in out.splitlines() if l.startswith("[")]
print("   last status line:", status[-1][:150] if status else "(none)")
check(bool(status) and "rejected:" in status[-1], "the status line reports the rejected packets")
tracebacks = [l for l in out.splitlines() if "Traceback" in l]
check(not tracebacks, "no traceback in the node's output (%d)" % len(tracebacks))
print()
print("ALL OK" if not failures else "FAILED: %d" % len(failures))
sys.exit(1 if failures else 0)
