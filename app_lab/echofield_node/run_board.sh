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
# Optional: PY_APP=/path/to/python if the system python3 cannot import
# arduino.app_utils (main.py says so and tells you how to find the right one),
# and ANOMALY=1 to start the node already in anomaly.
#
# The node's status lines go to /tmp/gaia-node-<id>.log so they do not mix with
# the app's; watch them from a second SSH session with
#   tail -f /tmp/gaia-node-<id>.log

set -e
ID=${1:?usage: run_board.sh NODE_ID NEIGHBORS   e.g. run_board.sh 2 1,3}
NB=${2:?usage: run_board.sh NODE_ID NEIGHBORS   e.g. run_board.sh 2 1,3}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
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

NODE_HOST=127.0.0.1 "$PY_APP" "$HERE/python/main.py"
