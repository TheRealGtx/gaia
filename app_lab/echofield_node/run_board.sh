#!/bin/sh
# Start one Gaia board from an SSH session, without App Lab.
#
# The sketch has to be flashed already (Arduino IDE, sketch/sketch.ino). This
# starts the two halves side by side on the board's own OS:
#   - aggregate/node.py   the network: gradient, consensus, heartbeats on the Wi-Fi
#   - python/main.py      the hardware: reads the Modulino, drives the LEDs,
#                         talks to the node on 127.0.0.1:5006
#
# Usage, one line per board (a line of three):
#   ./run_board.sh 1 2
#   ./run_board.sh 2 1,3
#   ./run_board.sh 3 2
#
# The board's python3 has no arduino.app_utils of its own: run
# ./setup_bridge.sh once and this script finds the copy in ../../.bridge.
# Optional: PY_APP=/path/to/python to use another interpreter, and ANOMALY=1 to
# start the node already in anomaly.
#
# The node's status lines go to /tmp/gaia-node-<id>.log so they do not mix with
# the app's; watch them from a second SSH session with
#   tail -f /tmp/gaia-node-<id>.log

set -e
ID=${1:?usage: run_board.sh NODE_ID NEIGHBORS   e.g. run_board.sh 2 1,3}
NB=${2:?usage: run_board.sh NODE_ID NEIGHBORS   e.g. run_board.sh 2 1,3}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
# Once install_service.sh has run, systemd owns this board: a second node here
# would fight it for the ports and the Bridge, and lose in confusing ways.
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet gaia-node 2>/dev/null; then
    echo "this board already runs Gaia as a service, which does what this script does."
    echo "watch it:        journalctl -u gaia-node -f   (and gaia-sensor)"
    echo "restart it:      sudo systemctl restart gaia-node gaia-sensor"
    echo "back to by hand: sudo ./install_service.sh --remove"
    exit 1
fi

PY_NODE=${PY_NODE:-python3}
PY_APP=${PY_APP:-python3}
LOG=/tmp/gaia-node-$ID.log

NODE_ID=$ID NEIGHBORS=$NB ANOMALY=${ANOMALY:-0} \
    "$PY_NODE" "$ROOT/aggregate/node.py" < /dev/null > "$LOG" 2>&1 &
NODE_PID=$!
# Whatever ends this script, the node goes with it: a node left running in the
# background keeps the ports and keeps talking, and the next start fails on them.
trap 'kill $NODE_PID 2>/dev/null' EXIT INT TERM

sleep 1
if ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "node.py did not start, its log says:"
    cat "$LOG"
    exit 1
fi
echo "node $ID up (pid $NODE_PID, neighbours $NB), log in $LOG"
head -3 "$LOG"

# Only the app gets App Lab's libraries on its path: node.py and the model need
# nothing but the standard library, and keeping them off it means a broken copy
# can take down the LEDs but never the mesh.
BRIDGE="$ROOT/.bridge/site-packages"
if [ -d "$BRIDGE" ]; then
    APP_PYTHONPATH="$BRIDGE${PYTHONPATH:+:$PYTHONPATH}"
else
    echo "no $BRIDGE yet: if main.py cannot import arduino.app_utils, run ./setup_bridge.sh"
    APP_PYTHONPATH="${PYTHONPATH:-}"
fi

PYTHONPATH="$APP_PYTHONPATH" NODE_HOST=127.0.0.1 "$PY_APP" "$HERE/python/main.py"
