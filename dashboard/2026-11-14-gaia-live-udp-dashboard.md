# Gaia Live UDP Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Gaia dashboard to the real Arduino UDP stream and expose the alert gradient, environmental readings, deterministic situation report, and Green AI savings required by the three-minute demo.

**Architecture:** Preserve the existing Next.js digital twin and adapter boundary. Add a UDP receiver and compact-packet normalizer to the local Python gateway, stream enriched snapshots to the existing frontend, and make live `dist`/`alert` authoritative. Keep deterministic simulation for scale and add a standard-library fallback viewer for demo recovery.

**Tech Stack:** Python UDP sockets, existing FastAPI/WebSocket gateway, Next.js 16, React 19, TypeScript, React Three Fiber, Node test runner, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-11-14-gaia-live-demo-gap-analysis.md`

## Global Constraints

- The dashboard is a passive observer and never sends commands to physical nodes in Live mode.
- UDP input binds port `5005` and accepts the canonical packet including temperature and humidity.
- `dist` and `alert` come from the network; the live frontend does not recalculate them.
- Status mapping is exact: `dist == 0` or `alert` red, `dist` 1–2 amber, larger finite `dist` green, not heard for four seconds grey.
- The last valid data remains visible during interruption but is labeled stale/offline, never safe.
- Configured topology and laptop simulation are labeled honestly.
- Missing Green AI counters render an unavailable state instead of estimated numbers.
- The deterministic situation report always works without Gemma.
- The full demo remains locally runnable without cloud services.

## Review Focus

- Malformed JSON, missing required fields, booleans passed as numbers, NaN/infinity, and oversized UDP datagrams must be rejected without stopping reception; covered by Task 2 gateway tests.
- Out-of-order `ts`, duplicate packets, and node reboot/counter reset must not rewind readings or create negative byte savings; covered by Tasks 2 and 5 tests.
- Numeric Arduino IDs that are unknown or mapped to the wrong environment must not corrupt a configured scene; covered by Tasks 1 and 2 tests.
- Gateway loss and individual node silence must preserve the last reading while producing the correct non-safe connection/offline state at four seconds; covered by Tasks 3 and 4 tests.
- Switching between Simulation and Live must never leak simulated alerts, hazards, or controls into live evidence; covered by Task 7 integration tests.

---

### Task 1: Freeze the compact protocol and physical-node manifest

**Files:**
- Create: `gateway/protocol.py`
- Create: `gateway/node_manifest.json`
- Modify: `src/domain/types.ts`
- Test: `gateway/tests/test_protocol.py`
- Test: `src/live/protocol.test.ts`

**Interfaces:**
- Produces: Python `parse_udp_packet(data: bytes) -> UdpNodePacket`, `load_node_manifest(path) -> NodeManifest`, TypeScript `LiveNodeMetrics`, and sensor fields `gradientDistance`, `mu`, `sigma`, `networkAlert`, `bytesSent`, `bytesIfRawData`, and `sourceTimestamp`.

- [ ] Write failing Python tests for the canonical packet, temperature/humidity preservation, missing fields, invalid numeric values, and payloads over the receive limit.
- [ ] Run `python3 -m unittest gateway.tests.test_protocol -v`; expect failures because the parser does not exist.
- [ ] Define strict packet validation and a manifest mapping the physical numeric IDs to existing Gaia sensor IDs and configured neighbours.
- [ ] Extend the TypeScript domain model with nullable live-only metrics without changing simulation compatibility.
- [ ] Add frontend normalization tests that prove `temperature`, `humidity`, `dist`, `mu`, `sigma`, `alert`, `ts`, and byte counters survive gateway normalization.
- [ ] Run the Python protocol tests, `npm test`, and `npm run typecheck`; expect all to pass.
- [ ] Commit with `git commit -m "feat: define live UDP telemetry contract"` when the repository is under version control.

### Task 2: Receive UDP and store ordered node snapshots

**Files:**
- Create: `gateway/udp_listener.py`
- Modify: `gateway/store.py`
- Modify: `gateway/main.py`
- Test: `gateway/tests/test_udp_listener.py`
- Test: `gateway/tests/test_store.py`

**Interfaces:**
- Consumes: Task 1 `parse_udp_packet` and node manifest.
- Produces: `UdpListener(host, port, on_packet)`, `GatewayStore.update_udp_packet(packet, received_at)`, and enriched gateway sensor snapshots.

- [ ] Write failing listener tests using an ephemeral UDP port for valid receipt, malformed-packet survival, and continuous reception after an error.
- [ ] Write failing store tests for ID enrichment, newest-`ts` ordering, duplicate packets, per-node receipt timestamps, and four-second offline transitions.
- [ ] Run the new gateway tests and verify the expected failures.
- [ ] Implement the listener with `SO_REUSEADDR`, a bounded datagram size, a daemon/background lifecycle, and error isolation.
- [ ] Enrich compact packets from the manifest; keep node `ts` and gateway receipt time as separate fields.
- [ ] Start and stop the UDP listener with the gateway lifespan and broadcast accepted updates to browser clients.
- [ ] Run `python3 -m unittest discover -s gateway/tests -v`; expect all gateway tests to pass.
- [ ] Commit with `git commit -m "feat: ingest Arduino UDP telemetry"` when version control is available.

### Task 3: Normalize live gradient state in the frontend

**Files:**
- Modify: `src/live/protocol.ts`
- Modify: `src/live/LiveNetworkAdapter.ts`
- Modify: `src/live/freshness.ts`
- Modify: `src/state/appReducer.ts`
- Test: `src/live/protocol.test.ts`
- Create: `src/live/LiveNetworkAdapter.test.ts`
- Modify: `src/live/freshness.test.ts`

**Interfaces:**
- Consumes: enriched gateway events from Task 2.
- Produces: `statusFromNetwork(dist, alert, freshness): SensorStatus`, ordered live event ingestion, and a four-second offline policy.

- [ ] Add failing tests for exact red/amber/green/grey mapping, packet ordering, alert recovery, gateway reconnect, and preservation of the last valid reading.
- [ ] Run the focused live tests and confirm failures.
- [ ] Normalize gateway payloads without requiring the UDP packet itself to contain UI name, position, or string environment ID.
- [ ] Make received `dist` and `alert` authoritative in Live mode and change freshness to offline after four seconds.
- [ ] Ensure snapshots clear recovered alerts/hazards instead of only appending events indefinitely.
- [ ] Run `npm test` and `npm run typecheck`; expect all to pass.
- [ ] Commit with `git commit -m "feat: map live network gradient state"` when version control is available.

### Task 4: Render authoritative `dist`, measurements, and alert banner

**Files:**
- Create: `src/components/operations/AlertBanner.tsx`
- Modify: `src/components/pages/OverviewDashboard.tsx`
- Modify: `src/components/telemetry/HazardGradientPanel.tsx`
- Modify: `src/components/telemetry/SensorCard.tsx`
- Modify: `src/components/scene/SensorMarker.tsx`
- Modify: `src/components/scene/NetworkLinks.tsx`
- Modify: `src/styles/dashboard.css`
- Test: `src/domain/hazardGradient.test.ts`
- Create: `src/components/operations/alertBannerModel.test.ts`

**Interfaces:**
- Consumes: Task 3 live sensor metrics and status.
- Produces: `deriveAlertBanner(environment)`, live node labels with network-reported `dist`, and a simulation-only fallback gradient.

- [ ] Write failing model tests for `ALL CLEAR`, `WARNING`, `ALERT`, disconnected, and all-nodes-offline banners.
- [ ] Write failing gradient tests proving Live mode displays received `dist` even when the configured graph would produce a different hop count.
- [ ] Run focused tests and confirm failures.
- [ ] Add the large banner to the Overview page without covering the primary 3D scene.
- [ ] Show `dist` on gradient nodes and selected 3D nodes; retain current graph-derived levels only in Simulation mode.
- [ ] Show temperature, humidity, anomaly, `mu`, and `sigma` in the selected-node detail while keeping the dense sensor list readable.
- [ ] Add the exact read-only statement to the live workspace.
- [ ] Run the full frontend test, typecheck, and build suite.
- [ ] Commit with `git commit -m "feat: show network reported alert gradient"` when version control is available.

### Task 5: Add deterministic situation reporting and Green AI evidence

**Files:**
- Create: `src/domain/situationReport.ts`
- Create: `src/domain/communicationSavings.ts`
- Modify: `src/components/operations/OperationalCards.tsx`
- Modify: `src/components/operations/intelligence.ts`
- Modify: `src/styles/dashboard.css`
- Test: `src/domain/situationReport.test.ts`
- Test: `src/domain/communicationSavings.test.ts`

**Interfaces:**
- Produces: `buildSituationReport(environment): SituationReport` and `calculateCommunicationSavings(sensors): CommunicationSavings | null`.

- [ ] Write failing report tests for all clear, one/multiple sources, safest area, offline nodes, and missing measurements.
- [ ] Write failing savings tests for cumulative counters, missing counters, counter reset, and invalid `bytes_if_raw_data < bytes_sent` input.
- [ ] Run the focused tests and confirm failures.
- [ ] Implement a deterministic primary report and render any gateway/Gemma report as a separate labeled supplement.
- [ ] Add the Green AI card with bytes sent, raw-data equivalent, bytes avoided, and reduction percentage.
- [ ] Label the counters' scope and show `Awaiting counters` until real values arrive.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Commit with `git commit -m "feat: add situation and communication evidence"` when version control is available.

### Task 6: Build the fake UDP sender and demo sequences

**Files:**
- Create: `demo/fake_nodes.py`
- Create: `demo/scenarios.json`
- Create: `demo/README.md`
- Test: `demo/tests/test_fake_nodes.py`

**Interfaces:**
- Produces: `python3 demo/fake_nodes.py --scenario nominal|alert|failure|rejoin --host HOST --port 5005`.

- [ ] Write failing tests for one-packet-per-second cadence abstraction, deterministic payloads, source-node alert, `dist` propagation, node silence, and rejoin.
- [ ] Implement fake nodes using only the Python standard library and the canonical Task 1 contract.
- [ ] Add a scripted end-to-end sequence matching the three-minute pitch without sending any control packet to real boards.
- [ ] Document how to switch from fake nodes to Arduino broadcasts.
- [ ] Run the fake-node and gateway tests together.
- [ ] Commit with `git commit -m "test: add repeatable UDP demo scenarios"` when version control is available.

### Task 7: Isolate Live and Simulation behavior

**Files:**
- Modify: `src/state/AppProvider.tsx`
- Modify: `src/state/appReducer.ts`
- Modify: `src/components/operations/SimulationBar.tsx`
- Modify: `src/components/shell/TopBar.tsx`
- Modify: `src/state/appReducer.test.ts`
- Create: `src/state/liveSimulationIsolation.test.ts`

**Interfaces:**
- Produces: mode transitions that reset incompatible state and simulation controls that cannot affect Live mode.

- [ ] Write failing tests proving simulation hazards do not survive entry into Live mode and live readings do not get labeled as simulated consensus.
- [ ] Add an explicit confirmation/label when switching data sources during a running demo.
- [ ] Keep simulation controls hidden and inert in Live mode; do not implement node command transmission in this iteration.
- [ ] Add live network events to Sensor Logs with bounded history and recovery entries.
- [ ] Run full frontend verification.
- [ ] Commit with `git commit -m "fix: isolate live evidence from simulation state"` when version control is available.

### Task 8: Provide a standard-library fallback dashboard

**Files:**
- Create: `demo/server.py`
- Create: `demo/index.html`
- Create: `demo/tests/test_server.py`

**Interfaces:**
- Produces: UDP `:5005`, HTTP `:8000`, and `/state` JSON polling every 500 ms with no third-party Python packages.

- [ ] Write failing tests for `/state`, four-second offline state, malformed UDP survival, and static page serving from paths independent of the current working directory.
- [ ] Implement the fallback receiver/server with the same parser and manifest semantics as the primary gateway, or a dependency-free shared equivalent.
- [ ] Implement circles, configured neighbour lines, `dist`, alert banner, report, byte panel, and read-only label in one HTML page.
- [ ] Verify that closing the fallback page does not affect UDP reception or any physical node behavior.
- [ ] Document the single command `python3 demo/server.py` and recovery procedure.
- [ ] Commit with `git commit -m "feat: add dependency-free demo fallback"` when version control is available.

### Task 9: End-to-end demo and failure rehearsal

**Files:**
- Modify: `README.md`
- Modify: `gateway/README.md`
- Create: `docs/demo-runbook.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a repeatable setup and evidence checklist for the physical demo and backup recording.

- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `python3 -m unittest discover -s gateway/tests -v`; record the passing output in the runbook.
- [ ] Resolve the current `Gaia` versus `EchoField` naming mismatch and use the selected name consistently in the UI, pitch, repository, Project Hub, Junction submission, screenshots, and video.
- [ ] Start from a powered-off state and verify nominal packets, heat alert, gradient propagation, one node unplugged for over four seconds, rejoin, and dashboard closure while LEDs continue.
- [ ] Verify packet loss, malformed packets, duplicate/out-of-order timestamps, gateway restart, and node counter reset.
- [ ] Check the full UI at 1440×900 and the fallback at a common laptop viewport; confirm banner, gradient, report, byte panel, and read-only label remain visible.
- [ ] Record the backup video immediately after the first successful end-to-end run.
- [ ] Rehearse the three-minute script twice using real nodes and once using only fake nodes/fallback.
- [ ] Update documentation with the exact hotspot, host IP, ports, startup order, and recovery commands used on the demo machine.
- [ ] Commit with `git commit -m "docs: add Gaia live demo runbook"` when version control is available.

## Recommended execution order

Tasks 1–5 are the minimum viable live dashboard and should be completed first. Task 6 makes development independent from the Arduino team. Task 7 prevents misleading demo state. Task 8 is the reliability fallback. Task 9 is mandatory before adding any further visual polish.

If time is constrained, postpone optional Gemma text and aesthetic refinements. Do not postpone UDP ingestion, authoritative `dist`, the four-second offline rule, the alert banner, deterministic report, Green AI counters, fake UDP sender, or end-to-end rehearsal.

