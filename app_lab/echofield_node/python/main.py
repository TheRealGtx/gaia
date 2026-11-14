"""EchoField node: Linux side, step 1 = sensor test + CSV recording.

Prints temp/hum once per second and appends to a CSV that calibrate.py reads
(columns time,temp,hum). LEDs go green/red by temperature, just to prove
set_pixels works.

Recording for calibration:
    RECORD=normal.csv  -> ~5 min at room temperature
    RECORD=hazard.csv  -> ~1 min, hair dryer at a distance

UNVERIFIED (check App Lab examples / ask mentors):
  [P1] import path `arduino.app_utils` and App.run(user_loop=...)
  [P2] Bridge.call(name, *args) returns the sketch function's value
  [P3] where files written here end up (container path) and how to copy them out
"""
import csv
import os
import time

from arduino.app_utils import App, Bridge   # [P1]

RECORD = os.environ.get("RECORD", "readings.csv")
HOT = 30.0                                   # only for the LED test


def read_sensor():
    """The function node.py expects: {"temp": C, "hum": %}."""
    return {"temp": float(Bridge.call("read_temp")),   # [P2]
            "hum": float(Bridge.call("read_hum"))}


def set_color(r, g, b):
    Bridge.call("set_pixels", int(r), int(g), int(b))


_new = not os.path.exists(RECORD)
_f = open(RECORD, "a", newline="")
_w = csv.writer(_f)
if _new:
    _w.writerow(["time", "temp", "hum"])
_t0 = time.time()


def loop():
    try:
        v = read_sensor()
    except Exception as e:                   # bridge hiccup: keep going
        print("read failed:", e)
        time.sleep(1)
        return
    t = round(time.time() - _t0, 2)
    _w.writerow([t, v["temp"], v["hum"]])
    _f.flush()
    print(f"{t:7.1f}s  temp={v['temp']:.2f}  hum={v['hum']:.1f}", flush=True)
    set_color(*((60, 0, 0) if v["temp"] > HOT else (0, 40, 0)))
    time.sleep(1)


App.run(user_loop=loop)                       # [P1]
