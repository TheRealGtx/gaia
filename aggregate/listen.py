#!/usr/bin/env python3
"""Passive listener: prints every Gaia packet on the network.

It never sends anything, so it cannot change what the nodes do. It is the
fastest way to tell the two causes of "the other nodes do not see the alarm"
apart:

  - nothing is printed here          -> the packets never leave the board
                                        (broadcast blocked, wrong interface,
                                        wrong mode: see node.py `destinations`)
  - packets are printed here, but a node's status line says
    `ignored:{2: 37}`                -> they arrive and that node throws them
                                        away, because 2 is not in its NEIGHBORS

Run it on any laptop on the same Wi-Fi as the boards:
    python3 listen.py

PORT=5005 by default; ctrl-c prints a per-node summary.
"""
import json
import os
import socket
import time

PORT = int(os.environ.get("PORT", 5005))

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("", PORT))
print("listening on UDP %d (passive, sends nothing), ctrl-c to stop" % PORT, flush=True)

seen = {}
t0 = time.time()
try:
    while True:
        data, addr = s.recvfrom(4096)
        age = time.time() - t0
        try:
            m = json.loads(data)
        except ValueError:
            print("%7.1fs %-15s not JSON: %r" % (age, addr[0], data[:60]), flush=True)
            continue
        nid = m.get("id")
        first = "   <-- first packet from this node" if nid not in seen else ""
        seen[nid] = seen.get(nid, 0) + 1
        print("%7.1fs %-15s id=%-3s dist=%-3s via=%-4s anom=%-5s alert=%-5s "
              "t=%-6s n=%-4s%s"
              % (age, addr[0], nid, m.get("dist"), m.get("via"), m.get("anomaly"),
                 m.get("alert"), m.get("temperature"), m.get("n"), first), flush=True)
except KeyboardInterrupt:
    print()
    print("%.0f s, %d packets from %d nodes" % (time.time() - t0, sum(seen.values()), len(seen)))
    for nid in sorted(seen, key=lambda x: (x is None, x)):
        print("  id %-4s %4d packets" % (nid, seen[nid]))
