# Gaia Implementation Gap Analysis

This audit compares the current working tree with claims found in the root README history, `Plan.md`, handoff notes, dashboard plans/specifications, component READMEs, and the behaviours implied by the hackathon pitch.

It is a diagnosis and implementation roadmap, not a claim that the items below have already been fixed.

## How to read priorities

- **P0 — correctness or safety boundary:** fix before presenting the output as dependable guidance.
- **P1 — hackathon credibility:** fix or describe honestly before the final demo and submission.
- **P2 — reliability and security:** required before a real pilot outside a trusted demo LAN.
- **P3 — quality and scale:** improves maintainability, accessibility, performance, discoverability, and research quality.

## Executive summary

Gaia has a real end-to-end core: hardware bridge, local anomaly model, distributed node processes, gateway, live dashboard, deterministic simulation, route computation, and optional Gemma integration. The current code proves one thermal-hazard profile. It does not yet provide the profile and measurement abstractions required to connect CO₂, soil, air-quality, water, acoustic, or other environmental sensors without editing many layers.

The most important corrections are:

1. never interpret `dist = 99` as the safest direction;
2. do not draw browser-computed evacuation routes as if the live nodes produced them;
3. harden node packet validation so malformed LAN traffic cannot stop computation;
4. reconcile the two-node documentation with the three-node manifests;
5. either restore a truthful Green AI visualization or remove that demo claim;
6. describe the model as temperature-only, sample-weighted federated statistics—not humidity-aware, proximity-weighted, or delta-sparse learning;
7. validate the exact UNO Q sketch and systemd path on the physical hardware;
8. introduce a versioned environmental profile system before presenting Gaia as plug-and-play for arbitrary sensors;
9. keep the gateway on a trusted LAN until identity, authentication, encryption, and rate limiting exist.

## Claim-to-code matrix

| Claim or expectation | Current reality | Action |
| --- | --- | --- |
| Gaia can support many environmental domains | The architecture is reusable, but current schemas hardcode temperature, humidity, hazard, fire, and evacuation concepts | Introduce versioned environmental profiles, typed measurements, generic local state, and metadata-driven telemetry |
| Nodes detect a rapid temperature rise and humidity drop | The model reads only `temp`; humidity is recorded and displayed | Change the claim or implement a calibrated humidity feature |
| Raw data never leaves a node | Latest temperature and humidity are broadcast on the local LAN for the dashboard | Say “no cloud dataset upload”; optionally remove raw fields from production heartbeat |
| Federated learning is proximity-weighted | Merge weight is `n` only | Add topology/trust weights or change the claim |
| Only changed model values are sent | The full tuple is sent less often | Implement delta encoding/versioning or call it cadence reduction |
| Green AI savings are visible | Protocol counters remain, but the dashboard panel was removed | Restore a clearly qualified panel or remove it from the pitch |
| Gemma sees trends and selects a safe exit | Gemma rewrites a deterministic template; it receives no time series and does not compute exits | Keep Gemma as an explanation layer or build a validated fact pipeline |
| Live forest monitoring exists | Live sensor whitelist for `forest-north` is empty | Configure physical forest nodes and manifest positions or label it simulation-only |
| Fire propagates over time | Multiple manual fires exist; no propagation model exists | Implement a deterministic spread scheduler or remove the promise |
| Live route is network-owned | `escape_to` is network-owned, but the 3D scene can still draw browser Dijkstra routes | Hide/replace browser routes in Live mode |
| Demo uses two live boards | Current manifest and live whitelist contain three | Choose one count and update every source of truth |

# P0 — Correctness and safety boundaries

## P0.1 — `dist = 99` can be selected as an escape direction

**Evidence**

- `aggregate/node.py`, `update()`: `escape_to` selects `max()` over neighbour `dist` values, including `99`.
- `gemma/report.py`, `template()`: the farthest node calculation also includes `99`.
- Project documentation correctly says `99` means “no known path,” not “safe.”

**Impact**

A partitioned or uninformed neighbour can be preferred over a node with a finite, known gradient. This contradicts the core safety explanation.

