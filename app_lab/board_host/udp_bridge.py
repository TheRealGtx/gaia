"""UDP bridge between the App Lab container and the Wi-Fi (runs on the BOARD HOST).

Why: App Lab runs our Python inside Docker (172.18.0.2). Broadcasts from there
never reach the Wi-Fi, and packets other boards send to this board's Wi-Fi
address never reach the container. This script runs OUTSIDE the container, in
the board terminal (adb shell / ssh), and relays both ways on port 5005:

    container --(unicast to 172.18.0.1)--> bridge --(broadcast)--> Wi-Fi
    Wi-Fi     --(broadcast/unicast)-----> bridge --(unicast)-----> container

The node in the app needs ONE setting: BROADCAST=172.18.0.1 (main.py sets it),
so it sends its heartbeats to this bridge instead of a broadcast that dies in
Docker. Nothing in node.py changes; Pietro's dashboard keeps listening on 5005.

Run on each board, before or after starting the app:
    python3 udp_bridge.py
Options (env): PORT=5005  WIFI_BCAST=<x.y.z.255>  CONTAINER=172.18.0.2
The container address is learned from the first packet it sends, so CONTAINER
is only the starting guess.
"""
import ipaddress
import os
import socket
import subprocess
import time

PORT = int(os.environ.get("PORT", 5005))
DOCKER_IF = ("docker", "br-", "veth")          # Docker's own interfaces on the host


def local_ifaces():
    """[(name, ip_interface)] of every non-loopback IPv4 address (`ip -o -4 addr`)."""
    out = subprocess.run(["ip", "-o", "-4", "addr"], capture_output=True, text=True).stdout
    found = []
    for line in out.splitlines():
        parts = line.split()
        name = parts[1] if len(parts) > 1 else ""
        for tok in parts[2:]:
            if "/" in tok and tok[0].isdigit():
                itf = ipaddress.ip_interface(tok)
                if not itf.ip.is_loopback:
                    found.append((name, itf))
                break
    return found


ifaces = local_ifaces()
my_ips = {str(i.ip) for _, i in ifaces}
docker_nets = [i.network for n, i in ifaces if n.startswith(DOCKER_IF)]
wifi = [i for n, i in ifaces if not n.startswith(DOCKER_IF)]


def is_docker(ip):
    a = ipaddress.ip_address(ip)
    return any(a in net for net in docker_nets)


if "WIFI_BCAST" in os.environ:
    wifi_bcast = [os.environ["WIFI_BCAST"]]
else:
    wifi_bcast = sorted({str(i.network.broadcast_address) for i in wifi}) or ["255.255.255.255"]
container = os.environ.get("CONTAINER", "172.18.0.2")

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
s.bind(("", PORT))
print("udp_bridge: wifi %s -> broadcast %s, container %s:%d"
      % ([str(i) for i in wifi], wifi_bcast, container, PORT), flush=True)

up = down = 0
last = time.time()
while True:
    data, (src, sport) = s.recvfrom(4096)
    if src in my_ips:
        continue                                    # my own re-broadcast looping back
    try:
        if is_docker(src):                          # from our node -> out to the Wi-Fi
            if src != container:
                container = src
                print("udp_bridge: container is", container, flush=True)
            for b in wifi_bcast:
                s.sendto(data, (b, PORT))
            up += 1
        else:                                       # from another board -> into the container
            s.sendto(data, (container, PORT))
            down += 1
    except OSError as e:
        print("udp_bridge: send failed:", e, flush=True)
    if time.time() - last >= 10:
        print("udp_bridge: %d out to Wi-Fi, %d in to container (last 10 s)" % (up, down), flush=True)
        up = down = 0
        last = time.time()
