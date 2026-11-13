# gaia
A swarm of Arduino UNO Q nodes that detect forest fires with on-device AI, learn together without sharing data online, and guide people to safety with no cloud and no internet.

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
Different places have different microclimates (clearing, undergrowth, lakeside), so a single global model can give false alarms. Nearby nodes exchange model parameters, never raw data, and average them with a proximity-based strategy. A new node with no history becomes useful after a few exchanges To save energy and bandwidth we send only the most important values.

**4. Aggregate computing for collective behaviour**
The network coordinates through field-based, neighbour-to-neighbour interaction, in the spirit of aggregate programming:
- **Hazard gradient:** nodes that detect an anomaly become sources, and every other node computes its distance from the danger. LEDs show green/yellow/red.
- **Consensus:** a general alert fires only when several nearby nodes agree, which reduces false alarms.
- **Escape guidance:** nodes point toward the safest exit and recompute it when a node is lost or an area becomes dangerous.
- **Self-healing:** if a node is switched off (or "burned"), the others reorganize automatically.

**Decentralized**
Every decision is taken by the nodes. The dashboard we show in the demo is a passive observer: when we close it, the LEDs and the alert keep working.