**Implementation**

1. Define one shared semantic rule: a usable escape candidate must be online and have `0 <= dist < UNKNOWN`.
2. In `node.py`, filter neighbours before `max()`. If no finite candidate is farther than the current node, set `escape_to = null`.
3. Decide how a source at `dist = 0` should expose guidance. The hardware client currently suppresses its arrow even if `escape_to` exists; make the node and display rule consistent.
4. In `gemma/report.py`, calculate “safest reporting area” from finite distances only. If none exists, report “no confirmed path” instead of inventing guidance.
5. Add tests for nominal all-99, active hazard plus partitioned 99, finite alternatives, source node, line break, and rejoin.

**Acceptance criterion**

No live report, LED arrow, or `escape_to` ever identifies a `99` node as safer while a hazard is active.

## P0.2 — Live 3D evacuation route can be mistaken for network guidance

**Evidence**

- `dashboard/src/state/selectors.ts` still computes configured Dijkstra routes in Live mode.
- `dashboard/src/components/scene/DigitalTwin.tsx` can render that route.
- `OperationalCards.tsx` correctly uses live `escape_to`, creating two different guidance sources on one page.

**Impact**

The scene may imply that physical nodes selected a building exit when only the browser's static graph did so.

**Implementation**

Choose one of these explicit designs:

- **Recommended:** hide configured evacuation paths in Live mode and render only the selected node's `escape_to` edge with a “network reported” label.
- Alternatively, keep both but use different colors, legends, and names: “Network guidance” versus “Dashboard what-if route.” Never show the simulated route as authoritative.

Guard route selectors by mode, add a `guidanceSource` field, and test that a live snapshot cannot produce a simulated route without an explicit what-if toggle.

**Acceptance criterion**

A viewer can identify the source of every visible guidance line without reading documentation.

## P0.3 — A malformed neighbour packet can stop node computation

**Evidence**

- `aggregate/node.py`, `recv_loop()` calls `.get()` after `json.loads()` without first requiring an object.
- Numeric conversions in `update()` assume valid `dist` and `anomaly` values.
- The gateway validates its input more carefully than the nodes do.

**Impact**

Malformed or hostile traffic on the LAN can terminate a receiver thread or the main update loop, undermining self-healing.

**Implementation**

1. Extract a standard-library `parse_node_packet(data) -> ValidatedPacket | None` module.
2. Require an object, integer non-negative ID/distance, finite anomaly in `[0,1]`, nullable integer `via`/`escape_to`, boolean alert, and a bounded datagram size.
3. Catch validation errors at the receive boundary and increment a diagnostic counter instead of raising.
4. Keep the last valid state when a packet is rejected.
5. Add unit tests and property/fuzz cases for arrays, strings, NaN/Infinity, huge integers, missing keys, invalid UTF-8, oversized JSON, and nested objects.

**Acceptance criterion**

Ten thousand invalid packets cannot stop a node or replace its last valid neighbour state.

## P0.4 — Domain wording exceeds the validation level

**Evidence**

- Calibration is one short indoor session on one sensor.
- There are no wildfire datasets, environmental chambers, multi-location evaluation, certified hardware tests, or human-factors studies.
- Route output is prototype decision support.

**Impact**

Claims such as “detects wildfires in one second,” “measures air quality,” “optimizes agriculture,” or “guides people to safety” can be interpreted as validated performance when only the thermal demonstrator has code and calibration data.

**Implementation**

Use qualification in the UI, README, slides, and video:

- “crossed the threshold about one second after heating began in our indoor calibration recording”;
- “prototype local escape guidance”;
- “not certified emergency equipment.”

For each real pilot, define the environmental variable, deployment conditions, decisions, failure costs, and responsible domain experts. Collect representative data, establish accuracy and reliability targets, run held-out evaluation, and validate the human-facing action independently from the networking platform.

# P1 — Hackathon credibility and feature completeness

## P1.1 — Two-node and three-node documentation conflict

**Evidence**

