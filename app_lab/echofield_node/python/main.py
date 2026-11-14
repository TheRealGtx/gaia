"""Gaia node, App Lab side: the sensor client (Chuqi).

This app owns the hardware and nothing else. The same file runs on every board.

    MCU sketch  <--Bridge-->  this app (container)  <--UDP 5006-->  node.py (board host)

Once a second it reads the Modulino Thermo, sends {"temp": C, "hum": %} to
aggregate/node.py running on the board's HOST OS, and gets that node's state
back in the same exchange ({"dist", "alert", ...}). The LEDs show that state,
with the same colours as the dashboard (board RGB LEDs, and Modulino Pixels if
plugged in), and the LED matrix shows an arrow moving toward the safest
neighbour (escape_to), i.e. where to run. Colours:

    red    dist 0 or alert   this board is the hazard
    amber  dist 1            one hop from the hazard
    green  dist 2..98        far from the hazard
    blue   dist 99           no hazard known anywhere
    white  (dim)             the node on the host is not answering

Why the node is not in here: App Lab runs this file in a container on a docker
bridge (172.18.0.2), and a broadcast from there never reaches the Wi-Fi. So
node.py and the model (sensing_ml/model.py) run on the host, and this app needs
neither of them: only main.py and the sketch have to be in the App Lab app.
NODE_ID and NEIGHBORS are set where node.py is started, not here.

Every reading is also appended to a CSV for calibrate.py (columns
time,temp,hum). The full path is printed at startup.
    RECORD=normal.csv  -> ~5 min at room temperature
    RECORD=hazard.csv  -> ~1 min, heat source at demo distance

Settings (environment, all optional):
    NODE_HOST    address of the board host seen from the container
                 (default: this container's default gateway, else 172.18.0.1)
    SENSOR_PORT  5006, must match node.py
    GAIA_MODE=test   wiring check with no node: LEDs red above 30 C. The 30 C
                 threshold is ONLY a wiring test. Never ship it: a fixed
                 threshold is exactly what our pitch says we do not do.

Verified on a board (14/11): `arduino.app_utils`, App.run(user_loop=...),
Bridge.call returning the sketch's value, and files landing in /app.
"""
import csv
import json
import os
import socket
import struct
import time

from arduino.app_utils import App, Bridge

RECORD = os.path.abspath(os.environ.get("RECORD", "readings.csv"))
TEST_MODE = os.environ.get("GAIA_MODE", "network") == "test"
HOT = 30.0                       # TEST MODE ONLY, see docstring
PORT = int(os.environ.get("SENSOR_PORT", 5006))
NODE_SILENT = 5.0                # seconds without an answer before the LEDs say so
UNKNOWN = 99                     # node.py: "I know of no hazard"


# ---- hardware (Bridge) -----------------------------------------------------
def read_sensor():
    """{"temp": C, "hum": %} straight from the MCU."""
    return {"temp": float(Bridge.call("read_temp")),
            "hum": float(Bridge.call("read_hum"))}


def set_color(r, g, b):
    Bridge.call("set_pixels", int(r), int(g), int(b))


# ---- CSV recording ---------------------------------------------------------
_new = not os.path.exists(RECORD)
_f = open(RECORD, "a", newline="")
_w = csv.writer(_f)
if _new:
    _w.writerow(["time", "temp", "hum"])
_t0 = time.time()
print("recording to", RECORD, flush=True)


# ---- the node on the board host --------------------------------------------
def host_address():
    """The board host as seen from this container: its default gateway."""
    if os.environ.get("NODE_HOST"):
        return os.environ["NODE_HOST"]
    try:
        with open("/proc/net/route") as f:
            for line in f.readlines()[1:]:
                p = line.split()
                if p[1] == "00000000" and int(p[3], 16) & 2:     # default route, gateway flag
                    return socket.inet_ntoa(struct.pack("<L", int(p[2], 16)))
    except (OSError, ValueError, IndexError):
        pass
    return "172.18.0.1"


