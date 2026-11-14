# Report for Pietro — live dashboard, UDP contract, repo integration

From: Giuliano (aggregate computing / nodes). Date: Saturday 14/11.
Answers `2026-11-14-gaia-live-demo-gap-analysis.md` and
`2026-11-14-gaia-live-udp-dashboard.md`.

`Plan.md` in the repository root stays the single source of truth for the UDP
contract and the schedule. This report is what changed, what is decided, and
what I need from you.

---

## 1. Decisions taken

1. **Your dashboard moves into this repository**, under `dashboard/`. One
   repository link for Junction and for Project Hub. Layout and rules in §6.
2. **The public name is `Gaia`.** `EchoField` is gone from `aggregate/node.py`
   and `Plan.md`; one word left in `sensing_ml/model.py`, Chuqi's to fix. Use
   Gaia in the UI, the pitch, the screenshots and the video.
3. **The UDP contract is frozen as in §2**, with your field names for the
   reading and the counters. Your Task 1 tests stand as written.

## 2. The contract, as the nodes actually send it

One JSON datagram per node per second, UDP broadcast port 5005. Real packet,
captured from a two-node run this morning:

```json
{"id": 1, "anomaly": 1.0, "dist": 0, "via": null, "alert": false, "escape_to": 2,
 "mu": 20.0, "sigma": 0.0, "n": 7, "temperature": 47.0, "humidity": 22.5,
 "simulated": true, "bytes_sent": 204, "bytes_if_raw_data": 451, "ts": 1794648860.83}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | int | node id, maps to your manifest |
| `anomaly` | 0..1 | Chuqi's score, or the keyboard value in a fake run |
| `dist` | int | hops from the nearest hazard. `0` = I am the hazard, **`99` = unknown** |
| `via` | int \| null | the neighbour this distance came from: the "where the alarm came from" arrow |
| `alert` | bool | consensus alarm with hysteresis, already debounced by the node |
| `escape_to` | int \| null | alive neighbour furthest from the hazard: **use this for "where to go"** |
| `mu`, `sigma` | float | the node's learned normal temperature |
| `n` | int | readings learned. Below 20 (`WARMUP`) `mu`/`sigma` are still defaults |
| `temperature`, `humidity` | float \| null | the raw reading. `null` = no sensor |
| `simulated` | bool | `true` = derived from the fake anomaly, **not measured** |
| `bytes_sent`, `bytes_if_raw_data` | int | Chuqi's green-AI counters, cumulative. **Absent, not zero**, when the model is not scoring |
| `ts` | float | the node's own clock. Unsynchronized, see §3.3 |

Three rules for the parser:

- **Ignore fields you do not know.** `via`, `escape_to`, `n` and `simulated` are
  real and are not going away. Validate what you need, pass over the rest, never
  reject a packet for carrying extra keys.
- **`temperature` and `humidity` are nullable**, and `simulated: true` means they
  must be labeled, never shown as a measurement.
- **Absent counters mean "awaiting counters".** A zero would mean "no saving".

## 3. What to change in your plan, in order of danger

### 3.1 `dist == 99` is "unknown", not "very far and therefore safest"

Your status mapping ("larger finite `dist` green") and your report ("safest
reporting node = largest finite `dist`") both make 99 the best place to be. For
the nodes, 99 means *I have no path to any hazard*: a node that just rebooted,
or one cut off from the alerting side of the mesh. With your rule the dashboard
paints it green and points the evacuation arrow at the node that knows the
least — which is exactly what happens on stage the moment we unplug a board to
show self-healing.

- Treat `dist >= 99` as unknown: its own colour (grey or hatched), and excluded
  from the safest-area computation.
- For "where to go", use **`escape_to`**. The node already computes it and the
  LEDs use the same value, so dashboard and hardware cannot disagree.
- With three boards `dist` is only ever 0, 1, 2 or 99, so "1–2 amber, >2 green"
  never yields a green node. Use: `0` red, `1` amber, `>= 2` green, `99` grey.

### 3.2 Colour and scale with three nodes

In Live mode use a manifest with the three physical nodes only. A scene showing
77 grey dots and 3 live ones reads as "the network is down", whatever the banner
says.

### 3.3 `ts`-based de-duplication can take a node off the dashboard for good

"Ignore packets older than the newest accepted `ts` for that node" is unsafe
here: the UNO Q has no RTC and the demo hotspot has no NTP, so each board's `ts`
is its own idea of the time. One packet with a clock set in the future and that
node's watermark is unreachable for ever: every later packet is discarded, the
node goes grey, and restarting the *node* does not fix it — only restarting the
gateway does.

Either accept an older `ts` when it arrives more than four seconds after the
last accepted one, or drop the watermark entirely and order by receipt time,
keeping `ts` for diagnostics. Your instinct to keep receipt time separate from
`ts` was right; just do not let `ts` gate acceptance.

### 3.4 `mu` / `sigma` are meaningless during warmup

Chuqi's model reports `mu = 0.0`, `sigma = 1.0`, `n = 0` until it has learned,
and needs 20 readings before its level score counts at all. "mu 0.0 °C" in the
node detail reads as a broken sensor. Use `n`: below 20, show "learning (n/20)"
instead of a temperature.

### 3.5 The green-AI number is weak, and the cause is on our side

Measured on the run above: `bytes_sent` 204 against `bytes_if_raw_data` 451 over
seven seconds. That is a 55% saving, not the order of magnitude the pitch
implies. The reason is ours: the node puts `mu`/`sigma`/`n` in *every* heartbeat
although parameters are only merged every 15 s, so Chuqi's counter charges
federated learning fifteen times what it actually costs.

Two options, and it is a three-way decision, not a dashboard fix:

- **(a)** Send the parameters only every 15 s, absent in the other heartbeats.
  The saving becomes ~95% and is honest. Cost for you: treat `mu`/`sigma`/`n`
  as sticky last-known values instead of required per packet.
- **(b)** Leave it as it is and say "55% less than streaming raw readings" on
  stage — true, unimpressive.

I would take (a): five lines in `node.py`. It contradicts your "required fields"
list, so I will not touch it until you agree.

### 3.6 Two fake senders is one too many

Your Task 6 (`demo/fake_nodes.py`) and my `aggregate/sim.py` are the same hour of
work done twice, and a hand-written imitation of the protocol can drift from the
protocol. Proposal: `sim.py` launches **N real node processes** in broadcast mode
on 5005, so what you develop against is the real gradient, the real `via` and the
real consensus. You keep only the scripted sequence (`scenarios.json`) on top.
Say the word and it is in the repo within the hour.

Note on modes: the node also has a `unicast` mode (ports 5000+id) for running
several nodes on one laptop. **Your gateway sees nothing in that mode**, it only
binds 5005. For dashboard work always use broadcast, or `sim.py` once it exists.

### 3.7 Smaller points

- `0.0.0.0:5005` with `SO_REUSEADDR` is right and necessary: on the demo laptop a
  node process and your gateway listen on the same port.
- Your docs point at `docs/superpowers/specs/...`, which does not exist here.
  Keep the spec next to the plan, in `dashboard/`.
- Keep the exact sentence `Dashboard is read-only: the network works without it.`
  It is the one claim a judge can verify live, by asking you to close the laptop.

## 4. What changed on our side today

- `temperature`, `humidity` (nullable) and `simulated` in every heartbeat — your
  names, flat, not nested.
- `bytes_sent` / `bytes_if_raw_data` forwarded from Chuqi's `bytes_report()`,
  absent while the model is not scoring so you never see a negative saving.
- The first heartbeat now already carries a reading; it used to be able to go out
  empty, which your strict parser would have rejected.
- `ANOMALY_SRC=model` runs Chuqi's real `anomaly_score()` on simulated readings:
  the whole chain is testable with no hardware.
- Verified in three scenarios (keyboard anomaly, real model on simulated
  readings, no sensor at all): gradient 0/1, `escape_to`, neighbour timeout and
  the fields above, all as documented.

## 5. What I need from you

1. **Green-AI cadence**: option (a) or (b) in §3.5. Blocks five lines in `node.py`
   and the number you say on stage.
2. **`sim.py` or `fake_nodes.py`**: pick one owner (§3.6) before either of us
   spends the hour.
3. **Manifest with the three physical ids** (`1`, `2`, `3` → your sensor ids), so
   the node ids we flash on the boards match your scene.
4. When you move the app in, tell me the port the gateway binds besides 5005, so
   the runbook has the startup order right.

## 6. Moving the dashboard into this repository

Target layout:

```
gaia/
  aggregate/      nodes, Giuliano          <- do not edit
  sensing_ml/     model, Chuqi             <- do not edit
  dashboard/      your app, moved as it is: src/, gateway/, demo/, package.json
  Plan.md         contract + schedule, single source of truth
  README.md       one page, Gaia, pointing at the three folders
