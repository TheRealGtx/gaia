# EchoField: Action Plan (Saturday 14/11 → Sunday 15/11)

Team: **Giuliano** (aggregate computing), **Chuqi** (AI model), **Pietro** (demo, frontend, pitch and presentation).

Time reference: it is Saturday 10:00 now, the deadline is Sunday 10:00. **Goal: submit by 9:30**, to leave a margin for Project Hub and Junction uploads.

---

## Initial agreement (first 30 minutes, all three together)

Fix these "contracts" right away so you can work in parallel without blocking each other:

- **UDP message** (JSON, port 5005):
  `{"id": 2, "anomaly": 0.0, "dist": 99, "mu": 22.4, "sigma": 1.1}`
- **Chuqi provides two functions**:
  - `anomaly_score(sensor_values) -> float between 0 and 1`
  - `get_params()` / `merge_params(others)`
- **Giuliano provides** the node loop (send, receive, gradient, consensus) that calls those functions.
- **Pietro** listens to the same messages (read-only) and draws the dashboard.
- Until Chuqi's model is ready, Giuliano uses a fake anomaly (a value that rises with a key press or with temperature).

---

## Giuliano: aggregate computing and networking

| Time | Task |
|---|---|
| 10:30-12:30 | UDP communication between 2 laptops (send, receive, neighbour table with timeout) |
| 12:30-14:00 | Gradient: node in anomaly = 0, all others = minimum of neighbours + 1. Tested with the fake anomaly |
| 14:00-15:30 | Move the code onto the real boards (with Pietro/Chuqi), on your own local router. **Checkpoint 1** |
| 15:30-17:00 | Consensus (general alert only if at least 2 neighbours are in anomaly) and handling of a missing node |
| 17:00-19:00 | Exchange and averaging of model parameters between neighbours (with Chuqi), every 10-20 seconds. Cold start demo |
| 19:00-20:30 | Escape direction (optional): each node points to the neighbour with the greater distance. Skip if there is no time |
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