# Starting Gaia

Everything needed to bring the system up, in order: network, nodes, dashboard,
AI, then the demo itself. The setup described here is the current one: the
boards on the Windows hotspot of the laptop. For the version with no access
point at all (GaiaMesh, laptop on Linux), the commands are in
[`network/README.md`](network/README.md) and the background in `HANDOFF-linux.md`.

---

## 0. Once per board (already done, here for a new or wiped board)

In this order: the App Lab step must come before the sketch, because running
an App Lab app replaces the sketch on the microcontroller.

**a. App Lab, over USB.** The first time, App Lab sets the board's name
(`Node4`, …), its Linux password and its Wi-Fi: choose the laptop's hotspot
`MSI 9439` (section 1). Then run any example app once and stop it. That
download is the point: it brings App Lab's Python image onto the board, and
step d copies the Bridge library out of it. A board that never ran an app has
nothing to copy.

**b. The sketch, from the Arduino IDE over USB** (over the network the IDE
uses SSH and fails on the password): open
`app_lab/echofield_node/sketch/sketch.ino`, board **Arduino UNO Q**
(`arduino:zephyr`), port = the USB one, libraries `Arduino_RouterBridge` and
`Arduino_Modulino` with all its dependencies (*Install all*), Upload.

**c. The repository**, on the board over SSH (`ssh arduino@<address>`; the
address is in the hotspot's device list):

```bash
git clone https://github.com/TheRealGtx/gaia ~/gaia
```

**d. The Bridge for the board's Python:**

```bash
cd ~/gaia/app_lab/echofield_node
./setup_bridge.sh                              # asks for the sudo password
sudo usermod -aG arduino-router arduino        # only if the script says NO; then log in again
```

If it stops at step 1 with `not found`, step a did not run an app. Either run
one, or copy the library from a board that already has it (same Python
version, `python3 --version` on both):

```bash
scp -r arduino@192.168.137.180:gaia/.bridge ~/gaia/
cd ~/gaia && PYTHONPATH=.bridge/site-packages python3 -c "from arduino.app_utils import App, Bridge" && echo bridge ok
```

**e. The services**, with the board's id and its neighbours:

```bash
sudo ./install_service.sh 1 2                  # board 1, neighbour 2
```

Board 2 is `sudo ./install_service.sh 2 1,3`, board 3 is `sudo ./install_service.sh 3 2`.
From then on the board starts by itself at power-on.

**A board with a new id** (a fourth one) also needs:

- its id added to `NEIGHBORS` in `/etc/gaia/board.env` on every board it is
  linked to, then `sudo systemctl restart gaia-node` there: links go both ways;
- an entry in `dashboard/gateway/node_manifest.json` and in
  `dashboard/src/live/liveManifest.ts`, or the dashboard ignores it;
- a row in the table of section 2, and `BOARDS="1 2 3 4"` for
  `network/pc_join.sh` on GaiaMesh.

Gemma on the board is optional: `gemma/README.md`.

## 1. Network: the laptop's hotspot

On the laptop (Windows): **Settings → Network & Internet → Mobile hotspot → On**.
Network name `MSI 9439`. Before a demo also:

- turn **off** the hotspot's power saving (it switches itself off when it sees
  no device for a while);
- keep the laptop **on AC power**, and set *Power options → When I close the
  lid → Do nothing*: closing the lid must not take the boards' Wi-Fi with it.

## 2. Nodes: power the boards

Plug each board into its power bank. Nothing else: `gaia-node` and
`gaia-sensor` start by themselves and the boards join the hotspot. Give them
about a minute. Addresses on the hotspot:

| Board | Address | NEIGHBORS |
| --- | --- | --- |
| 1 | 192.168.137.180 | 2 |
| 2 | 192.168.137.25 | 1,3 |
| 3 | 192.168.137.182 | 2,4 |
| 4 | see `listen.py` | 3 |

The addresses come from the hotspot and can change; `listen.py` below shows
the current ones.

**Check from the laptop**, in the repository folder:

```bash
python aggregate/listen.py
```

You should see `id=1`, `id=2` and `id=3`, each about once a second
(Ctrl-C to stop).

**Check on a board**, over SSH:

```bash
systemctl is-active gaia-node gaia-sensor          # both: active
journalctl -u gaia-node -f -o cat                  # the node's status line
journalctl -u gaia-sensor -f -o cat                # readings, sent to the node
```