- `dashboard/gateway/node_manifest.json` and `src/live/liveManifest.ts`: three nodes.
- `dashboard/README.md`, `dashboard/gateway/README.md`, and `dashboard/docs/demo-runbook.md`: older two-node wording.

**Implementation**

1. Decide the physical demo count.
2. Generate the frontend live whitelist from the gateway manifest or from one shared manifest schema.
3. Update runbook, screenshots, tests, and expected node count from that source.
4. Add startup validation that reports manifest/whitelist drift.

**Acceptance criterion**

The physical layout, gateway, frontend, fake sender, tests, and all runbooks name exactly the same IDs.

## P1.2 — Historical plans are mistaken for current state

**Evidence**

`Plan.md`, handoff files, and `dashboard/docs/superpowers/` contain completed, removed, renamed, or superseded tasks and reference missing files.

**Implementation**

- Add a visible “historical planning document” banner to those files or move them under `docs/archive/` without deleting useful history.
- Keep README and `docs/ARCHITECTURE.md` as current sources of truth.
- Add a short documentation index describing authority and last verification date.

## P1.3 — Green AI panel is promised but absent

**Evidence**

- `bytesSent` and `bytesIfRawData` are parsed and stored.
- `communicationSavings.ts` and its test are deleted in the current working tree.
- No visible component consumes the counters.

**Implementation**

Either:

1. restore a telemetry card that shows model-update bytes, hypothetical raw-learning bytes, baseline resets, and “application payload only” qualification; or
2. remove the visual/percentage claim and keep the counters as diagnostics.

Do not report energy savings. If energy is important, measure radio duty cycle or power draw with a defined baseline, include UDP/IP overhead and duplicate-interface sends, and exclude dashboard raw readings from the federated-learning comparison explicitly.

## P1.4 — “No raw data sharing” is too absolute

**Evidence**

Every heartbeat can include temperature and humidity for the observer dashboard.

**Implementation**

Short term: use the truthful wording already added to the root README—no cloud dataset upload, local-LAN observation, compact statistics for collaborative learning.

Long term: add a privacy mode:

- `OBSERVABILITY=state-only`: omit raw readings;
- `OBSERVABILITY=quantized`: send coarse ranges;
- `OBSERVABILITY=full`: demo telemetry.

The dashboard must display which mode is active.

## P1.5 — Humidity-aware anomaly detection is not implemented

**Evidence**

`NodeModel.score()` reads only `values["temp"]`.

**Implementation**

Do not simply add a humidity threshold. First collect paired normal/hazard recordings across temperature, humidity, airflow, device warm-up, and locations. Then add a calibrated feature such as humidity rate/drop relative to baseline and evaluate whether it improves false positives. Version the parameter contract if new model statistics must be shared.

Until then, describe humidity as observed telemetry only.

## P1.6 — Federated claims exceed the implementation

**Evidence**

- merge is weighted by `n`, not proximity;
- repeated aggregates can be merged again and double-count observations;
- full tuples are sent at a lower cadence, not sparse deltas.

**Implementation**

For a defensible next version:

1. assign each model update a node ID, epoch, and monotonic version;
2. keep per-origin sufficient statistics so an observation is not counted twice;
3. define weights from sample quality, recency, distance, or trust;
4. send a full checkpoint occasionally and versioned deltas otherwise;
5. test convergence, partitions, rejoin, clock reset, and malicious/extreme parameters.

If that scope is too large, rename the feature “neighbour pooling of model statistics.”

## P1.7 — Fire propagation over time is requested but absent

**Evidence**

- `extra.md` requests temporal spread and changing exits.
- The dashboard supports multiple fires and recalculates paths, but only after manual actions.

**Implementation**

Add a deterministic simulation clock separate from live mode:

1. represent fire cells/sources with ignition time, radius, growth rate, and environmental modifiers;
2. advance with a fixed timestep and seeded randomness;
3. derive newly hazardous vertices/edges from the growing geometry;
4. recompute routes after each state transition;
5. expose pause, step, speed, reset, and a visible “simulated spread” label;
6. unit-test deterministic timelines and route changes.

