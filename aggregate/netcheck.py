#!/usr/bin/env python3
"""Gaia network check: one command, one verdict. Run it on every machine.

    python3 netcheck.py                          # 6 seconds, then a verdict
    PEERS=1=10.118.94.44,3=10.118.94.51 python3 netcheck.py   # also unicast

It prints this machine's interfaces and routes, sends probes to every address a
node would use, listens on 5005, and says what that means. Run it on both
boards and on the laptop at the same time: each one then also hears the others,
which is what localizes the fault.

It depends on nothing of ours on purpose (not even node.py): a diagnostic must
work when the thing being diagnosed does not. Standard library only, and no
syntax newer than Python 3.6.
"""
import json
import os
import platform
import socket
import subprocess
import sys
import threading
import time

PORT = int(os.environ.get("PORT", 5005))
SECONDS = float(os.environ.get("SECONDS", 6))
# A unique id per run: it is how a probe is recognised as ours even when it
# comes back through an interface whose address we could not enumerate.
ME = "check-%s" % os.environ.get("NODE_ID", "%04x" % (int(time.time() * 1000) & 0xFFFF))


def run(cmd):
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           universal_newlines=True, timeout=3)
        return (p.stdout or "").strip()
    except Exception as e:
        return "(%s: %s)" % (" ".join(cmd), e)


def outgoing_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))                  # picks a route, sends nothing
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def interfaces():
    """[(address, prefix)] for every non-loopback IPv4 address."""
    out, found = run(["ip", "-o", "-4", "addr"]), []
    for line in out.splitlines():
        for tok in line.split():
            if "/" in tok and tok[0].isdigit():
                ip, _, pfx = tok.partition("/")
                try:
                    pfx = int(pfx)
                except ValueError:
                    break
                if not ip.startswith("127."):
                    found.append((ip, pfx))
                break
    return found


def broadcast_of(ip, prefix):
    a = [int(x) for x in ip.split(".")]
    bits = (a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]
    host = (1 << (32 - prefix)) - 1
    b = bits | host
    return "%d.%d.%d.%d" % ((b >> 24) & 255, (b >> 16) & 255, (b >> 8) & 255, b & 255)


def peers():
    out = {}
    for part in os.environ.get("PEERS", "").replace(" ", "").split(","):
        if "=" in part:
            nid, host = part.split("=", 1)
            out[nid] = host
    return out


print("=" * 70)
print("gaia netcheck   host=%s   python=%s   %s"
      % (socket.gethostname(), platform.python_version(), platform.system()))
print("=" * 70)

ifs = interfaces()
print("interfaces (ip -o -4 addr):")
if ifs:
    for ip, pfx in ifs:
        print("   %-16s /%-3d  broadcast %s" % (ip, pfx, broadcast_of(ip, pfx)))
else:
    print("   (no `ip` command: cannot read the netmasks on this machine)")
print("outgoing address for the internet: %s" % (outgoing_ip() or "unknown"))
route = run(["ip", "route"]).splitlines()
print("default route: %s" % (route[0] if route else "unknown"))
print()

dests = ["255.255.255.255"] + [broadcast_of(ip, p) for ip, p in ifs]
if not ifs:
    ip = outgoing_ip()
    if ip:
        dests.append(ip.rsplit(".", 1)[0] + ".255")      # a /24 guess, nothing better
seen = {}

# ---------------------------------------------------------------- listen ----
try:
    rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    rx.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    rx.bind(("", PORT))
    rx.settimeout(0.5)
except OSError as e:
    print("CANNOT LISTEN on UDP %d: %s" % (PORT, e))
    print("something else is bound to it, or the firewall refuses it.")
    sys.exit(1)

stop = threading.Event()


def recv_loop():
    while not stop.is_set():
        try:
            data, addr = rx.recvfrom(4096)
        except Exception:
            continue
        try:
            m = json.loads(data)
        except ValueError:
            m = {}
        key = (addr[0], str(m.get("id")), str(m.get("check", "")))
        if key not in seen:
            what = "node heartbeat"
            if m.get("check"):
                what = "my own probe" if m.get("id") == ME else "netcheck probe from another machine"
            print("   heard %-16s id=%-10s %s" % (addr[0], m.get("id"), what))
        seen[key] = seen.get(key, 0) + 1


threading.Thread(target=recv_loop, daemon=True).start()

# ------------------------------------------------------------------ send ----
tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
tx.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
targets = [(d, PORT) for d in dests] + [("127.0.0.1", PORT)]
targets += [(h, PORT) for h in peers().values()]
print("sending probes to: %s" % ", ".join("%s:%d" % t for t in targets))
print("listening %.0f s ..." % SECONDS)

t0 = time.time()
sent_ok, sent_fail = [], []
while time.time() - t0 < SECONDS:
    msg = json.dumps({"id": ME, "check": True, "from": outgoing_ip(),
                      "ts": time.time()}).encode()
    for t in targets:
        try:
            tx.sendto(msg, t)
            if t not in sent_ok:
                sent_ok.append(t)
        except OSError as e:
            if (t, str(e)) not in sent_fail:
                sent_fail.append((t, str(e)))
                print("   send to %s:%d FAILED: %s" % (t[0], t[1], e))
    time.sleep(1)
stop.set()
time.sleep(0.6)

# ---------------------------------------------------------------- verdict ----
print()
print("-" * 70)
# Ours is anything carrying this run's id, whatever address it arrived from:
# on Windows the interface list is empty, so addresses alone are not enough.
heard_self = [k for k in seen if k[1] == ME and not k[0].startswith("127.")]
heard_loop = [k for k in seen if k[0].startswith("127.")]
heard_others = [k for k in seen if k[1] != ME and not k[0].startswith("127.")]
heard_nodes = [k for k in heard_others if not k[2]]

if not seen:
    print("VERDICT: nothing at all, not even my own probe to 127.0.0.1.")
    print("  The socket cannot talk to itself: a firewall is blocking UDP %d" % PORT)
    print("  for this process, or another program holds the port.")
elif not heard_self and not heard_others:
    print("VERDICT: only loopback came back.")
    print("  My broadcast does not return on any real interface: the network")
    print("  drops broadcast (phone hotspots and guest Wi-Fi usually do), or the")
    print("  packets leave through an interface that loops nowhere (a USB link).")
    print("  -> use PEERS=<id>=<address> on the nodes: unicast, no broadcast.")
elif heard_others:
    print("VERDICT: this machine reaches and is reached by:")
    for ip in sorted(set(k[0] for k in heard_others)):
        kinds = set("probe" if k[2] else "node id=%s" % k[1] for k in heard_others if k[0] == ip)
        print("    %-16s %s" % (ip, ", ".join(sorted(kinds))))
    if heard_nodes:
        print("  Node heartbeats arrive, so the network is fine. If a node still")
        print("  ignores the alarm, look for `ignored:{N: ...}` in its status")
        print("  line: N is not in its NEIGHBORS.")
    else:
        print("  Only netcheck probes, no node heartbeat: the other machines are")
        print("  reachable but node.py is not sending. Is it running there, and")
        print("  in broadcast mode (MODE=unicast only talks to 127.0.0.1)?")
else:
    print("VERDICT: my own broadcast comes back to me, but nobody else is here.")
    print("  Sending works on this machine. Either the others are not running")
    print("  netcheck/node.py right now, or the access point isolates clients.")
print("-" * 70)
for k in sorted(seen, key=lambda x: (x[0], x[1])):
    print("  %-16s id=%-8s %-16s %4d packets" % (k[0], k[1], "probe" if k[2] else "heartbeat", seen[k]))
