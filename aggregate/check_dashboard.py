"""Does the dashboard accept what the nodes actually send?

Runs two real node.py processes, catches their packets off the wire, and feeds
them to the gateway's own parser and store: no FastAPI, no browser, just the
two modules that decide what the dashboard believes. Then it checks the banner
the screen would show.

    python3 check_dashboard.py

Run it after either side changes the contract. A quiet field must read
ALL CLEAR (every node at 99 is health, not doubt), and one heated node must
give a critical source, a warning ring around it, and ALERT.
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "dashboard"))
from gateway.protocol import load_node_manifest, parse_udp_packet   # noqa: E402
from gateway.store import GatewayStore                              # noqa: E402

MANIFEST = os.path.join(REPO, "dashboard", "gateway", "node_manifest.json")
NODE = os.path.join(REPO, "aggregate", "node.py")

store = GatewayStore(manifest=load_node_manifest(MANIFEST))
stats = {"ok": 0, "rejected": 0, "reasons": set()}
stop = threading.Event()


def gateway():
    """What main.py does with each datagram, minus the websocket."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("", 5005))
    s.settimeout(0.5)
    while not stop.is_set():
        try:
            data = s.recvfrom(4096)[0]
        except Exception:
            continue
        try:
            store.update_udp_packet(parse_udp_packet(data))
            stats["ok"] += 1
        except Exception as e:
            stats["rejected"] += 1
            stats["reasons"].add("%s: %s" % (type(e).__name__, e))
    s.close()


def banner(sensors):
    """alertBannerModel.ts, in Python, so we judge what the screen will say."""
    if sensors and all(s["status"] == "offline" for s in sensors):
        return "NETWORK OFFLINE"
    if any(s["status"] == "critical" for s in sensors):
        return "ALERT"
    if any(s["status"] in ("warning", "unknown", "stale") for s in sensors):
        return "WARNING"
    return "ALL CLEAR"


def look(label):
    snap = store.snapshot()
    sensors = [s for env in snap["environments"].values() for s in env["sensors"].values()]
    sensors.sort(key=lambda s: s["id"])
    print("%-22s %s" % (label, "  ".join(
        "%s[%s d=%s t=%s%s]" % (s["id"], s["status"], s["gradientDistance"],
                                s["temperature"], " sim" if s.get("simulated") else "")
        for s in sensors)))
    print("%-22s %s" % ("", "banner: %s" % banner(sensors)))
    return sensors, banner(sensors)


threading.Thread(target=gateway, daemon=True).start()

env = dict(os.environ, PYTHONUNBUFFERED="1", MODE="broadcast")
procs = {}
for nid, nbs in ((1, "2"), (2, "1,3"), (3, "2")):   # the line the manifest describes
    procs[nid] = subprocess.Popen(
        [sys.executable, NODE], cwd=os.path.join(REPO, "aggregate"),
        env=dict(env, NODE_ID=str(nid), NEIGHBORS=nbs),
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, text=True, bufsize=1)

failures = []
try:
    time.sleep(5)
    sensors, label = look("quiet field")
    if label != "ALL CLEAR":
        failures.append("a quiet field must read ALL CLEAR, got %s" % label)
    if not all(s["gradientDistance"] == 99 for s in sensors):
        failures.append("every node should be at 99 with no hazard")
    if not all(s.get("simulated") for s in sensors):
        failures.append("readings are simulated today and must say so")

    procs[1].stdin.write("a\n")
    procs[1].stdin.flush()
    time.sleep(5)
    sensors, label = look("node 1 heated")
    if label != "ALERT":
        failures.append("a source must raise ALERT, got %s" % label)
    src = [s for s in sensors if s["gradientDistance"] == 0]
    near = [s for s in sensors if s["gradientDistance"] == 1]
    far = [s for s in sensors if s["gradientDistance"] == 2]
    if not far or far[0]["status"] != "normal":
        failures.append("the node two hops away is not in danger and must read normal")
    if not src or src[0]["status"] != "critical":
        failures.append("the source must be critical")
    if not near or near[0]["status"] != "warning":
        failures.append("its neighbour must be the warning ring")
    if near and near[0].get("via") != src[0]["id"]:
        failures.append("the arrow should point at the source: via=%r" % near[0].get("via"))
finally:
    for p in procs.values():
        try:
            p.stdin.write("q\n")
            p.stdin.flush()
        except Exception:
            pass
        try:
            p.wait(timeout=4)
        except Exception:
            p.kill()
    stop.set()
    time.sleep(0.6)

print()
print("packets accepted by his parser: %d, rejected: %d" % (stats["ok"], stats["rejected"]))
for r in sorted(stats["reasons"]):
    print("   rejected:", r)
if stats["rejected"]:
    failures.append("his parser rejected %d of our packets" % stats["rejected"])
if failures:
    print()
    print("PROBLEMS")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("OK: real nodes -> his parser -> his store -> the right banner")
