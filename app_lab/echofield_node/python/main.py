"""EchoField node: Linux side of the App Lab app.

Two modes, picked automatically:

  network  (normal) aggregate/node.py runs in a thread with OUR read_sensor()
           and Chuqi's anomaly_score(); the LEDs show the network state
           (same colours as the dashboard: 0 red, 1 amber, >=2 green, 99 blue).
  test     if node.py cannot be imported (repo not on the board yet), or
           GAIA_MODE=test: sensor test only, LEDs red above 30 °C.
           The 30 °C threshold is ONLY a wiring test. Never ship it: a fixed
           threshold is exactly what our pitch says we do not do.

In both modes every reading is appended to a CSV that calibrate.py reads
(columns time,temp,hum). The full path is printed at startup.
    RECORD=normal.csv  -> ~5 min at room temperature
    RECORD=hazard.csv  -> ~1 min, hair dryer at a distance

read_sensor() stays HERE, not in sensing_ml/model.py: Bridge only exists in
the App Lab runtime, and model.py also runs on laptops, in test_model.py and
in calibrate.py.

Per board, set in the app environment: NODE_ID and NEIGHBORS
(1 -> "2", 2 -> "1,3", 3 -> "2"). GAIA_ROOT = repo root on the board, if it
is not three folders above this file.

UNVERIFIED (check App Lab examples / ask mentors):
  [P1] import path `arduino.app_utils` and App.run(user_loop=...)
  [P2] Bridge.call(name, *args) returns the sketch function's value
  [P3] where files written here end up (container path) and how to copy them out
  [P4] App Lab may upload only this app folder: then aggregate/ and sensing_ml/
       are not on the board. Set GAIA_ROOT, or copy both folders next to main.py.
  [P5] Bridge.call from two threads (node reads, loop sets pixels): ask if safe.
"""
import csv
import os
import sys
import threading
import time

from arduino.app_utils import App, Bridge   # [P1]

RECORD = os.path.abspath(os.environ.get("RECORD", "readings.csv"))
HOT = 30.0                                   # TEST MODE ONLY, see docstring

# ---- hardware (Bridge) -----------------------------------------------------
def _bridge_read():
    """{"temp": C, "hum": %} straight from the MCU."""
    return {"temp": float(Bridge.call("read_temp")),   # [P2]
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
_last = {"t": -1.0, "v": None}
print("recording to", RECORD, flush=True)


def read_sensor():
    """What node.py calls (about twice a second). Records at most 1 row/s."""
    v = _bridge_read()
    t = round(time.time() - _t0, 2)
    _last["v"] = v
    if t - _last["t"] >= 1.0:
        _last["t"] = t
        _w.writerow([t, v["temp"], v["hum"]])
        _f.flush()
    return v


# ---- network node ----------------------------------------------------------
node = None
if os.environ.get("GAIA_MODE", "network") != "test":
    root = os.environ.get("GAIA_ROOT") or os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
    for p in (root, os.path.join(root, "aggregate")):
        if p not in sys.path:
            sys.path.insert(0, p)
    try:
        import node                                     # aggregate/node.py  [P4]
        from sensing_ml.model import anomaly_score
        threading.Thread(target=node.main,
                         kwargs={"sensor": read_sensor, "score": anomaly_score},
                         daemon=True).start()
    except Exception as e:
        node = None
        print("node not available, TEST MODE (LED = 30 C threshold):", e, flush=True)


def colour():
    """LED colour from the network state, same mapping as the dashboard."""
    with node.lock:
        d, alert = node.state["dist"], node.state["alert"]
    if alert or d == 0:
        return (60, 0, 0)       # red:   I am the hazard
    if d >= node.UNKNOWN:
        return (0, 0, 30)       # blue:  I know of no hazard
    if d == 1:
        return (50, 35, 0)      # amber: one hop away
    return (0, 40, 0)           # green: far from the hazard


# ---- App Lab loop (main thread) --------------------------------------------
def loop():
    if node is not None:
        set_color(*colour())                # node.py prints its own status line
        time.sleep(0.5)
        return
    # TEST MODE: no network, read here and use the fixed threshold
    try:
        v = read_sensor()
    except Exception as e:                   # bridge hiccup: keep going
        print("read failed:", e)
        time.sleep(1)
        return
    print(f"{time.time() - _t0:7.1f}s  temp={v['temp']:.2f}  hum={v['hum']:.1f}", flush=True)
    set_color(*((60, 0, 0) if v["temp"] > HOT else (0, 40, 0)))   # TEST ONLY
    time.sleep(1)


App.run(user_loop=loop)                       # [P1]