Never imply that this spread model predicts a real fire without calibration.

## P1.8 — Live forest deployment is not implemented

**Evidence**

`LIVE_SENSOR_IDS["forest-north"]` is empty.

**Implementation**

Add physical-to-forest mappings to the shared manifest, including verified coordinates and neighbour IDs. Decide whether IDs are globally unique or environment-scoped. Add gateway and frontend tests, then disable selection of unsupported live environments or label them clearly until packets exist.

## P1.9 — Gemma integration is narrower than promised

**Evidence**

- `facts()` is built but unused;
- no trend history is passed;
- exit topology is not passed;
- template is authoritative and Gemma only rewrites it;
- the WebSocket connection has no reconnect loop;
- `ai-summary` is not persisted.

**Implementation**

Keep the recommended architecture—deterministic facts first—but improve it:

1. create a versioned `SituationFacts` object with finite sources, consensus, offline nodes, authoritative guidance, and optional short trend summaries;
2. serialize that object into a constrained prompt;
3. require structured JSON output with schema validation, then render text;
4. reconnect to the gateway with bounded backoff;
5. persist the latest deterministic and Gemma summaries in the gateway snapshot;
6. retain state-version checks so stale generations are discarded.

Do not allow model output to create a new route or hazard fact.

## P1.10 — Exact hardware compatibility remains unverified in source

**Evidence**

`sketch.ino` and `app.yaml` still contain `UNVERIFIED` notes for Bridge APIs, Pixels, matrix calls, and LED pins, while other documentation sounds conclusive.

**Implementation**

Create a hardware acceptance checklist and record:

- board core and library versions;
- successful sketch compile/upload;
- every Bridge call;
- Thermo read stability;
- onboard LEDs, Pixels, and matrix;
- container and host execution;
- power-cycle/service restart;
- three-board hotspot test.

After proof, replace each `UNVERIFIED` marker with the exact tested version or keep it as a known unsupported variant.

## P1.11 — Fake failure/rejoin scenarios are static, not temporal

**Evidence**

`dashboard/demo/fake_nodes.py` loads one scenario at a time. `failure` always omits a node and `rejoin` includes it from the start.

**Implementation**

Add scripted phases to `scenarios.json`, for example `{duration, nodes, silent}`. The sender should advance on a monotonic clock and optionally loop. Keep `aggregate/sim.py` as the distributed-algorithm test; label fake nodes as a gateway/UI contract demo.

## P1.12 — Live event log is not populated

**Evidence**

`add-log` is used for simulation actions only. The Sensor Logs page therefore lacks a real live event history.

**Implementation**

Translate normalized live transitions into bounded log entries: node online/offline, alert start/clear, topology change, model update, and connection state. Deduplicate repeated snapshots and derive transitions from previous state, not every heartbeat.

## P1.13 — The multi-sensor environmental profile system is not implemented

**Evidence**

- the sensor bridge sends `temp` and `hum` directly;
- the ML module expects `values["temp"]`;
- the UDP packet, gateway parser, TypeScript domain model, telemetry cards, simulation engine, and reports contain temperature/humidity and hazard-specific fields;
- fire, alert, evacuation, and escape vocabulary is embedded in domain and UI code.

**Impact**

The Gaia architecture can be adapted to agriculture, CO₂, air quality, water, soil, or ecosystem monitoring, but a developer cannot add one of those profiles by registering a sensor. They must currently edit hardware code, Python contracts, gateway validation, frontend types, selectors, components, tests, and copy.

**Implementation**

1. Define a versioned `EnvironmentalProfile` contract containing measurement definitions, units, local-state schema, model-update schema, collective semantics, actuator mapping, and presentation metadata.
2. Replace top-level sensor-specific packet fields with a bounded, typed measurement map while retaining a migration adapter for the current v1 heartbeat.
3. Define a `ProfileModel` interface for score/state calculation, model export/merge, persistence, and health.
4. Make the node's aggregate engine operate on generic `source`, `fieldDistance`, `consensus`, and profile-defined state instead of temperature-specific variables.
5. Make gateway validation discriminate on profile ID and schema version.
6. Render generic measurements from metadata; allow optional profile-specific dashboard panels when a generic chart is insufficient.
7. Build one second profile, such as CO₂ or soil moisture, as the acceptance test for the abstraction.

