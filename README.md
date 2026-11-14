# gaia
A swarm of Arduino UNO Q nodes that detect forest fires with on-device AI, learn together without sharing data online, and guide people to safety with no cloud and no internet.

**To run it:** [START.md](START.md), from powering the boards to the demo.

## The problem
Wildfires are growing around the world, and the early minutes decide everything. Today's early-warning systems depend on cloud services, stable connectivity and centralized platforms, which are the things that fail during an emergency. They also tend to send raw sensor data to servers we don't control.

## Our solution
Gaia is a self-organizing network of Arduino UNO Q nodes that works fully locally. Each node senses its surroundings, runs AI on the device and cooperates with its neighbours. The nodes need no central server, no cloud and no internet.

## How it works

**1. Edge AI on every node**
Each UNO Q reads amModulino Thermo and runs a small anomaly-detection model on the Linux side. It learns what is "normal" for its own spot and flags abnormal patterns, such as a fast temperature rise with a drop in humidity, instead of using a fixed threshold.

**2. Gemma 3 1B for local situation awareness**
We use Gemma 3 1B on the UNO Q as the "explainer" of the system. It never decides alone: it receives the aggregated state of the field (which nodes are in alert, distances, trend) and produces a short report and a suggested action, for example "Fire risk rising in the north cluster, nodes 2 and 3 agree, the south exit is the safest route". Reports can be read by non-technical people. No data leaves the local network.

**3. Federated learning between neighbours**
Different places have different microclimates (clearing, undergrowth, lakeside), so a single global model can give false alarms. Nearby nodes exchange model parameters, never raw data, and average them: each node merges only with its neighbours. A new node with no history becomes useful after a few exchanges. The model is three numbers (mean, spread, sample count), about 30 bytes sent every 15 seconds: against a reading every second, that is about 95% less traffic, and the readings themselves never leave the node. With a larger model the next step would be to send only the parameters that changed; with three numbers there is nothing left to cut.

**4. Aggregate computing for collective behaviour**
The network coordinates through field-based, neighbour-to-neighbour interaction, in the spirit of aggregate programming:
- **Hazard gradient:** nodes that detect an anomaly become sources, and every other node computes its distance from the danger. LEDs show green/yellow/red.
- **Consensus:** a general alert fires only when several nearby nodes agree, which reduces false alarms.
- **Escape guidance:** nodes point toward the safest exit and recompute it when a node is lost or an area becomes dangerous.
- **Self-healing:** if a node is switched off (or "burned"), the others reorganize automatically.

**Decentralized**
Every decision is taken by the nodes. The dashboard we show in the demo is a passive observer: when we close it, the LEDs and the alert keep working.

## What a node actually says

Every node broadcasts one JSON datagram per second on UDP 5005. Nothing
subscribes, nothing acknowledges: whoever is listening uses it, and the field
works the same whether anybody listens or not.

```json
{"id": 2, "anomaly": 0.12, "dist": 1, "via": 1, "alert": false, "escape_to": 3,
 "mu": 22.4, "sigma": 1.1, "n": 120, "temperature": 23.8, "humidity": 46.2,
 "simulated": false, "ts": 1731574800.2}
```

`dist` is the distance from the hazard in hops, `0` at the source and `99` when
a node knows of no hazard at all, which is what a healthy field reports. `via`
is the neighbour that distance came from: it keeps two nodes from adding one to
each other for ever, and it is the arrow pointing at where the alarm came from.
`mu`, `sigma` and `n` are the model each node learned, shared every fifteen
seconds — the only thing that ever leaves a node, and never a raw reading.

## Run the field

Three boards, or three laptops on the same Wi-Fi:

```bash
NODE_ID=1 NEIGHBORS=2 python3 aggregate/node.py
NODE_ID=2 NEIGHBORS=1,3 python3 aggregate/node.py
NODE_ID=3 NEIGHBORS=2 python3 aggregate/node.py
```

Type `a` + Enter on one of them and watch the other two find their distance.
No boards at hand? The whole field runs on one laptop, with the same code:

```bash
python3 aggregate/sim.py --scenario consensus
python3 aggregate/sim.py --list
```

`sim.py` runs real nodes, not an imitation of them: `nominal`, `alert`,
`consensus`, `failure`, `rejoin` and `coldstart` each end in a verdict. It is
how we rehearse a node burning out without setting anything on fire.

## The repository

| Folder | What |
| --- | --- |
| `aggregate/` | the nodes: gradient, consensus, self-healing, escape direction. Its [README](aggregate/README.md) has the contract and every setting |
| `sensing_ml/` | the per-node anomaly model and the federated averaging |
| `app_lab/` | the sketch on the microcontroller and the sensor app: Modulino Thermo, LEDs and LED matrix over the Arduino Bridge |
| `gemma/` | Gemma 3 1B on the boards, and the script that turns the field into a sentence |
| `network/` | switching the boards between a hotspot and GaiaMesh, an ad-hoc network with no access point |
| `dashboard/` | the passive observer: a local gateway, the Live field graph and a 3D view of the field |

Three more programs live in `aggregate/`: `listen.py` prints every packet on the
network and sends nothing, `netcheck.py` says why nodes cannot hear each other,
and `check_dashboard.py` proves the dashboard still accepts what the nodes
actually send.

## Two things worth knowing before reading the code

**A single hot node raises no general alert.** The consensus alarm needs a
neighbour that agrees, so one sensor having a bad day cannot alarm the field.
One source still turns the LEDs red through the gradient; the alert itself
wants agreement.

**`dist = 99` means "I know of no hazard", not "I am safe".** A quiet field is
99 everywhere. After a fire starts, a node still at 99 has lost its path to the
alerting side, which is worth showing and is never where you send people.
