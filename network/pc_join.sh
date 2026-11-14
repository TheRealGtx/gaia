#!/bin/sh
# Put this Linux laptop on GaiaMesh as 10.77.0.100, then check that the boards
# answer and that their heartbeats get through.
#
#   ./pc_join.sh             join GaiaMesh, ping the boards, check the firewall,
#                            listen for heartbeats for a few seconds
#   ./pc_join.sh leave       leave GaiaMesh, back to the usual Wi-Fi
#   BOARDS="1 2 3 4" ./pc_join.sh    with a fourth board
#
# Do everything that needs internet BEFORE joining: the laptop has one Wi-Fi
# radio, and on GaiaMesh it has no internet (no git pull, no npm install, no
# Claude) unless a phone is plugged in with USB tethering.
#
# Linux only: under Windows this laptop's Wi-Fi driver reports IBSS as not
# supported, so it cannot join GaiaMesh at all.

set -eu
SSID=GaiaMesh
CHANNEL=6
CON=gaia-adhoc
ME=10.77.0.100
BOARDS=${BOARDS:-"1 2 3"}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

die() { echo "$*" >&2; exit 1; }

IFACE=$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')
[ -n "$IFACE" ] || die "no Wi-Fi interface found"

if [ "${1:-join}" = "leave" ]; then
    nmcli con down "$CON" 2>/dev/null || true
    echo "left $SSID: NetworkManager goes back to your usual Wi-Fi by itself."
    exit 0
fi

echo "== joining $SSID on $IFACE as $ME =="
nmcli con delete "$CON" >/dev/null 2>&1 || true
nmcli con add type wifi ifname "$IFACE" con-name "$CON" ssid "$SSID" \
    802-11-wireless.mode adhoc 802-11-wireless.band bg \
    802-11-wireless.channel "$CHANNEL" \
    ipv4.method manual ipv4.addresses "$ME/24" \
    ipv6.method disabled connection.autoconnect no >/dev/null \
    || die "nmcli refused to create the connection: run it again with sudo"
nmcli con up "$CON" >/dev/null || die "could not bring $SSID up on $IFACE"
sleep 3

echo "== who answers =="
for n in $BOARDS; do
    if ping -c 2 -W 2 "10.77.0.$n" >/dev/null 2>&1; then
        echo "   board $n   10.77.0.$n   answers   (ssh arduino@10.77.0.$n)"
    else
        echo "   board $n   10.77.0.$n   SILENT: not switched yet, or its test window ran out"
    fi
done

echo "== firewall =="
# An active firewall drops the boards' UDP heartbeats: the dashboard would stay
# empty with every board answering pings, which is a very confusing night.
FW=none
if systemctl is-active --quiet firewalld 2>/dev/null; then
    FW=firewalld
    echo "   firewalld is active: open the heartbeat port for tonight with"
    echo "       sudo firewall-cmd --add-port=5005/udp"
elif systemctl is-active --quiet ufw 2>/dev/null; then
    FW=ufw
    echo "   ufw is active: open the heartbeat port with"
    echo "       sudo ufw allow 5005/udp"
fi
[ "$FW" = none ] && echo "   no firewall service running"

echo "== heartbeats on UDP 5005, 7 seconds =="
if command -v python3 >/dev/null 2>&1 && [ -f "$ROOT/aggregate/listen.py" ]; then
    timeout 7 python3 "$ROOT/aggregate/listen.py" 2>/dev/null | grep -v "^listening\|^broadcast" | head -12 || true
else
    echo "   (no python3 or no repository here: skipped)"
fi
echo
echo "next: start the gateway and the dashboard (see HANDOFF-linux.md), then the"
echo "Live field page. To leave: ./network/pc_join.sh leave"