**Acceptance criterion**

A second environmental profile can be added through a sensor adapter, profile package, manifest configuration, and tests without modifying the core node, gateway store, live adapter, or generic telemetry components.

# P2 — Reliability, security, and operational readiness

## P2.1 — No device identity, authentication, or encryption

**Evidence**

UDP 5005/5006 and gateway APIs trust any local sender. There is no signature, anti-replay window, TLS, user authentication, or rate limit.

**Implementation**

For a pilot:

- provision a unique device key/certificate;
- sign messages with node ID, boot ID, sequence, and timestamp;
- reject replayed/out-of-window sequences;
- bind the sensor bridge to loopback or authenticate the client;
- put HTTPS/WSS and authenticated APIs in front of the gateway;
- validate event type permissions;
- rate-limit and log rejected traffic;
- rotate credentials and document recovery.

## P2.2 — Model and gateway state are not durable

**Evidence**

Node baselines, gateway snapshots, counters, deduplication history, and reports live in memory.

**Implementation**

- Persist model checkpoints atomically with schema version, timestamp, node identity, and calibration metadata.
- Restore only compatible, validated checkpoints.
- Decide whether gateway state is ephemeral by design; if not, use a small local database and retention policy.
- Persist the last report if reconnection should reproduce it.
- Add reboot/recovery tests.

## P2.3 — Model access is not thread-safe

**Evidence**

Scoring, `get_params`, byte counters, and neighbour merge can run from different threads against one global model.

**Implementation**

Add a model lock or move all model mutation to one worker queue. Snapshot parameters under the same lock and keep network I/O outside it. Add concurrency tests with scoring and merge loops.

## P2.4 — Repeated federation can double-count data

This is both a research issue and a reliability issue. Implement origin-aware versions or a real decentralized aggregation protocol rather than repeatedly pooling already-pooled `n` values. Add convergence tests under cycles and partitions.

## P2.5 — Out-of-order UDP can overwrite newer gateway state

**Evidence**

Gateway receipt order intentionally wins so a reboot with a lower timestamp can rejoin. A delayed old packet can therefore replace a newer reading.

**Implementation**

Add `boot` plus a per-boot monotonic sequence to the validated protocol. Accept any new boot, then require increasing sequence inside that boot. Keep gateway receipt time only for freshness.

## P2.6 — Health endpoint is shallow

**Evidence**

`GET /health` only confirms FastAPI is alive.

**Implementation**

Return separate checks for UDP listener thread, last valid packet age, manifest validity, connected WebSocket clients, store size, report age, and optional Ollama status. Use distinct liveness and readiness endpoints.

## P2.7 — `stale` state is effectively skipped

**Evidence**

The live adapter calls freshness logic with both stale and offline thresholds set to four seconds. At the boundary, `offline` wins.

**Implementation**

Define two actual windows, for example stale after two missed heartbeats and offline after four or five. Keep gateway and frontend policy aligned in one config/contract and test the transition timeline.

## P2.8 — Alert and hazard validation is shallow in the browser

**Evidence**

Live sensors are normalized field by field; alert and hazard payloads are mostly object casts.

**Implementation**

Create strict runtime validators for every `NetworkEvent` variant. Reject unknown environment/sensor IDs, invalid vectors, invalid severities, huge strings/arrays, and unsupported hazard kinds. Share schemas with gateway generation where practical.

## P2.9 — Sensor-process failure is hidden by fallback behaviour

**Evidence**

When the hardware client disappears, the mesh process can remain connected and fall back to simulated readings if `FAKE_SENSOR=1`.

**Implementation**

Add an explicit sensor-source state: `measured`, `simulated`, `stale`, `missing`. In hardware/production mode, never silently switch to synthetic data. Make demo fallback an explicit flag and surface it on LEDs and dashboard.

