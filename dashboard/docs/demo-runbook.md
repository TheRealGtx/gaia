# Gaia live demo runbook

## Fixed ports and ownership

| Service | Bind | Purpose |
| --- | --- | --- |
| Arduino nodes | UDP broadcast `:5005` | One JSON heartbeat per node per second |
| Gaia gateway | UDP `0.0.0.0:5005` + HTTP/WebSocket `0.0.0.0:8000` | Read-only normalization and browser stream |
| Gaia frontend | HTTP `:3000` | Next.js dashboard |

The physical manifest is `gateway/node_manifest.json`: node `1` → `A-01` and node `2` → `A-02`. Live mode renders only these two active boards.

## Startup order

1. Power the nodes first and connect both boards and the demo laptop to the same hotspot.
2. On each board's **host OS**, not inside the App Lab app, start the node in UDP broadcast mode on port `5005`:

   ```bash
   cd gaia && git pull
   NODE_ID=1 NEIGHBORS=2 python3 aggregate/node.py     # board 1
   NODE_ID=2 NEIGHBORS=1 python3 aggregate/node.py     # board 2
   ```

   Do not use the laptop-only unicast mode (`5000 + id`), because the gateway does not listen there. The App Lab container cannot reach the board's Wi-Fi broadcast interface.

   Check the opening lines before continuing: `anomaly=...` identifies what drives the anomaly, and `my address 10.118.94.x, sending to ...` confirms that packets leave through Wi-Fi. If a board has no console, prefix the command with `ANOMALY=1`; do this on **both** boards for the consensus-alert recording.
3. From `dashboard/`, start the observer gateway:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r gateway/requirements.txt
   uvicorn gateway.main:app --host 0.0.0.0 --port 8000
   ```

4. In a second terminal, start the frontend:

   ```bash
   cp .env.example .env.local
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`, choose **Live**, and keep **Building A** selected.

For the closest laptop-only rehearsal, start the gateway and browser, then run `python3 aggregate/sim.py --scenario consensus --broadcast` from the repository root. This launches real `node.py` processes with the actual protocol, gradient, parameter cadence, and duplicate datagrams, and exercises both the alert and its recovery. Use `--scenario alert --broadcast --keep` when the single-source gradient must remain on screen. For a bounded hand-authored packet check, `python3 demo/fake_nodes.py --scenario nominal --count 30` still follows the 15-heartbeat parameter cadence. Stop either simulator before starting physical-board broadcasts so fake IDs do not compete with physical IDs 1–2.

## What the operator must see

- Exactly two live nodes; no unused third grey sensor.
- `dist 0` red, `dist 1` amber, and `dist 2–98` green. `dist >= 99` is green with no active hazard and grey/unknown only when another node reports a hazard.
- Evacuation guidance comes from `escape_to`, not from choosing the largest `dist` in the browser.
- A node becomes offline four seconds after its last gateway receipt; the last reading remains visible.
- `simulated: true` is labeled **Simulated input · not measured**.
- Below `n = 20`, the model reads **learning (n/20)** instead of showing `mu` as a learned temperature.
- Missing counters read **Awaiting counters**. Zero counters remain a real zero.
- Present Green AI as: **sharing what each node learned costs less than shipping its readings away to train a central model**. Do not claim that total network traffic fell by the displayed percentage; dashboard readings remain local heartbeat telemetry.
- The exact claim remains visible: `Dashboard is read-only: the network works without it.`

## Three-minute failure rehearsal

- [ ] Nominal: both heartbeats visible and the banner says `ALL CLEAR`.
- [ ] Gradient: heat one board; it becomes `dist 0`, the second board reports `dist 1`, both LEDs reflect the gradient, and no node claims consensus `alert`.
- [ ] Consensus alert: heat both adjacent boards; both report `dist 0` and `alert: true`, both LEDs are red, and the banner says `ALERT`.
- [ ] Guidance: while only one board is hot, the selected source points to the node in its `escape_to` field.
- [ ] Self-healing: unplug one board for more than four seconds; it turns grey while the others keep updating.
- [ ] Rejoin: reconnect the board; a new packet restores it even if its `ts` restarted at a lower value.
- [ ] Unknown path: while a hazard is active, show another node at `dist 99`; it is grey and never named the safest area.
- [ ] Dashboard independence: close the browser/laptop view and verify the LEDs and node communication continue.
- [ ] Counter reset: restart one model; Green AI totals never become a negative saving.

## Recovery

- If the frontend stops, restart `npm run dev`; node operation is unaffected.
- If WebSocket status is disconnected, verify `http://localhost:8000/health`, then restart Uvicorn.
- If no packets arrive, verify broadcast mode, the hotspot subnet, UDP port `5005`, and macOS firewall permissions.
- If packets are still silent, run `python3 aggregate/netcheck.py` on both machines at the same time. If the access point blocks broadcast, add an explicit peer such as `PEERS=2=10.118.94.52` to board 1 and the corresponding `PEERS=1=<board-1 Wi-Fi address>` to board 2.
- If a node stays grey after rejoin, inspect gateway receipt traffic; node `ts` is diagnostic only and never gates acceptance.

## Verification commands

Run from `dashboard/` before recording:

```bash
npm test
npm run typecheck
npm run build
python3 -m unittest discover -s gateway/tests -v
python3 -m unittest discover -s demo/tests -v
```

The physical-board rehearsal, hotspot address, and backup video must be completed on the demo laptop because they require the Arduino hardware and local network.
