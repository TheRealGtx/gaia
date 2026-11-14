# Gaia Hackathon Presentation Guide

This guide presents Gaia as a distributed environmental intelligence platform. The thermal-hazard scenario is the working demonstrator. It proves the network architecture with real code and hardware while showing how the same foundation can support agriculture, air quality, water, soil, ecosystems, and urban monitoring.

## 1. Positioning

### One-sentence pitch

**Gaia is a local-first environmental intelligence platform where sensor nodes learn from their surroundings, cooperate with nearby nodes, and keep producing useful field information without relying on the cloud.**

### Thirty-second version

Environmental data often comes from farms, forests, waterways, buildings, and remote sites where connectivity cannot be guaranteed. Gaia moves sensing, local interpretation, and coordination to the edge. Each node reads its environment, derives compact local state, and exchanges that state with selected neighbours. Together they can identify spatial patterns, confirm events, and recover when a node disappears. Our current demonstrator uses temperature and humidity to show thermal anomalies, consensus, hazard gradients, LEDs, and route updates. The same architecture can support CO₂, soil moisture, air pollution, water quality, or ecosystem sensors through new environmental profiles.

### The message judges should remember

Gaia is the distributed environmental layer. Fire detection is the proof running today.

## 2. Product idea

Gaia combines five layers:

1. **Measurement.** Nodes read local environmental sensors.
2. **Local intelligence.** Each node learns or evaluates conditions at its location.
3. **Collective intelligence.** Neighbours build shared fields, consensus, and recovery behaviour.
4. **Local response.** LEDs, actuators, or other outputs can react without a server.
5. **Observation and explanation.** A gateway, digital twin, and optional local language model make the field understandable.

The first four layers continue when the dashboard closes.

## 3. Application map

| Domain | Example measurements | Possible Gaia behaviour |
| --- | --- | --- |
| Agriculture | Soil moisture, humidity, light, rainfall, temperature, pH | Irrigation priority, drought gradients, frost consensus |
| Air quality | CO₂, particulate matter, VOC, NO₂, ozone | Source localization, ventilation guidance, exposure maps |
| Forest monitoring | Heat, humidity, smoke, wind, gas | Thermal-risk fields, early alerts, resilient event propagation |
| Water and soil | pH, conductivity, turbidity, dissolved oxygen, chemistry | Contamination gradients and sampling priority |
| Ecosystems | Microclimate, sound, light, motion, species-specific sensors | Habitat-change detection and distributed observations |
| Urban environments | CO₂, heat, noise, occupancy, energy | Heat-island mapping, comfort, ventilation, resource allocation |

These are directions for the platform. The repository currently implements and calibrates the thermal profile only.

## 4. Recommended slide deck

### Slide 1: Gaia

**Headline:** Distributed environmental intelligence, where the environment is measured

Show:

- Gaia wordmark;
- three connected nodes;
- one line: “Sense locally. Learn locally. Coordinate locally.”

Speaker note:

> “Gaia turns a group of sensor nodes into a cooperative environmental field.”

### Slide 2: The monitoring gap

**Headline:** Environmental systems cannot assume permanent connectivity

Cover three concrete problems:

- sensors operate across wide or remote areas;
- a cloud round trip adds a dependency before local action;
- one sensor reading lacks the spatial context provided by its neighbours.

Use examples from more than one domain: a dry agricultural zone, a CO₂ hotspot in a building, and a thermal anomaly in a forest.

### Slide 3: The Gaia model

**Headline:** Every node senses, interprets, and cooperates

```text
environmental sensor
        ↓
local model and state
        ↓
neighbour exchange ⇄ collective field
        ↓
local output + passive dashboard
```

Explain that the network transport can change. The current demonstrator uses a local WLAN and logical neighbours.

### Slide 4: One platform, many profiles

**Headline:** Change the profile, keep the distributed foundation

Show four profile cards:

- thermal and wildfire risk;
- agriculture and soil moisture;
- CO₂ and air quality;
- water-quality anomalies.

Each card should contain: sensors, local state, shared field, and response.

State the current boundary directly: the code still needs a versioned profile abstraction before those sensors become plug-and-play.

### Slide 5: The reference demonstrator

**Headline:** Thermal anomalies prove the architecture end to end

```text
Modulino Thermo
      ↓
temperature baseline + rate of rise
      ↓
neighbour consensus + hazard gradient
      ↓
LEDs, local guidance, dashboard, report
```

Clarify:

- temperature drives the current score;
- humidity is measured and displayed but does not yet influence the model;
- fire and evacuation are the demo domain, not the limit of Gaia.

### Slide 6: Local and collaborative learning

**Headline:** Each location learns its own normal

Show:

- online mean and deviation;
- temperature rate of rise;
- `score = max(level, rate)`;
- compact `mu`, `sigma`, `n` exchange every 15 seconds.

Verified result from the included indoor recording:

- 302 nominal samples;
- 70 heated samples;
- maximum nominal score `0.13`;
- threshold `0.7` crossed about one second after heating began.

Do not generalize this result to wildfires or other sensor profiles.

### Slide 7: Collective environmental fields