## P2.10 — Sensor CSV grows without rotation

**Implementation**

Use size/time rotation, maximum retention, available-disk checks, and an explicit calibration-recording mode. Normal service operation should not write unlimited raw samples by default.

## P2.11 — Bridge setup is not atomic

**Evidence**

`setup_bridge.sh` can remove the existing `.bridge` before a replacement is proven usable.

**Implementation**

Copy into a temporary sibling directory, run import/socket checks there, then atomically rename it into place while retaining one rollback copy.

## P2.12 — UDP port-sharing behaviour is platform-dependent

**Evidence**

Nodes and gateway rely on `SO_REUSEADDR` to observe the same broadcast port. Delivery semantics differ by OS.

On the current macOS verification host, `aggregate/check_dashboard.py` received the initial heartbeat from all three nodes, then a child node exited and the check stopped with `BrokenPipeError`. The script starts the gateway listener and three broadcast-mode nodes on UDP `5005`, so it reproduces the portability problem rather than isolating the protocol contract.

**Implementation**

Document supported operating systems and test them. For portability, run one local UDP collector that fans out validated packets internally, or use multicast with explicit group membership and platform tests. Rewrite `check_dashboard.py` so the real node processes use their existing per-node unicast ports and the test forwards captured datagrams directly to `parse_udp_packet`/`GatewayStore`; the contract test must not require four processes to bind the same UDP port.

## P2.13 — Logical gradient is not a proven routing protocol

**Evidence**

`via` prevents immediate two-node count-to-infinity but does not establish convergence for every cyclic failure case.

**Implementation**

Add source epoch/sequence, metric age, poison reverse or explicit invalidation, and topology tests covering rings, multiple sources, partition/merge, source loss, and delayed packets. If the goal is routing-grade correctness, adopt a documented protocol rather than extending ad hoc distance-vector rules.

# P3 — Product quality, accessibility, performance, and maintainability

## P3.1 — Accessibility gaps in Settings and Live Field

**Evidence**

- custom Settings dialog lacks initial focus, trap, inert background, Escape lifecycle, and explicit focus restoration;
- SVG graph nodes handle Enter but not Space.

**Implementation**

Use native `<dialog>` consistently or a tested accessible dialog primitive without adding a dependency unless necessary. Add keyboard tests for Tab order, Escape, focus return, Enter and Space activation. Run automated axe checks plus manual keyboard/screen-reader verification.

## P3.2 — No component/browser/WebGL E2E tests

**Implementation**

Add a small high-value browser suite:

- Simulation loads and modifies state;
- mode switch and WebSocket snapshot;
- responsive panel navigation;
- keyboard interactions and dialogs;
- WebGL fallback message;
- live node offline/rejoin timeline;
- route hidden or clearly qualified in Live mode.

Keep pure algorithm tests as the majority; use browser tests for integration boundaries only.

## P3.3 — Model checks print results but do not assert

**Evidence**

`sensing_ml/test_model.py` can print an undesirable value and still exit successfully.

**Implementation**

Convert it to `unittest` or `pytest` assertions with deterministic seeds. Test warm-up, contamination guard, thresholds, cold start, counter semantics, invalid inputs, merge math, cap behaviour, and thread safety.

## P3.4 — Main 3D scene and previews can be expensive

**Evidence**

The main canvas renders continuously with high-resolution shadows; the Environments view mounts two 3D previews.

**Implementation**

Profile before changing. Likely improvements:

- render on demand when no animation is active;
- lower shadow resolution on mobile/integrated GPUs;
- pause canvases when hidden;
- use static preview images or a shared preview renderer;
- expose a reduced-quality setting and honor reduced motion/data preferences.

Measure frame time, GPU memory, and interaction responsiveness on the demo laptop.

## P3.5 — Public-web SEO and sharing metadata are incomplete

This is not a problem for a local operations dashboard. If the same Next.js app becomes the public project site, add separate indexable marketing routes, canonical URL, Open Graph/Twitter image, sitemap, robots policy, structured project data, stable headings, and crawlable content. Do not expose the operational gateway through that deployment.