HOST = host_address()
_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
_sock.settimeout(0.5)
_state = {"dist": UNKNOWN, "alert": False}
_heard = {"at": 0.0, "ever": False}
if not TEST_MODE:
    print("sensor client: readings -> %s:%d (node.py on the board host)" % (HOST, PORT),
          flush=True)


def ask_node(reading):
    """Send one reading, take the node's state from its answer. True if it answered."""
    try:
        _sock.sendto(json.dumps(reading).encode(), (HOST, PORT))
        reply = json.loads(_sock.recv(1024))
        if not isinstance(reply, dict):
            return False
        _state.update(reply)
        _heard["at"] = time.time()
        if not _heard["ever"]:
            _heard["ever"] = True
            print("node %s is answering" % reply.get("id", "?"), flush=True)
        return True
    except (OSError, ValueError):
        return False             # node not up (yet): keep the last state


def colour():
    """LED colour from the node's state, same mapping as the dashboard."""
    if time.time() - _heard["at"] > NODE_SILENT:
        return (12, 12, 12)      # dim white: no node on the host
    try:
        d = int(_state.get("dist", UNKNOWN))
    except (TypeError, ValueError):
        d = UNKNOWN
    if _state.get("alert") or d == 0:
        return (60, 0, 0)        # red:   I am the hazard
    if d >= UNKNOWN:
        return (0, 0, 30)        # blue:  no hazard known
    if d == 1:
        return (50, 35, 0)       # amber: one hop away
    return (0, 40, 0)            # green: far from the hazard


def show_state():
    """The LED matrix shows where to run: an arrow toward escape_to.

    Boards stand in a line, ids increasing from left to right (1-2-3), so
    escaping to a higher id means "run right". ARROW_FLIP=1 if the line is set
    up the other way round on the table."""
    if time.time() - _heard["at"] > NODE_SILENT:
        d, direction = -1, 0
    else:
        try:
            d = 0 if _state.get("alert") else int(_state.get("dist", UNKNOWN))
        except (TypeError, ValueError):
            d = UNKNOWN
        direction = 0
        esc, me = _state.get("escape_to"), _state.get("id")
        if d < UNKNOWN and isinstance(esc, int) and isinstance(me, int) and esc != me:
            direction = 1 if esc > me else -1
            if os.environ.get("ARROW_FLIP") == "1":
                direction = -direction
    try:
        Bridge.call("show_state", int(d), int(direction))
    except Exception:
        pass                     # older sketch without show_state: LEDs still work


# ---- App Lab loop (main thread, the only code that touches the Bridge) -----
def loop():
    start = time.time()
    try:
        v = read_sensor()
    except Exception as e:       # bridge hiccup: keep going
        print("read failed:", e, flush=True)
        time.sleep(1)
        return
    t = round(start - _t0, 2)
    _w.writerow([t, v["temp"], v["hum"]])
    _f.flush()
    line = "%7.1fs  temp=%.2f  hum=%.1f" % (t, v["temp"], v["hum"])
    if TEST_MODE:
        set_color(*((60, 0, 0) if v["temp"] > HOT else (0, 40, 0)))   # TEST ONLY
        print(line + "  (test mode)", flush=True)
    else:
        ask_node(v)
        if time.time() - _heard["at"] > NODE_SILENT:
            line += "  | no answer from node.py at %s:%d" % (HOST, PORT)
        else:
            line += "  | node %s anom=%s dist=%s alert=%s escape_to=%s" % (
                _state.get("id", "?"), _state.get("anomaly", "?"),
                _state.get("dist", "?"), "ON" if _state.get("alert") else "off",
                _state.get("escape_to"))
        set_color(*colour())
        show_state()
        print(line, flush=True)
    time.sleep(max(0.0, 1.0 - (time.time() - start)))


App.run(user_loop=loop)
