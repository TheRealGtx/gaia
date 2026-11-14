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

Step 2 (already in `main.py`): `read_sensor()` stays in the app, NOT in `sensing_ml/model.py`
(Bridge only exists in App Lab; model.py also runs on laptops, in tests and in calibrate.py).
`main.py` starts `aggregate/node.py` in a thread with `node.main(sensor=read_sensor, score=anomaly_score)`
and the LEDs follow the network state (0 red, 1 amber, >=2 green, 99 blue).
The node's first line must say `anomaly=Chuqi's model on the sensor`.
Set `NODE_ID` / `NEIGHBORS` per board (1 -> `2`, 2 -> `1,3`, 3 -> `2`).
If node.py cannot be imported (repo not on the board, see [P4]) the app falls back to
test mode (30 °C LED threshold, for wiring only). `GAIA_MODE=test` forces it.

Lines marked `[B1] [B2] [M1] [P1] [P2] [P3] [A1]` are unverified API guesses:
compare with App Lab's built-in Modulino examples first.
