#!/bin/sh
# Make this board run Gaia by itself: at power-on, after a crash, and with no
# SSH session open. Run once per board, after setup_bridge.sh:
#
#   sudo ./install_service.sh 3 2         # NODE_ID 3, neighbour 2
#   sudo ./install_service.sh 2 1,3       # NODE_ID 2, neighbours 1 and 3
#   sudo ./install_service.sh --remove    # back to starting it by hand
#   DRY_RUN=1 ./install_service.sh 3 2    # print what would be installed
#
# Without it a board started over SSH stops when the session closes and stays
# off after a power cycle: unplug it to show self-healing and it never rejoins.
#
# Two services, so trouble on one side never takes the other down:
#   gaia-node    aggregate/node.py, the network. Standard library only.
#   gaia-sensor  python/main.py, Modulino and LEDs over the Bridge.
# Each restarts by itself within seconds of dying. Watch them with
#   journalctl -u gaia-node -f
#   journalctl -u gaia-sensor -f
# Change the board's id or neighbours in /etc/gaia/board.env, then
#   sudo systemctl restart gaia-node gaia-sensor

set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
UNITS=/etc/systemd/system
CONF=/etc/gaia/board.env
DRY=${DRY_RUN:-}

if [ "${1:-}" = "--remove" ]; then
    [ "$(id -u)" -eq 0 ] || { echo "run it with sudo"; exit 1; }
    systemctl disable --now gaia-sensor gaia-node 2>/dev/null || true
    rm -f "$UNITS/gaia-node.service" "$UNITS/gaia-sensor.service" "$CONF"
    systemctl daemon-reload
    echo "removed: start the board by hand with ./run_board.sh again"
    exit 0
fi

ID=${1:?usage: sudo ./install_service.sh NODE_ID NEIGHBORS   e.g. 2 1,3}
NB=${2:?usage: sudo ./install_service.sh NODE_ID NEIGHBORS   e.g. 2 1,3}
case "$ID" in *[!0-9]*|"") echo "NODE_ID must be a number, got '$ID'"; exit 1 ;; esac

if [ -z "$DRY" ]; then
    [ "$(id -u)" -eq 0 ] || { echo "run it with sudo: it writes $UNITS and $CONF"; exit 1; }
fi
if [ ! -d "$ROOT/.bridge/site-packages" ] && [ -z "$DRY" ]; then
    echo "no $ROOT/.bridge yet: run ./setup_bridge.sh first (without sudo)"
    exit 1
fi

# The services run as whoever owns the repository (arduino), not as root.
OWNER=$(stat -c %U "$ROOT" 2>/dev/null || echo arduino)
PY=$(command -v python3 || echo /usr/bin/python3)

ENVFILE="# This board, for gaia-node and gaia-sensor. Edit, then:
#   sudo systemctl restart gaia-node gaia-sensor
NODE_ID=$ID
NEIGHBORS=$NB"

NODE_UNIT="[Unit]
Description=Gaia node $ID: gradient, consensus and heartbeats on the Wi-Fi
Wants=network-online.target
After=network-online.target

[Service]
User=$OWNER
EnvironmentFile=$CONF
Environment=PYTHONUNBUFFERED=1
WorkingDirectory=$ROOT/aggregate
ExecStart=$PY $ROOT/aggregate/node.py
StandardInput=null
Restart=always
RestartSec=2
# The mesh comes first. If Gemma (Ollama) or anything heavy runs on this board,
# the heartbeat must not wait for it: a neighbour silent for 4 s is dropped,
# and that would happen during a fire, the moment Gemma is asked to talk.
Nice=-5
CPUWeight=1000
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target"

# The node may come up before the Wi-Fi has an address: it re-reads its
# interfaces every 10 s, so network-online is a courtesy here, not a must.
SENSOR_UNIT="[Unit]
Description=Gaia sensor app: Modulino and LEDs over the Arduino Bridge
Wants=gaia-node.service arduino-router.service
After=gaia-node.service arduino-router.service

[Service]
User=$OWNER
SupplementaryGroups=arduino-router
EnvironmentFile=$CONF
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONPATH=$ROOT/.bridge/site-packages
Environment=NODE_HOST=127.0.0.1
WorkingDirectory=$HERE
ExecStart=$PY $HERE/python/main.py
Restart=always
RestartSec=3
# Second only to the node: without readings the anomaly stays fake.
Nice=-3
CPUWeight=500
OOMScoreAdjust=-400

[Install]
WantedBy=multi-user.target"

if [ -n "$DRY" ]; then
    printf '=== %s ===\n%s\n\n=== %s ===\n%s\n\n=== %s ===\n%s\n' \
        "$CONF" "$ENVFILE" "$UNITS/gaia-node.service" "$NODE_UNIT" \
        "$UNITS/gaia-sensor.service" "$SENSOR_UNIT"
    exit 0
fi

# Anything started by hand holds the ports and the Bridge: stop it first.
pkill -f "aggregate/node.py" 2>/dev/null || true
pkill -f "echofield_node/python/main.py" 2>/dev/null || true
sleep 1

mkdir -p "$(dirname "$CONF")"
printf '%s\n' "$ENVFILE" > "$CONF"
printf '%s\n' "$NODE_UNIT" > "$UNITS/gaia-node.service"
printf '%s\n' "$SENSOR_UNIT" > "$UNITS/gaia-sensor.service"
systemctl daemon-reload
systemctl enable --now gaia-node gaia-sensor

sleep 4
echo
for unit in gaia-node gaia-sensor; do
    printf '%-12s %s\n' "$unit" "$(systemctl is-active "$unit")"
done
echo
echo "--- gaia-node, first lines ---"
journalctl -u gaia-node -n 6 --no-pager -o cat 2>/dev/null || true
echo "--- gaia-sensor, last lines ---"
journalctl -u gaia-sensor -n 4 --no-pager -o cat 2>/dev/null || true
echo
echo "installed: board $ID (neighbours $NB) now starts at power-on and restarts by itself."
echo "test it: sudo reboot, wait a minute, and the board is back in the field."
