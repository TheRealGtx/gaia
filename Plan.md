# Gaia: team plan

<<<<<<< HEAD
Junction Finland 2026. **Giuliano**: aggregate computing and networking.
**Chuqi**: the anomaly model and Gemma. **Pietro**: dashboard and pitch.
=======
> **Historical scope note:** this plan records the implementation of Gaia's thermal-hazard reference demonstrator for the hackathon. Gaia's product direction is a multi-domain environmental intelligence platform. See [`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the current positioning and the planned environmental profile architecture.

Team: **Giuliano** (aggregate computing), **Chuqi** (AI model), **Pietro** (demo, frontend, pitch and presentation).
>>>>>>> 40510fa03b6a4383c68566eb3c8891d8eaf56135

| To | Read |
| --- | --- |
| bring the system up and run the demo | `START.md` |
| know what a node sends, the ports, every setting | `aggregate/README.md` |
| set up a board, the sensor app, the LEDs | `app_lab/echofield_node/README.md` |
| install and run Gemma | `gemma/README.md` |
| drop the access point (GaiaMesh, laptop on Linux) | `HANDOFF-linux.md` |

## Sunday morning

| Time | Task | Who |
| --- | --- | --- |
| 7:00-7:30 | Power on and run the demo from scratch, following `START.md` | Everyone |
| 7:30-8:30 | Final video, photos and wiring diagram | Pietro, with Giuliano and Chuqi |
| 8:30-9:15 | Publish on **Arduino Project Hub** (tag Junction Finland 2026) and **Junction**: description, video, repository link | Pietro, the others check the texts |
| 9:15-9:30 | Final check of links and submission. **Early delivery** | Everyone |
| After | Pitch rehearsal, 2-3 times | Pietro leads, the others answer questions |

## Rules for Sunday

<<<<<<< HEAD
- Sunday is for delivery, not development: at most one bug fix, and after it
  `START.md` again from the top.
- Record the video as soon as the demo runs once end to end; do not wait for
  the last improvement.
- Every change: commit, push, then `git pull` and a service restart on the
  boards.
- Link the video, the photos and the diagram from `README.md` once they exist.
=======
## Rules for all three

- Giuliano and Chuqi do not depend on each other until 16:00 thanks to the initial contracts: do not wait for one another.
- Commit to Git every time something works, and record the backup video as soon as the demo runs once end to end.
- Every 2-3 hours, 5 minutes together: what works, what is blocked, what gets cut.
- Actually sleep: a demo rehearsed with a clear head is worth more than one extra hour of code.
- Sunday is for delivery, not development: if the code is not ready at 21:30, at most fix one bug in the evening.
>>>>>>> 40510fa03b6a4383c68566eb3c8891d8eaf56135