## P3.6 — Current views are not deep-linkable

All “pages” are reducer state at `/`. If shareable dashboard views matter, map page/environment/mode to URL routes or validated query parameters and restore state on load.

## P3.7 — Dead or ambiguous code remains

Examples found:

- exported `MetricCard` without a consumer;
- route status `unavailable` while the pathfinder returns `null` instead;
- parsed `via` and `sourceTimestamp` with little or no presentation;
- deleted modules still described in older documentation.

**Implementation**

For each item, search the complete repository, decide whether it belongs to an imminent feature, then remove it or add its consumer. Add an unused-export check only after accounting for Next.js entry points and test-only exports.

## P3.8 — No CI gate is visible

**Implementation**

Add a repository workflow that installs locked dependencies and runs frontend tests, typecheck, build, gateway tests, demo tests, model assertion tests, Markdown link checks, and selected aggregate scenarios on a runner that permits loopback UDP.

## P3.9 — License and provenance are missing

**Implementation**

Choose a project license with team agreement. Add:

- `LICENSE`;
- third-party notices where required;
- logo ownership/license;
- dataset provenance and consent;
- Arduino library/toolchain credits;
- Gemma model/license references;
- generated asset provenance.

Until then, do not state that the repository is open source merely because it is publicly readable.

## P3.10 — Presentation media are missing from the repository

No project screenshots, hardware photos, wiring diagram, or presentation assets are tracked. Create a lightweight `docs/media/` set for optimized images and diagrams. Host video externally or through release assets rather than committing large recordings to Git.

## P3.11 — Demo documentation needs one authoritative runbook

**Implementation**

Merge verified startup order, correct ports, three-node count, Gemma option, failure recovery, and teardown into one current runbook. Link older planning files as history. Add “last rehearsed on” with hardware, OS, library versions, network, and result.

## Recommended implementation order

### Gate A — Truthful, safe hackathon demo

1. Fix finite-distance handling in `escape_to` and Gemma template.
2. Hide or clearly separate browser routes in Live mode.
3. Choose two or three physical nodes and reconcile manifests/runbooks.
4. Validate the complete UNO Q boot → sensing → LED → network path.
5. Restore a qualified Green AI panel or remove its claim.
6. Update all pitch language for temperature-only scoring, local-LAN raw readings, and optional Gemma.
7. Record a backup video after consensus, failure, rejoin, and dashboard-closure rehearsal.

### Gate B — Robust local pilot

1. Introduce the environmental profile and typed measurement contracts.
2. Prove the abstraction with one non-fire profile, such as CO₂ or soil moisture.
3. Add strict node and browser protocol validation.
4. Add boot/sequence ordering and device authentication.
5. Make hardware failure explicit; remove silent synthetic fallback in pilot mode.
6. Persist model checkpoints and synchronize model access.
7. Add readiness telemetry, log transitions, rotation, and report reconnect/persistence.
8. Add browser E2E and automated aggregate scenarios.

### Gate C — Research validation

1. Define each target environmental profile and collect representative multi-node datasets.
2. Evaluate profile-specific features with held-out data.
3. Replace repeated pooling with an origin-aware federated protocol.
4. Measure real bandwidth, power, latency, and failure recovery.
5. Validate every recommended action with the relevant domain experts and users.
6. Consider dedicated low-power/multi-hop transport after the state protocol is stable.

## Definition of “complete” for the next release

A release should not be called complete until:

- every public claim maps to a passing test, measurement, or clearly labeled simulation;
- no unknown-distance node can be recommended as safe;
- live and simulated guidance are visually distinct;
- node input is validated and cannot crash on malformed packets;
- manifests and runbooks agree on node count and ports;
- physical startup, consensus, loss, rejoin, and dashboard independence are rehearsed;
- all automated tests, typecheck, and build pass;
- manual browser/hardware checks are recorded rather than assumed;
- security and certification limits are visible in the product and documentation.
