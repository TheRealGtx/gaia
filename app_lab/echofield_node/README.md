# Gaia node, App Lab app (Chuqi)

One App Lab app per board, the same files on every board. The MCU sketch owns
**all** hardware (Thermo + Pixels), because a board runs only one sketch.

```
MCU sketch  <--Bridge-->  python/main.py (App Lab container)  <--UDP 5006-->  aggregate/node.py (board host)
```

| Bridge name | Side | Returns |
| --- | --- | --- |
| `read_temp()` | MCU -> Python | float °C |
| `read_hum()` | MCU -> Python | float %RH |
| `set_pixels(r,g,b)` | Python -> MCU | nothing |

`main.py` is a sensor client: once a second it sends `{"temp", "hum"}` to
`node.py` on the board's host OS and colours the LEDs from the answer
(`dist` / `alert`). The node and the model do **not** run in this app: App Lab
runs it in a container (172.18.0.2) whose broadcasts never reach the Wi-Fi.

## Per board

1. App Lab app: `sketch/sketch.ino`, `python/main.py`, and the sketch library
   `Arduino_Modulino`. Nothing else (no `node.py`, no `sensing_ml/`).
2. Board host (ssh / adb shell), from the repo:
   `NODE_ID=1 NEIGHBORS=2 python3 aggregate/node.py` (2 -> `1,3`, 3 -> `2`).
3. Run the app. Its log shows `node N is answering`, then one line per second
   with `temp`, `anom`, `dist`. The node's log shows
   `sensor bridge: first reading from 172.18.0.2`.

LEDs: red = hazard here, amber = one hop, green = further, blue = no hazard
known, dim white = `node.py` is not answering.

## Calibration

Every reading goes to `readings.csv` in the app folder (`RECORD=<name>` to
change it). Record ~5 min at room temperature (`normal.csv`) and ~1 min with
the heat source at demo distance (`hazard.csv`), then on a laptop:
`python sensing_ml/calibrate.py normal.csv hazard.csv`.

`GAIA_MODE=test` is a wiring check without a node (LEDs red above 30 °C). Never
use it in the demo.