**Headline:** Nearby nodes add spatial context

Use the thermal demo to explain reusable behaviours:

- a source creates a distributed distance field;
- neighbour agreement strengthens confidence;
- a missing node changes the topology;
- returning nodes rejoin without a coordinator.

Then connect the concept to other profiles: distance from a dry-soil zone, pollution source, or water anomaly.

### Slide 8: Live demonstration

**Headline:** Heat it. Confirm it. Remove a node. Close the dashboard.

Run four beats:

1. heat one node to create the field;
2. heat an adjacent node to reach consensus;
3. disconnect and reconnect a node;
4. close the dashboard while LEDs and node communication continue.

The demo shows the distributed architecture through one profile.

### Slide 9: Digital twin and explanation

**Headline:** Observe the field without centralizing its decisions

Show:

- physical live graph;
- simulated building and forest environments;
- topology and field distance;
- deterministic report;
- optional Gemma rewrite.

Gemma explains existing facts. It does not read sensors, create alerts, or choose routes.

### Slide 10: What exists and what comes next

**Implemented now**

- Arduino sensor and LED bridge;
- temperature anomaly model and calibration;
- distributed node processes;
- consensus, gradient, failure, and rejoin behaviour;
- gateway, live dashboard, simulation, and local reporting.

**Next platform work**

- versioned environmental profiles and typed measurement schemas;
- a second profile, preferably CO₂ or soil moisture, to prove extensibility;
- secure node identity and transport;
- profile-specific datasets and validation;
- stronger federated aggregation and persistent model state.

Close with:

> “Gaia gives environmental sensors a way to understand their place and cooperate with the field around them.”

## 5. Three-minute pitch timing

| Time | Content | Visual |
| --- | --- | --- |
| 0:00-0:20 | Environmental monitoring problem and Gaia | Logo plus multi-domain examples |
| 0:20-0:45 | Five-layer platform model | Sensor-to-field diagram |
| 0:45-1:05 | Application profiles | Agriculture, CO₂, water, thermal cards |
| 1:05-1:25 | Current thermal demonstrator and model evidence | Thermo and score chart |
| 1:25-2:10 | Live consensus, failure, and recovery | Boards plus Live Field |
| 2:10-2:30 | Close the dashboard | LEDs keep working |
| 2:30-2:45 | Digital twin and local explanation | Dashboard and report |
| 2:45-3:00 | Current boundary and next profile | Roadmap and closing sentence |

## 6. Suggested pitch script

### Opening

> “Environmental monitoring cannot depend on every reading reaching a cloud service. Farms, forests, waterways, buildings, and remote sites need intelligence where the measurements happen.”

### Platform

> “Gaia gives every node a sensor adapter, a local model, and a way to cooperate with nearby nodes. Together they can build spatial fields, confirm events, and keep operating when a node or dashboard disappears.”

### Extensibility

> “The sensor defines the application. Soil moisture can create an irrigation field. CO₂ can reveal a ventilation hotspot. Water sensors can compare upstream and downstream conditions. The distributed foundation stays the same.”

### Current proof

> “For this hackathon we built a complete thermal profile. Each Arduino learns its local temperature, detects a rapid change, and exchanges compact state with its neighbours.”

### Demo

> “One heated node creates the field. A second agreeing node confirms it. If we disconnect a node, the remaining field recomputes. If we close the dashboard, the physical network keeps running.”

### Close

> “Today fire is the demonstrator. Gaia is the environmental intelligence layer underneath it.”

## 7. Backup video storyboard

The backup video should explain the platform before showing the thermal use case.

### Shot 1: Platform vision, 10 seconds

- logo and simple sensor-network diagram;
- small labels: agriculture, air quality, forest, water, urban;
- voiceover: “Gaia is a distributed platform for environmental sensing and local cooperation.”

### Shot 2: Current hardware, 10 seconds

- three Arduino UNO Q boards;
- Thermo, LEDs, and IDs visible;
- voiceover: “Our reference profile uses temperature and humidity to prove the architecture.”

### Shot 3: Nominal field, 10 seconds

- quiet LEDs and `ALL CLEAR`;
- dashboard shows `dist = 99`;
- voiceover: “Each node learns and reports its local state.”

### Shot 4: Single-source field, 15 seconds

- heat node 1;
- show red source and distance changes;
- voiceover: “One local change becomes a spatial field shared by the network.”

### Shot 5: Consensus, 15 seconds

- heat the adjacent node;
- banner changes to `ALERT`;
- voiceover: “Neighbour agreement adds context that one sensor cannot provide.”

### Shot 6: Self-healing, 18 seconds

- disconnect one board;
- show offline status and topology update;
- reconnect it;
- voiceover: “The field adapts to loss and accepts the returning node.”

### Shot 7: Dashboard independence, 12 seconds

- close the browser;
- keep physical outputs in frame;
- voiceover: “Observation can disappear without stopping local coordination.”

### Shot 8: Digital twin and report, 18 seconds

- show simulation, topology, route update, and report;
- voiceover: “The observer adds context and explanation while the field remains authoritative.”