```

Rules so the merge costs minutes and not an evening:

- Move it **as it is**, keeping your paths relative to `dashboard/`, so
  `npm test`, `npm run typecheck` and `npm run build` keep working from inside
  that folder. Do not reshape it to match our layout.
- **Never commit `node_modules/`, `.next/` or build output.** I added a
  `.gitignore` at the root that covers them, plus `__pycache__/` and `.env*`.
  Check `git status` before the first commit: a 200 MB push at 09:00 on Sunday is
  how submissions get missed.
- Commit the move on its own (`git add dashboard && git commit`), then your code
  changes after. If the move and the edits land together, nobody can review
  either.
- Touch only `dashboard/`. `aggregate/` and `sensing_ml/` are ours; if you need
  something from the packet, ask instead of patching `node.py`.
- Ports on the demo laptop: UDP 5005 (nodes → gateway), your gateway's HTTP/WS
  port, 3000 for the frontend. Put the startup order in the runbook, nodes first.
- One `README.md` at the root for the submission; your `dashboard/README.md`
  keeps the developer instructions.

## 7. The only real blocker

`sensing_ml/model.py` has no `read_sensor()`, so no node can read a Modulino yet:
every `temperature` you receive today arrives with `simulated: true`. That one is
Chuqi's, and it needs the App Lab bridge answer from the mentors. Everything else
on the aggregate side is done and tested.
