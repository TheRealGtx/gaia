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

## Without App Lab: flash with the Arduino IDE, run over SSH

What the mentors suggested, and what gets the Python out of the App Lab
container, whose network cannot reach the Wi-Fi. On the board's own OS the
node and this app run side by side and talk over 127.0.0.1.

**1. Flash the sketch** with the Arduino IDE: install the Arduino UNO Q board
package, then the `Arduino_RouterBridge`, `Modulino` and `Arduino_LED_Matrix`
libraries from the Library Manager, open `sketch/sketch.ino` and upload. The
Bridge calls are the ones in Arduino's own example (`Bridge.begin()`, then
`Bridge.provide("name", fn)` in `setup()`), so `[B1]` in the sketch is settled.

**2. Put the board on the hotspot and SSH into it.** Get the repository there
(`git clone` or `git pull`): the run script needs `aggregate/` next to
`app_lab/`, because the node and the model live there.

**3. Give the board's Python the Bridge**, once per board:

```bash
./setup_bridge.sh
```

The board's `python3` has no `arduino.app_utils` and no `pip`: the library
ships inside App Lab's docker image. The Bridge itself does not: arduino-router
runs on the board and listens on `/run/arduino-router.sock`, the container only
mounts it. So the script copies the image's `site-packages` into `.bridge/`
(the image's Python is 3.13, the board's too), checks the import works, and
checks your user may open the socket. If it says you are not in the
`arduino-router` group, run the `usermod` line it prints and log in again,
otherwise every Bridge call fails with "permission denied". `main.py` points
here if you skip this step.

**4. Start the board**, one line per board, from `app_lab/echofield_node/`:

```bash
./run_board.sh 1 2        # board 1, neighbour 2
./run_board.sh 2 1,3      # board 2, neighbours 1 and 3
./run_board.sh 3 2        # board 3, neighbour 2
```

The script starts `node.py` in the background, checks it came up,
then runs `main.py` in the foreground; Ctrl-C stops both. The node's own status
lines go to `/tmp/gaia-node-<id>.log`: watch them from a second SSH session with
`tail -f`.

**5. Check the two lines that matter.** `main.py` prints
`node.py expected at 127.0.0.1:5006 (board OS, e.g. over SSH)`: if it says
`App Lab container` instead, you are not where you think you are. The node log
starts with `my address 10.x.x.x, sending to ...`: that address must be the
Wi-Fi one. If the boards still cannot hear each other, run
`python3 aggregate/netcheck.py` on all of them at once.

`main.py` decides by itself which of the two worlds it is in (the App Lab
container or the board's OS), so the same file works in both. `NODE_HOST`
overrides the guess if it is ever wrong.

## Start at power-on, and come back by itself

Started by hand, a board stops when the SSH session closes and stays off after a
power cycle, so unplugging one to show self-healing means it never rejoins.
Once it works by hand, make it a service, once per board:

```bash
sudo ./install_service.sh 1 2        # board 1
sudo ./install_service.sh 2 1,3      # board 2
sudo ./install_service.sh 3 2        # board 3
```

That installs two services, `gaia-node` (the network) and `gaia-sensor` (the
Modulino and the LEDs). They start at power-on, restart by themselves within
seconds if they die, and need no SSH session. They are separate on purpose: a
Bridge hiccup can restart the LEDs, never the mesh. The node also re-reads its
network interfaces every 10 s, so a board that boots before its Wi-Fi is ready,
or rejoins the hotspot with another address, finds it again; its log then says
`network changed: now sending to ...`.

```bash
journalctl -u gaia-node -f                     # the node's status lines
journalctl -u gaia-sensor -f                   # readings and LED state
sudo systemctl restart gaia-node gaia-sensor   # after editing /etc/gaia/board.env
sudo ./install_service.sh --remove             # back to run_board.sh
```

The test that matters: `sudo reboot` one board, or pull its power and plug it
back. Within about a minute it is back in the field and in the Live field view,
with nobody touching a keyboard. While the services run, `run_board.sh` refuses
to start a second copy.
