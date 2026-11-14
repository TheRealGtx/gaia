# Gaia live demo runbook

## Fixed ports and ownership

| Service | Bind | Purpose |
| --- | --- | --- |
| Arduino nodes | UDP broadcast `:5005` | One JSON heartbeat per node per second |
| Gaia gateway | UDP `0.0.0.0:5005` + HTTP/WebSocket `0.0.0.0:8000` | Read-only normalization and browser stream |
| Gaia frontend | HTTP `:3000` | Next.js dashboard |

The physical manifest is `gateway/node_manifest.json`: node `1` → `A-01` and node `2` → `A-02`. Live mode renders only these two active boards.

## Startup order

1. Power the nodes first and connect all boards and the demo laptop to the same hotspot.
2. Start the nodes in UDP **broadcast** mode on port `5005`. Do not use the laptop-only unicast mode (`5000 + id`), because the gateway does not listen there.
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

For a bounded laptop-only rehearsal, run `python3 demo/fake_nodes.py --scenario nominal --count 30`. It follows the real 15-heartbeat parameter cadence. Stop it before starting Arduino broadcasts so fake IDs do not compete with physical IDs 1–2.

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
- [ ] Hazard: the source becomes `dist 0` and the second board reports `dist 1`.
- [ ] Guidance: selected source points to the node in its `escape_to` field.
- [ ] Self-healing: unplug one board for more than four seconds; it turns grey while the others keep updating.
- [ ] Rejoin: reconnect the board; a new packet restores it even if its `ts` restarted at a lower value.
- [ ] Unknown path: while a hazard is active, show another node at `dist 99`; it is grey and never named the safest area.
- [ ] Dashboard independence: close the browser/laptop view and verify the LEDs and node communication continue.
- [ ] Counter reset: restart one model; Green AI totals never become a negative saving.

## Recovery

- If the frontend stops, restart `npm run dev`; node operation is unaffected.
- If WebSocket status is disconnected, verify `http://localhost:8000/health`, then restart Uvicorn.
- If no packets arrive, verify broadcast mode, the hotspot subnet, UDP port `5005`, and macOS firewall permissions.
- If a node stays grey after rejoin, inspect gateway receipt traffic; node `ts` is diagnostic only and never gates acceptance.

## Verification commands

Run from `dashboard/` before recording:

```bash
npm test
npm run typecheck
npm run build
python3 -m unittest discover -s gateway/tests -v
```

The physical-board rehearsal, hotspot address, and backup video must be completed on the demo laptop because they require the Arduino hardware and local network.
