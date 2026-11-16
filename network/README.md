# GaiaMesh, step by step

The commands to move the boards from the laptop's Windows hotspot to GaiaMesh,
the ad-hoc network with no access point: boards and laptop are peers, and
closing the laptop leaves the mesh running. The why and the background are in
[`HANDOFF-linux.md`](../HANDOFF-linux.md).

| | |
| --- | --- |
| SSID | `GaiaMesh`, channel 6, 2.4 GHz, no password |
| Board N | `10.77.0.N` (N = its `NODE_ID`) |
| Laptop | `10.77.0.100` |
| Internet | none: the laptop has one Wi-Fi radio |

The order matters: **Linux with internet → Windows → Linux again within the
test window.** Windows cannot join GaiaMesh (its Wi-Fi driver has no IBSS), so
it is only the way to reach the boards while they are still on the hotspot.

---

## Step 0 — Windows, before anything: push

Whatever the boards and Linux need must be on GitHub first:

```bash
git push
```

## Step 1 — Linux, on a normal Wi-Fi with internet

Everything that needs internet happens now.

```bash
git clone https://github.com/TheRealGtx/gaia ~/gaia     # first time only
```

```bash
cd ~/gaia && git pull
```

```bash
cd ~/gaia/dashboard && npm install
```

```bash
cd ~/gaia/dashboard && python3 -m venv .venv && .venv/bin/pip install -r gateway/requirements.txt
```

Check that the laptop's card can do ad-hoc (look for `IBSS` under
"Supported interface modes"):

```bash
iw list | grep -A 10 "Supported interface modes"
```

Optional: install Claude Code here now, if you want it on Linux.

## Step 2 — Windows: send the boards to GaiaMesh, on trial

On **each** board, over SSH on the hotspot (board 1 = `.180`, board 2 = `.25`,
board 3 = `.182`, a fourth one at its own address):

```bash
ssh arduino@192.168.137.180
```

```bash
cd ~/gaia && git pull && sudo ./network/board_mode.sh adhoc --test 45
```

- The SSH session drops: that is the board leaving the hotspot.
- `--test 45`: whatever happens, the board goes back to the hotspot by itself
  after 45 minutes.
- Do all the boards one after the other, then reboot straight into Linux: each
  board's 45 minutes start when you switch it.

## Step 3 — Linux: join GaiaMesh and check

```bash
cd ~/gaia && ./network/pc_join.sh
```

With a fourth board:

```bash
cd ~/gaia && BOARDS="1 2 3 4" ./network/pc_join.sh
```

It joins GaiaMesh as `10.77.0.100`, pings every board, checks the firewall and
shows a few seconds of heartbeats. If `nmcli` refuses, run it again with
`sudo`. If it reports a firewall, open the heartbeat port:

```bash
sudo ufw allow 5005/udp                 # if ufw
```

```bash
sudo firewall-cmd --add-port=5005/udp   # if firewalld
```

**If a board is SILENT or nothing works: stop here and do nothing.** When the
45 minutes run out every board is back on the hotspot; reboot into Windows and
you are where you started.

## Step 4 — Linux: make it permanent

Only when every board answers and the heartbeats arrive. One board at a time
(on a board already on GaiaMesh this only cancels the way back; the SSH session
does not drop):

```bash
ssh arduino@10.77.0.1 'cd gaia && sudo ./network/board_mode.sh adhoc'
```

```bash
ssh arduino@10.77.0.2 'cd gaia && sudo ./network/board_mode.sh adhoc'
```

```bash
ssh arduino@10.77.0.3 'cd gaia && sudo ./network/board_mode.sh adhoc'
```

```bash
ssh arduino@10.77.0.4 'cd gaia && sudo ./network/board_mode.sh adhoc'   # if there is a fourth
```

Check one:

```bash
ssh arduino@10.77.0.1 'cd gaia && ./network/board_mode.sh status'
```

It should say `gaia-adhoc`, address `10.77.0.1/24`, and no scheduled return.

## Step 5 — Linux: dashboard and Gemma

Three terminals.

```bash
cd ~/gaia/dashboard && .venv/bin/python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000
```

```bash
cd ~/gaia/dashboard && npm run dev
```

```bash
cd ~/gaia && OLLAMA=http://10.77.0.3:11434,http://10.77.0.1:11434,http://10.77.0.2:11434 dashboard/.venv/bin/python gemma/report.py
```

Open http://localhost:3000, page **Live field**, switch to **Live**.

## Step 6 — the test that matters

1. Heat one sensor: its LEDs and the dashboard turn red, the neighbours point
   away.
2. **Close the laptop.** The boards keep talking: heat a sensor again and the
   LEDs still change.
3. Open it: the dashboard catches up within seconds. If Linux suspended with
   the lid and came back on another network (or none), rejoin with
   `sudo nmcli con up gaia-adhoc`. To keep the dashboard live with the lid
   closed instead, set KDE's *Power Management → When laptop lid closed → Do
   nothing*.

---

## When something is off

| Symptom | Fix |
| --- | --- |
| Boards answer ping, dashboard empty | firewall on UDP 5005 (step 3) |
| Two boards do not hear each other | split ad-hoc cell: `python3 aggregate/netcheck.py` on both, then `sudo nmcli con up gaia-adhoc` on one |
| `WARNING: another node is using NODE_ID` | two boards with the same id, so the same IP: fix `/etc/gaia/board.env` |
| A board's state | `./network/board_mode.sh status` on it |
| Need internet on Linux | phone plugged in with USB tethering |
| Watch a node | `ssh arduino@10.77.0.N 'journalctl -u gaia-node -f -o cat'` |

## Going back to the hotspot

**From Linux, while still on GaiaMesh**, for each board:

```bash
ssh arduino@10.77.0.1 'cd gaia && sudo ./network/board_mode.sh hotspot'
```

(and `10.77.0.2`, `10.77.0.3`, `10.77.0.4`), then leave GaiaMesh and boot
Windows: the boards join its hotspot as soon as it is on.

```bash
cd ~/gaia && ./network/pc_join.sh leave
```

Not the other way round: from Windows a board on GaiaMesh cannot be reached,
and a power cycle keeps it on GaiaMesh.
