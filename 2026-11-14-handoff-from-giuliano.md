# What the others need to update — from the aggregate side

> **Historical scope note:** this handoff documents the thermal-hazard demonstrator built during the hackathon. It is implementation history, not the full scope of Gaia as an environmental intelligence platform. Current architecture and gaps are documented in [`README.md`](README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/IMPLEMENTATION_GAP_ANALYSIS.md`](docs/IMPLEMENTATION_GAP_ANALYSIS.md).

Giuliano, Saturday 14/11, 14:00. Everything in here came out of building and
testing the node side today; none of it is speculation, each point says how it
was observed.

Per-person detail stays in `dashboard/2026-11-14-update-for-pietro.md` and
`sensing_ml/2026-11-14-update-for-chuqi.md`. This is the short list of what is
still waiting on each of you, plus what landed on our side.

---

## Decision the three of us owe the demo: one heated board, or two?

Measured, with real node processes (`python3 aggregate/sim.py --scenario alert`
and `--scenario consensus`):

```
one source      1:[d=0  a=1.00]        2:[d=1  a=0.00]  3:[d=2  a=0.00]
two sources     1:[d=0  a=1.00 ALERT]  2:[d=0  a=1.00 ALERT]  3:[d=1  a=0.00]
```

With `AGREE_MIN = 1` a source needs a neighbour that agrees, so **heating one
board raises no `alert` anywhere**. The gradient still does everything visible:
`dist = 0` at the source, LEDs red, the dashboard banner goes ALERT through
`dist == 0`. But the sentence "a general alert only fires when several nearby
nodes agree", which is in our README and in the pitch, is not demonstrated.

My recommendation: **heat two adjacent boards on stage**, keep `AGREE_MIN = 1`,
and say the sentence while both LEDs go red. The alternative, `AGREE_MIN = 0`
for a single-board demo, makes the demo easier and the claim false.

Decide before the backup video, because it changes what the LEDs and the banner
do during the recording.

## Pietro

1. **`demo/scenarios.json`, the `alert` scenario, sends a packet the network
   cannot produce.** Node 1 has `anomaly: 1.0, alert: true` with its neighbours
   at 0.12: with `AGREE_MIN = 1` that node reports `alert: false`. Your tests
   therefore assert a shape that will never arrive. Either heat node 2 in that
   scenario too (then `alert: true` on both is correct, and it matches what we
   will do on stage), or set `alert: false` and let `dist == 0` drive the red,
   which is what the real boards do today.
2. **`nominal` is the scenario that shows the WARNING bug.** Every node at
   `dist: 99` is the resting state of a healthy field, and it is what the store
   currently maps to `unknown` and the banner turns into WARNING. So
   `python3 demo/fake_nodes.py --scenario nominal` is your one-command
   reproduction, and ALL CLEAR is what it must print. Details and the fix are in
   `dashboard/2026-11-14-update-for-pietro.md` §1.
3. **`simulated` still has no badge in the UI** (§2 there). Every reading on the
   network is simulated until Chuqi's sensor path lands.
4. **You can point the gateway at real nodes now**, no boards needed:
   `python3 aggregate/sim.py --scenario alert --broadcast --keep` runs three
   real `node.py` processes on UDP 5005. That is the actual protocol, with the
   real gradient, the parameter cadence and the duplicate datagrams, so it
   catches what a hand-written generator cannot.
5. **Already verified against your imported code** with
   `python3 aggregate/check_dashboard.py`, which feeds real packets to your
   parser and your store and judges the banner:

   ```
   quiet field     A-01[normal d=99 t=20.0 sim]  A-02[normal d=99 t=20.0 sim]  -> ALL CLEAR
   node 1 heated   A-01[critical d=0 t=50.0 sim] A-02[warning d=1 t=20.0 sim]  -> ALERT
   packets accepted: 20, rejected: 0
   ```

   So your status fix works, the simulated flag arrives, and nothing we send is
   refused. Re-run it whenever either side touches the contract.

## Chuqi

Everything is in `sensing_ml/2026-11-14-update-for-chuqi.md`, restored and
updated. The two that block checkpoints:

1. **The ten-line sensor client** (§2 there). The node side is built and tested:
   22.5 °C gives `dist 99`, 60 °C gives `dist 0` and the reply that turns the
   Pixels red. Until your side sends readings, the LEDs cannot follow the
   network and the 14:30 checkpoint stays open.
2. **Calibration** (§3). Until `normal.csv` and `hazard.csv` have been recorded
   and `calibrate.py` has set the knobs, "I heat the sensor and it fires" is a
   hope. This is the real constraint on the 17:00 checkpoint, not our code.

Also: the old `sensing_ml/2026-11-14-report-for-chuqi.md` is still in the repo
and its LED snippet reads `node.state` from inside your process — the
architecture that does not work on the board. If you open one of the two, open
the **update**.

## What landed on our side today

- `node.py`: the sensor bridge (UDP 5006, readings in, state out), parameters
  on the wire every 15 s with each node remembering its neighbours' last ones,
  the heartbeat carrying `temperature`/`humidity`/`simulated` and the byte
  counters, broadcast on every interface with the netmask read rather than
  guessed, and `ignored:{id: n}` in the status line when a node hears someone it
  does not have as a neighbour.
- `aggregate/sim.py`: a whole field of **real** node processes on one laptop.
  `nominal`, `alert`, `consensus`, `failure`, `rejoin`, `coldstart`, each with a
  verdict. All six pass. This is how we rehearse the 20:00 checkpoint without
  touching the boards.
- `aggregate/listen.py` and `aggregate/netcheck.py`: watch the traffic, and
  diagnose silence.
- `aggregate/README.md`: the contract, the three ports, every setting, and the
  two things that surprise people (a single hazard raises no alert; 99 is not
  "safe").

## For the runbook, Pietro — the node part

On each board, **on the host OS, not inside the App Lab app** (the app's
container cannot reach the Wi-Fi):

```bash
cd gaia && git pull
NODE_ID=1 NEIGHBORS=2 python3 aggregate/node.py        # board 1
NODE_ID=2 NEIGHBORS=1,3 python3 aggregate/node.py      # board 2
NODE_ID=3 NEIGHBORS=2 python3 aggregate/node.py        # board 3
```

Check the opening lines: `anomaly=...` says what drives the anomaly, and
`my address 10.118.94.x, sending to ...` says the packets leave through the
Wi-Fi. If a board has no console, `ANOMALY=1` in front starts it already in
anomaly. If nothing is heard, `python3 aggregate/netcheck.py` on each machine
at once gives the verdict; if the access point blocks broadcast, add
`PEERS=2=10.118.94.52` with the real addresses.

Start order: nodes first, then the gateway, then the browser. Closing the
dashboard changes nothing on the boards, which is the thing to show on stage.
