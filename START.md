# Starting Gaia

Everything needed to bring the system up, in order: network, nodes, dashboard,
AI, then the demo itself. The setup described here is the current one: the
boards on the Windows hotspot of the laptop. For the version with no access
point at all (GaiaMesh, laptop on Linux), see `HANDOFF-linux.md`.

---

## 0. Once per board (already done, here for a new or wiped board)

Flash the sketch from the Arduino IDE **over USB** (over the network the IDE
uses SSH and fails on the password): open
`app_lab/echofield_node/sketch/sketch.ino`, board **Arduino UNO Q**, port = the
USB one, Upload. Then on the board, over SSH:

```bash
cd ~/gaia/app_lab/echofield_node
./setup_bridge.sh                              # copies the Bridge library out of App Lab
sudo usermod -aG arduino-router arduino        # then log out and back in
sudo ./install_service.sh 1 2                  # board 1, neighbour 2
```

Board 2 is `sudo ./install_service.sh 2 1,3`, board 3 is `sudo ./install_service.sh 3 2`.
From then on the board starts by itself at power-on.

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
| 3 | 192.168.137.182 | 2 |

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
