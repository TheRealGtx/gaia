# Gaia: Action Plan (Saturday 14/11 → Sunday 15/11)

> **Historical scope note:** this plan records the implementation of Gaia's thermal-hazard reference demonstrator for the hackathon. Gaia's product direction is a multi-domain environmental intelligence platform. See [`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the current positioning and the planned environmental profile architecture.

Team: **Giuliano** (aggregate computing), **Chuqi** (AI model), **Pietro** (demo, frontend, pitch and presentation).

Time reference: it is Saturday 10:00 now, the deadline is Sunday 10:00. **Goal: submit by 9:30**, to leave a margin for Project Hub and Junction uploads.

---

## Initial agreement (first 30 minutes, all three together)

Fix these "contracts" right away so you can work in parallel without blocking each other:

- **UDP message** (JSON, broadcast on port 5005, one per node per second), as actually sent by `aggregate/node.py`:
  `{"id": 2, "anomaly": 0.12, "dist": 3, "via": 1, "alert": false, "escape_to": 3, "mu": 22.4, "sigma": 1.1, "n": 120, "temperature": 23.8, "humidity": 46.2, "simulated": false, "bytes_sent": 84, "bytes_if_raw_data": 960, "ts": 1731574800.2}`
  `via` = the neighbour this node took its distance from (`null` if it is the hazard or knows nothing). It is what stops two nodes from adding 1 to each other for ever; for the dashboard it is also the arrow "where the alarm came from".
  `temperature` / `humidity` = the last raw reading, forwarded for the dashboard and for Gemma's report (the node itself only ever looks at `anomaly`). Both are `null` when there is no sensor; `simulated: true` means they were derived from the fake anomaly, so the dashboard must label them instead of showing them as measurements (`FAKE_SENSOR=0` sends `null` instead).
  `bytes_sent` / `bytes_if_raw_data` = Chuqi's green-AI counters, cumulative per node. **Absent from the message, not zero**, when the model is not loaded: the panel shows "awaiting counters" rather than a saving of 0%.
  `mu` / `sigma` / `n` = the learned model. **They ride in one heartbeat every 15 s and are absent from the other fourteen** (Chuqi's decision, 14/11: calling `get_params()` once per second charged federated learning fifteen times its real cost, and the green-AI figure fell from ~95% to 55%). Whoever reads the messages keeps the last value it saw and never resets it because a packet has none. `n` = how many readings the model has learned: below `WARMUP` (20) `mu`/`sigma` are still defaults (0.0 / 1.0) and must be shown as "learning", not as a temperature of 0 °C.
  `dist = 99` means **unknown** (no path to a hazard is known), not "very far and therefore safe": never pick it as the safest area, never colour it green. Use `escape_to`, which the node already computes, as the "where to go" arrow.
  `via`, `escape_to`, `n`, `simulated` and the byte counters are extra fields and can be `null` or absent: whoever reads the messages must ignore what it does not know, and must not reject a packet for carrying them.
- **Chuqi provides, in `sensing_ml/model.py`** (landed 10:20, commit `2d9bf26`):
  - `anomaly_score(values, t=None) -> float between 0 and 1`; `values` must contain at least `temp`
  - `get_params()` / `merge_params(others)` with `mu`, `sigma`, `n` — wired and tested in the node
  - `bytes_report() -> {"bytes_sent", "bytes_if_raw_data"}` for Pietro's green panel. **Not in the UDP message yet**: until the node forwards it, the dashboard has no way to see it.
  - `read_sensor() -> the dict given to anomaly_score` is **still missing**, so the node has nothing to read the Modulino with and stays on the keyboard anomaly. Meanwhile `ANOMALY_SRC=model` drives her real `anomaly_score()` with fake readings, which tests the whole chain without hardware. The App Lab bridge API is not confirmed yet, ask the mentors.
- **Giuliano provides** `aggregate/node.py`: the node loop (send, receive, gradient, consensus) that calls those functions.
- **Pietro** listens to the same messages (read-only) and draws the dashboard in `dashboard/`. Decided 14/11: his Next.js app and its gateway move into `dashboard/` as they are, so Junction and Project Hub get one repository link. The public name is **Gaia**, not EchoField. Details and the integration rules: `dashboard/2026-11-14-report-for-pietro.md`.
- Until Chuqi's model is ready, Giuliano uses a fake anomaly (a value that rises with a key press or with temperature).

---

## Giuliano: aggregate computing and networking

| Time | Task |
|---|---|
| 10:30-12:30 | ~~UDP communication (send, receive, neighbour table with timeout)~~ **done**, tested on one laptop in unicast mode |
| 12:30-14:00 | ~~Gradient: node in anomaly = 0, all others = minimum of neighbours + 1~~ **done** with the fake anomaly (0-1-2 on a line of 3), loop-free thanks to `via` |
| 14:00-15:30 | Move the code onto the real boards (with Pietro/Chuqi), on your own local router. **Checkpoint 1** |
| 15:30-17:00 | ~~Consensus with hysteresis (alert on above 0.7 with `AGREE_MIN` agreeing neighbours, **default 1**; off only below 0.4 with no neighbour in anomaly) and missing node~~ **done**, and verified with real node processes (`sim.py --scenario consensus`). **Keep `AGREE_MIN = 1` with three boards**, contrary to the earlier "raise it to 2": the boards are a line, so only the middle one has two neighbours and the ends could never alert. Measured with `--agree-min 2`: heating nodes 1 and 2 raises nothing at all. Node killed = distances recomputed in ~5 s, it rejoins by itself |
| 17:00-19:00 | ~~Exchange and averaging of model parameters between neighbours (with Chuqi)~~ **done**: `merge_params` every 15 s in its own thread (the 1 s heartbeat is never delayed), parameters on the wire every 15 s too, and each node remembers its neighbours' last ones because the other fourteen heartbeats carry none. Tested against Chuqi's real model. Cold start demo |
| 19:00-20:30 | ~~Escape direction (optional)~~ **done** (`escape_to`, `null` if no neighbour is further away). Free slot: `aggregate/sim.py` (N nodes on one laptop) and hard-case tests |
| After | Freeze the code, fix edge cases, technical README |

## Chuqi: AI model

| Time | Task |
|---|---|
| 10:30-12:00 | Read the Modulino Thermo (and others) from the board and print the values. Collect a few minutes of "normal" data |
| 12:00-14:00 | Simple model: mean and standard deviation per node, `anomaly_score` as a normalized distance (0-1). Check that heating the sensor makes the score rise. Hand the function to Giuliano |
| 14:00-16:00 | `get_params()` and `merge_params()` for exchange between nodes. Test: a new node with its neighbours' parameters recognises the anomaly. Counter of bytes sent |
| 16:00-18:00 | Reduce the data sent (sparsification: only the values that changed) and a "with vs without" comparison for the green counter |
| 18:00-20:00 | Gemma 3 1B with llama.cpp: test right away whether it runs and how fast, and generate a report from the state. **Limit: if it does not work after half an hour, switch to template-based reports with Pietro** |
| 20:00-21:30 | Optional small neural network instead of mean and standard deviation, only if everything else works |
| After | Freeze, document the parameters |

## Pietro: demo, frontend, pitch and presentation

| Time | Task |
|---|---|
| 10:30-12:00 | Physical setup: boards, cables, Pixels, hotspot/router. Check the LEDs through the App Lab bridge (with the mentors). Start the Project Hub page (photos) |
| 12:00-14:30 | Minimal dashboard: listens to UDP, shows nodes coloured by state, lines between neighbours, gradient value, grey node when absent. With fake data at first |
| 14:30-16:00 | Connect the dashboard to the real messages. Simulation buttons (inject anomaly). A label saying "dashboard not needed for operation" |
| 16:00-18:00 | LED colours based on distance and state (with Giuliano). Template-based situation reports (sentences filled from data) as a base for Gemma |
| 18:00-20:00 | Byte counter and "green AI" panel in the dashboard. Staging (forest/corridor model, labels) |
| 20:00-21:30 | Write the pitch (3-minute script), record a **backup video** of the demo as soon as it is stable |
| After | Prepare photos and the wiring diagram for Project Hub |

---

## Shared checkpoints

| Time | What must work |
|---|---|
| 14:30 | A board in anomaly changes the colour of the other boards' LEDs (even with the fake anomaly) |
| 17:00 | Chuqi's model drives the anomaly and the dashboard shows the real state |
| 20:00 | Cold start and switched-off node work. **Record the backup video** |
| 21:30 | **Code freeze.** Stop adding features, go to sleep |

If a checkpoint slips by more than an hour, cut a feature (first the escape direction, then Gemma, then sparsification) and do not move the freeze.

---

## Sunday morning

| Time | Task | Who |
|---|---|---|
| 7:00-7:30 | Power on and quick run of the demo from scratch. If something fails, use the backup video | Everyone |
| 7:30-8:30 | Final video (if needed), photos and diagram | Pietro, with Giuliano and Chuqi |
| 8:30-9:15 | Publish on **Arduino Project Hub** (tag Junction Finland 2026) and **Junction**, with description, video and repository link | Pietro, while the others check the texts |
| 9:15-9:30 | Final check of links and submission. **Early delivery** | Everyone |
| After | Pitch rehearsal, 2-3 times | Pietro leads, the others answer questions |

---

## Rules for all three

- Giuliano and Chuqi do not depend on each other until 16:00 thanks to the initial contracts: do not wait for one another.
- Commit to Git every time something works, and record the backup video as soon as the demo runs once end to end.
- Every 2-3 hours, 5 minutes together: what works, what is blocked, what gets cut.
- Actually sleep: a demo rehearsed with a clear head is worth more than one extra hour of code.
- Sunday is for delivery, not development: if the code is not ready at 21:30, at most fix one bug in the evening.