### Shot 9: Other profiles, 12 seconds

- show four simple sensor/profile cards;
- voiceover: “The next step is the same Gaia foundation with CO₂, soil, air, and water sensors.”

### Shot 10: Close, 8 seconds

- logo and three nodes;
- text: “Local environmental intelligence. Shared across the field.”

## 8. Verified numbers

| Number | Meaning | Qualification |
| ---: | --- | --- |
| 1 second | Heartbeat interval | Default thermal profile configuration |
| 4 seconds | Neighbour/gateway timeout | Default configuration |
| 15 seconds | Model parameter exchange | Default configuration |
| 20 samples | Model warm-up | Current temperature model |
| 300 samples | Capped model weight | Current temperature model |
| 0.7 / 0.4 | Alert activation / clearing thresholds | Current thermal profile defaults |
| 302 | Nominal calibration samples | One indoor recording |
| 70 | Heated calibration samples | One indoor recording |
| 0.13 | Maximum nominal score | That recording only |
| about 1 second | Time above 0.7 after heating began | That recording only |
| 44 / 36 | Building / forest simulated sensors | Dashboard configuration |
| 3 | Current live manifest nodes | Building A thermal demonstrator |

## 9. Claims to use and avoid

| Use | Avoid |
| --- | --- |
| “Gaia is an environmental intelligence platform.” | “Gaia is only a fire-detection system.” |
| “The current demonstrator implements a thermal profile.” | “Every environmental profile is already implemented.” |
| “The architecture can support CO₂, soil, water, and other sensors.” | “You can plug in any sensor without code changes.” The profile abstraction still needs implementation. |
| “The critical loop runs on the local network.” | “Gaia works with no network.” Nodes currently use a local WLAN. |
| “No cloud service is required.” | “Raw data never leaves a node.” Latest readings reach the local observer. |
| “Nodes exchange compact model statistics.” | “The current federation is proximity-weighted or duplicate-free.” |
| “Humidity is measured and displayed.” | “Humidity affects the current anomaly score.” |
| “Gemma rewrites deterministic facts.” | “Gemma decides what happened or what action is safe.” |
| “The indoor thermal recording crossed the threshold after about one second.” | “Gaia detects every fire in one second.” |
| “Dashboard simulation recalculates configured routes.” | “Physical nodes provide certified evacuation guidance.” |

## 10. Likely judge questions

### Is Gaia a fire-detection project?

The current demonstrator uses thermal anomalies because they make gradients, consensus, failure, and local response visible. Gaia's main contribution is the distributed environmental architecture. New profiles can define different measurements, models, shared fields, and outputs.

### Can I connect a CO₂ or soil-moisture sensor today?

The hardware and algorithms can be adapted, but the current protocol and dashboard still contain temperature-specific fields. The planned profile layer will turn those cross-cutting edits into a sensor adapter, profile package, and configuration.

### What stays the same between applications?

Node identity, neighbour communication, freshness, self-healing, model exchange, gateway transport, topology, and generic observation can remain shared. Measurements, model logic, field meaning, thresholds, units, and actions belong to each profile.

### Why distribute the computation?

Local processing lowers dependence on a remote service, preserves operation during an internet outage, and gives each reading spatial context from nearby nodes. It also lets a deployment choose how much raw data reaches the observer.

### Is the current model general AI?

The current model is a small adaptive temperature model. It learns a baseline and rate behaviour. Gaia's architecture can host other local models, but each one needs its own data and validation.

### How does collaborative learning work?

The thermal profile shares `mu`, `sigma`, and `n` and pools them by sample count. It does not share the stored historical dataset. The next version needs origin-aware updates to prevent repeated aggregates from being counted more than once.

### What does Gemma do?

Gemma rewrites a deterministic report for non-technical users. It does not calculate measurements, consensus, gradients, or routes.

### Is this production-ready environmental monitoring?

No. A real deployment needs secure device identity, validated sensors, profile-specific datasets, durable state, operational monitoring, and domain review. The repository proves the distributed architecture and one working profile.

## 11. Media still needed

Capture media that communicates both platform and demonstrator:

- one hero photo of the node network;
- one close-up of the current Thermo and LED profile;
- one architecture diagram with interchangeable sensor profiles;
- one slide showing agriculture, CO₂, water, and thermal examples;
- one live-field screenshot during consensus;
- one digital-twin screenshot;
- one backup demo video;
- licensing and credits for every external asset.

## 12. Final checklist

- [ ] The first slide presents Gaia as an environmental platform.
- [ ] Fire is labeled as the current reference use case.
- [ ] Other applications are described as profiles to implement and validate.
- [ ] The presentation never claims arbitrary sensors are plug-and-play today.
- [ ] Node IDs and neighbour lists match the physical layout.
- [ ] Single-source, consensus, loss, rejoin, and dashboard closure are rehearsed.
- [ ] Gemma failure leaves deterministic reporting available.
- [ ] Every number includes its profile and dataset qualification.
- [ ] Security, scientific validation, and safety limits remain visible.
- [ ] The roadmap includes the environmental profile abstraction and a second non-fire profile.
