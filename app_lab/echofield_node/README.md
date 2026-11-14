# Gaia sensor app (Chuqi)

On each board the sketch on the microcontroller owns all the hardware (the
Modulino Thermo, the Pixels, the LED matrix). `python/main.py` runs on the
board's Linux, reads it over the Arduino Bridge, and talks to
`aggregate/node.py` on the same board:

```
MCU sketch  <--Bridge-->  python/main.py  <--UDP 127.0.0.1:5006-->  aggregate/node.py
```

| Bridge call | Direction | What |
| --- | --- | --- |
| `read_temp()` | MCU -> Python | float, °C |
| `read_hum()` | MCU -> Python | float, % RH |
| `set_pixels(r, g, b)` | Python -> MCU | colour of the RGB LEDs and Pixels |
| `show_state(dist, dir)` | Python -> MCU | what the LED matrix draws |

Once a second `main.py` sends `{"temp", "hum"}` to the node and gets back
`{"id", "dist", "alert", "escape_to", "via", "anomaly"}`. The board's lights
show what the network decided, never a local temperature threshold:

- **LEDs**: red = this board is the hazard, amber = one hop away, green =
  further, blue = no hazard known, dim white = the node is not answering.
- **Matrix**: an arrow towards the way out (`escape_to`; an end board points
  away from the neighbour the alarm came from). The hazard board shows its
  arrow with a flashing border, and blinks entirely when it has no safer
  neighbour. A quiet dot when no hazard is known, an X when the node is not
  answering.

Boards stand in a line 1-2-3 from left to right, so "escape to a higher id"
is an arrow to the right; `ARROW_FLIP=1` if the line is laid out the other way.

## Setting up a board (once)

Full steps, in order, are in `START.md` §0. In short:

0. **Run any App Lab app once**, before the sketch (an App Lab app replaces
   it): that brings App Lab's Python image onto the board, which step 2
   copies the Bridge from. Or copy `~/gaia/.bridge` from a board that has it.
1. **Flash the sketch** from the Arduino IDE **over USB** (over the network
   the IDE uses SSH and fails on the password). Board package *Arduino UNO
   Q*; libraries `Arduino_RouterBridge` and `Arduino_Modulino` with all its
   dependencies (*Install all*).
2. **Give the board's Python the Bridge**: `./setup_bridge.sh`. The board has
   no `arduino.app_utils` and no `pip`; the script copies the library out of
   App Lab's docker image into `~/gaia/.bridge`, checks the import, and checks
   the `arduino-router` group, which the Bridge socket needs:
   `sudo usermod -aG arduino-router arduino`, then log in again.
3. **Install the services**: `sudo ./install_service.sh 1 2` (board 2:
   `2 1,3`, board 3: `3 2`). `gaia-node` and `gaia-sensor` then start at
   power-on, restart by themselves, and have priority over anything else on
   the board (Gemma included).

## Running

```bash
journalctl -u gaia-node -f -o cat      # the node's status line
journalctl -u gaia-sensor -f -o cat    # readings, and the node's answer
sudo systemctl restart gaia-node gaia-sensor
```

`main.py` prints where it expects the node at start:
`node.py expected at 127.0.0.1:5006 (board OS, e.g. over SSH)`. If a reading
fails it says why (`read_temp not available` = flash the sketch again), and a
failing matrix call is logged once.

`./run_board.sh 2 1,3` starts both by hand instead, for debugging; it refuses
while the services run (`sudo ./install_service.sh --remove` to go back).

## Calibration

Every reading goes to `readings.csv` in this folder (`RECORD=<name>` to change
it); the file is appended to, never reset. With the services:
`sudo systemctl stop gaia-sensor`, `rm readings.csv`, start it, record, stop,
and rename the file. Record ~5 min at room temperature (`normal.csv`) and
~1 min with the heat source at demo distance (`hazard.csv`), then on a laptop:
`python sensing_ml/calibrate.py normal.csv hazard.csv`.

`GAIA_MODE=test` is a wiring check without a node (LEDs red above 30 °C). It
is a fixed threshold, exactly what the project says it does not do: never use
it in the demo.

## Inside App Lab instead

`main.py` also runs as an App Lab app and notices it by itself. App Lab runs it
in a container on a docker bridge (172.18.0.2) whose broadcasts never reach the
Wi-Fi, so the node cannot run there: it runs on the board's OS and `main.py`
reaches it at the container's gateway. `NODE_HOST` overrides the address. This
is how the project started; the demo uses the setup above.
