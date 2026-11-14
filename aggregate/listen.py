#!/usr/bin/env python3
"""Gaia network check: prints every packet on UDP 5005, and says when there are
none.

Passive by default: it sends nothing, so it cannot change what the nodes do.

    python3 listen.py              # watch
    PROBE=1 python3 listen.py      # watch and send a probe packet every second

How to read it:

  - packets appear                  -> the network carries them; if a node still
                                       ignores an alarm, look for `ignored:{2: n}`
                                       in that node's status line: 2 is not in
                                       its NEIGHBORS
  - "no packets yet" forever        -> nothing arrives here. Either nothing is
                                       sending (is node.py actually running on
                                       the boards? the App Lab app alone sends
                                       no UDP), or the access point blocks
                                       client-to-client traffic, or the boards
                                       broadcast out of another interface

With PROBE=1 on both sides (this laptop and a board) the two directions can be
told apart. The probe uses `id: 0`, which no node has as a neighbour, so a board
that receives it shows `ignored:{0: n}` in its status line: that line is proof
that laptop -> board works. Nothing here and `ignored:{0: n}` there means the
return path is the broken one.
"""
import json
import os
import socket
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from node import broadcast_addrs, local_ip          # same addresses the nodes use

PORT = int(os.environ.get("PORT", 5005))
PROBE = os.environ.get("PROBE", "").lower() not in ("", "0", "false", "no")

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("", PORT))
s.settimeout(1.0)

print("listening on UDP %d, my address %s" % (PORT, local_ip() or "unknown"), flush=True)
print("broadcast addresses for this network: %s" % ", ".join(broadcast_addrs()), flush=True)


def probe_loop():
    """One dummy packet per second, so the other side can see us too."""
    p = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    p.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    while True:
        msg = json.dumps({"id": 0, "probe": True, "from": local_ip(),
                          "ts": time.time()}).encode()
        for addr in broadcast_addrs():
            try:
                p.sendto(msg, (addr, PORT))
            except OSError as e:
                print("probe to %s failed: %s" % (addr, e), flush=True)
        time.sleep(1)


if PROBE:
    print("probing: sending id=0 once per second (a board that hears it shows "
          "ignored:{0: n})", flush=True)
    threading.Thread(target=probe_loop, daemon=True).start()

seen = {}
t0 = time.time()
last_note = 0.0
try:
    while True:
        age = time.time() - t0
        try:
            data, addr = s.recvfrom(4096)
        except socket.timeout:
            if not seen and age - last_note >= 5:   # never look frozen
                last_note = age
                print("%7.1fs  no packets yet" % age, flush=True)
            continue
        age = time.time() - t0
        try:
            m = json.loads(data)
        except ValueError:
            print("%7.1fs %-15s not JSON: %r" % (age, addr[0], data[:60]), flush=True)
            continue
        nid = m.get("id")
        first = "   <-- first packet from this node" if nid not in seen else ""
        seen[nid] = seen.get(nid, 0) + 1
        if m.get("probe"):
            print("%7.1fs %-15s probe from %s%s"
                  % (age, addr[0], m.get("from"), first), flush=True)
            continue
        print("%7.1fs %-15s id=%-3s dist=%-3s via=%-4s anom=%-5s alert=%-5s "
              "t=%-6s n=%-4s%s"
              % (age, addr[0], nid, m.get("dist"), m.get("via"), m.get("anomaly"),
                 m.get("alert"), m.get("temperature"), m.get("n"), first), flush=True)
except KeyboardInterrupt:
    print()
    print("%.0f s, %d packets from %d senders"
          % (time.time() - t0, sum(seen.values()), len(seen)))
    for nid in sorted(seen, key=lambda x: (x is None, x)):
        print("  id %-4s %4d packets" % (nid, seen[nid]))
