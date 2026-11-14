# EchoField node, App Lab app (Chuqi)

One App Lab app per board. The MCU sketch owns **all** hardware (Thermo + Pixels),
because a board runs only one sketch: Pietro's LED code goes into the same `sketch.ino`.

| Bridge name | Side | Returns |
| --- | --- | --- |
| `read_temp()` | MCU -> Python | float °C |
| `read_hum()` | MCU -> Python | float %RH |
| `set_pixels(r,g,b)` | Python -> MCU | nothing |

Step 1 (now): run the app, check the console prints one reading per second, LEDs go
green (red above 30 °C). Record `normal.csv` and `hazard.csv`, then on a laptop:
`python sensing_ml/calibrate.py normal.csv hazard.csv`.

Step 2: move `read_sensor()` into `sensing_ml/model.py` so `aggregate/node.py`
switches from the fake anomaly to the real score.

Lines marked `[B1] [B2] [M1] [P1] [P2] [P3] [A1]` are unverified API guesses:
compare with App Lab's built-in Modulino examples first.