**After a code update**, on each board:

```bash
cd ~/gaia && git pull && sudo systemctl restart gaia-node gaia-sensor
```

If `install_service.sh` changed, run it again instead of the restart. If the
sketch changed, flash it again over USB.

## 3. Dashboard (laptop)

First time on this laptop only:

```bash
cd dashboard
npm install
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r gateway\requirements.txt
```

Then two terminals, both in `dashboard`. The gateway first:

```bash
.venv\Scripts\python.exe -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000
```

then the frontend:

```bash
npm run dev
```

Open **http://localhost:3000**, page **Live field**, button **Switch to Live**.
Three circles, `3/3 on the air`, ALL CLEAR.

## 4. AI: Gemma situation report

Gemma 3 1B runs on the boards through Ollama (to install it on a board:
`gemma/README.md`). `gemma/report.py` runs **on the laptop**, next to the
gateway: started on a board it fails with `Connection refused`. A third
terminal, from the repository folder, after the gateway.

Windows (PowerShell):

```powershell
$env:OLLAMA = "http://192.168.137.182:11434,http://192.168.137.180:11434,http://192.168.137.25:11434"
dashboard\.venv\Scripts\python.exe gemma\report.py
```

Linux or macOS:

```bash
OLLAMA=http://192.168.137.182:11434,http://192.168.137.180:11434,http://192.168.137.25:11434 dashboard/.venv/bin/python gemma/report.py
```

It logs `Gemma ready at ...` for each board. The template sentence reaches the
dashboard at once; Gemma's replaces it about 20-25 s after the field changes.
End boards first in the list, the middle one last: the board writing a
sentence works hard for about 24 s, and a middle board falling behind would
split the line. If no board answers, the template stays.

## 5. The demo

| Step | Do | Boards show | Dashboard (Live field) shows |
| --- | --- | --- | --- |
| Quiet | nothing | blue LEDs, a quiet dot on the matrix | three nodes, ALL CLEAR |
| One source | warm board 1 with the hair dryer (at least 30 s after power-on: the model needs 20 readings first) | 1 red with arrow and flashing border, 2 amber, 3 green, arrows pointing away | `0`, `1`, `2`, banner ALERT |
| Consensus | warm boards 1 and 2 together | both red | both sources, consensus alert |
| Cool down | take the heat away | back to blue within seconds | ALL CLEAR again |
| A node dies | unplug board 2 | board 3 loses its path, goes blue | board 2 offline, board 3 shows `?` |
| It comes back | plug board 2 in | after about a minute, the gradient is back | three nodes again |
| No dashboard | stop the gateway (Ctrl-C) and close the browser, **not the laptop** | they keep reacting to heat | nothing, by design |

LED colours: red = this board is the hazard, amber = one hop away, green =
further away, blue = no hazard known, dim white = the sensor app gets no
answer from its node.

## 6. When something is off

| Symptom | Look at |
| --- | --- |
| A board missing from the dashboard | `python aggregate/listen.py`: if its id shows there, the dashboard drops it (its id must be in `dashboard/gateway/node_manifest.json` **and** `dashboard/src/live/liveManifest.ts`); if it does not, the board is not transmitting: `python aggregate/netcheck.py` |
| A board at `20.0°` marked *sim* | its sensor app sends nothing: `journalctl -u gaia-sensor -n 20 -o cat` on it. `read_temp not available` = flash the sketch again |
| Gateway: `[Errno 10048]` | a gateway is already running: close it, or use that one |
| `ignored:{N: ...}` in a node's log | that node hears board N but N is not in its `NEIGHBORS` (fine for 1 and 3 in a line) |
| `WARNING: another node is using NODE_ID` | two boards with the same id: fix `/etc/gaia/board.env`, then restart both services |
| Matrix dark or very dim | the sketch on that board predates the brightness fix: flash it again |
| A board stuck, or disk full | `df -h /` on it (board 3 filled up with Ollama's CUDA libraries once: `gemma/README.md`) |
| Only `Template:` sentences, never `Gemma:` | `curl http://<board>:11434/api/tags` from the laptop; no answer = `sudo systemctl restart ollama` on that board |

## 7. Shutting down

Ctrl-C in `report.py` and in the two dashboard terminals. Boards: unplug them; next time they
start by themselves.
