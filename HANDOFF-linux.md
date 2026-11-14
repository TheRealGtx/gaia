# Handoff: moving the demo to GaiaMesh, no access point

For whoever continues on the Linux side of the laptop, a person or a new
Claude Code session: read this top to bottom before touching a board. Written
Saturday 14/11 at night, from the Windows session that built most of this.

## Where things stand (all verified on the hardware)

- **Three UNO Q boards**, each running two systemd services that start at
  power-on and restart by themselves: `gaia-node` (aggregate/node.py, the
  network) and `gaia-sensor` (app_lab/echofield_node/python/main.py, Modulino
  and LEDs over the Bridge). A reboot was tested: everything comes back.
- The sketch is flashed from the **Arduino IDE over USB** (over the network
  the IDE uses SSH and fails on the password). The Python Bridge comes from
  App Lab's docker image, copied by `setup_bridge.sh` into `~/gaia/.bridge`.
- Real readings on all boards, Chuqi's model calibrated on Node3 (normal max
  0.13, a hair dryer is detected in about a second).
- **Gemma 3 1B runs on all three boards** through Ollama (`gemma/README.md`);
  `gemma/report.py` runs on the laptop next to the gateway and asks the first
  board that answers. The models are already downloaded, which matters: on
  GaiaMesh nothing has internet.
- **Network today**: the Windows hotspot of this laptop, "MSI 9439",
  192.168.137.x. Board 1 = .180, board 2 = .25, board 3 = .182. Phone hotspots
  isolate their clients, so they do not work.
- **Dashboard**: `dashboard/`, Next.js on :3000 plus a Python gateway on :8000
  that listens to the boards on UDP :5005. The **Live field** page is the
  network graph used for the demo.
- Everything is on GitHub: chuqi-gogo/gaia, branch main.

## Why GaiaMesh

The pitch says the network needs nothing but the boards. With the Windows
hotspot that is not true: close the laptop and the boards lose their Wi-Fi.
The boards' radios support IBSS (ad-hoc), and so does this laptop's card
**under Linux**. Under Windows its driver reports `IBSS: Non supportato`,
which is the whole reason for this file. On GaiaMesh boards and laptop are
peers: closing the laptop leaves the mesh untouched.

Addresses are fixed, there is no DHCP: board N is `10.77.0.N`, the laptop is
`10.77.0.100`. SSID `GaiaMesh`, channel 6, 2.4 GHz.

node.py needs no change: it re-reads its network interfaces every 10 s, so on
the switch its log just says `network changed: now sending to ... 10.77.0.255`.

## The procedure

**Phase 1, Linux with internet** (any normal Wi-Fi). On GaiaMesh the laptop has
no internet, because it has one radio, so do this first:

```bash
cd ~/gaia && git pull            # or git clone https://github.com/chuqi-gogo/gaia
cd dashboard && npm install
python3 -m venv .venv && .venv/bin/pip install -r gateway/requirements.txt
```

**Phase 2, back in Windows**, the only side that reaches the boards today. On
each board, over SSH:

```bash
cd ~/gaia && git pull && sudo ./network/board_mode.sh adhoc --test 30
```

The SSH session drops: that is the board leaving the hotspot. `--test 30`
means it returns to the hotspot by itself in 30 minutes whatever happens.

**Phase 3, reboot into Linux within those 30 minutes**:

```bash
cd ~/gaia && ./network/pc_join.sh
```

It joins GaiaMesh, pings the boards, warns if a firewall would drop the
heartbeats, and shows a few seconds of them. If all three answer, make them
permanent, one board at a time:

```bash
ssh arduino@10.77.0.1 'cd gaia && sudo ./network/board_mode.sh adhoc'
ssh arduino@10.77.0.2 'cd gaia && sudo ./network/board_mode.sh adhoc'
ssh arduino@10.77.0.3 'cd gaia && sudo ./network/board_mode.sh adhoc'
```

Then the dashboard, in two terminals:

```bash
cd ~/gaia/dashboard && .venv/bin/python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000
cd ~/gaia/dashboard && npm run dev
```

Open http://localhost:3000, page **Live field**, switch to Live. Then Gemma,
in a third terminal (the boards' new addresses, end boards first):

```bash
cd ~/gaia && OLLAMA=http://10.77.0.3:11434,http://10.77.0.1:11434,http://10.77.0.2:11434 dashboard/.venv/bin/python gemma/report.py
```

**If anything fails in phase 3, do nothing.** Within 30 minutes every board is
back on the hotspot; reboot into Windows and you are where you started.

## Going back to the hotspot, later

From Linux, while still on GaiaMesh:

```bash
ssh arduino@10.77.0.N 'cd gaia && sudo ./network/board_mode.sh hotspot'
```

for each board, **then** boot Windows: the boards join its hotspot as soon as
it appears. The order matters. From Windows a board on GaiaMesh is
unreachable, and a power cycle keeps it on GaiaMesh, because that is the
profile it starts with.

## Things that will bite

- **No internet on GaiaMesh.** Plug a phone in with USB tethering if you need
  Claude, GitHub or npm.
- **Firewall.** firewalld or ufw on the laptop drop UDP 5005: the boards answer
  pings and the dashboard stays empty. `pc_join.sh` prints the command to open
  the port.
- **New addresses.** `ssh arduino@10.77.0.N`, not the 192.168.137.x ones.
- **Split cells.** Rarely, two boards on GaiaMesh form two separate ad-hoc
  cells and do not hear each other. `python3 aggregate/netcheck.py` on both
  shows it; `sudo nmcli con up gaia-adhoc` on one of them usually merges them.
- **Wrong NODE_ID.** It sets the board's address too: two boards with the same
  id fight over one IP. node.py prints a WARNING naming the other one.
- **A board checked with** `./network/board_mode.sh status` tells which network
  it is on and whether a return to the hotspot is still scheduled.

## The sentence for the pitch, now true

> "The boards run on batteries and talk to each other directly, ad-hoc: no
> router, no access point, no cloud. The laptop is just one more node on that
> network, showing what the boards decide. Watch: I close it."

## Where to read more

`START.md` (bringing everything up, the demo, troubleshooting),
`aggregate/README.md` (the nodes, every setting, the three ports),
`app_lab/echofield_node/README.md` (flashing, the Bridge, the services),
`gemma/README.md` (Gemma on the boards). Tools: `aggregate/sim.py` (a whole field of real
nodes on one laptop), `aggregate/netcheck.py` (why nodes cannot hear each
other), `aggregate/check_dashboard.py` (does the dashboard accept what the
nodes send).
