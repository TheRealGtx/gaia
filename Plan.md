# Gaia: team plan

Junction Finland 2026. **Giuliano**: aggregate computing and networking.
**Chuqi**: the anomaly model and Gemma. **Pietro**: dashboard and pitch.

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

- Sunday is for delivery, not development: at most one bug fix, and after it
  `START.md` again from the top.
- Record the video as soon as the demo runs once end to end; do not wait for
  the last improvement.
- Every change: commit, push, then `git pull` and a service restart on the
  boards.
- Link the video, the photos and the diagram from `README.md` once they exist.
