# Gaia Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Next.js digital-twin dashboard that demonstrates Gaia's decentralized sensor network in deterministic simulation mode and can consume normalized live WebSocket telemetry without changing UI components.

**Architecture:** The application uses typed domain models and pure calculation modules beneath a shared adapter contract. A React context/reducer owns only normalized application and presentation state; simulation and live adapters feed identical events into it. React Three Fiber scenes read the same state as the telemetry UI, while routing, consensus, freshness, and topology calculations stay outside components.

**Tech Stack:** Next.js App Router, React, TypeScript, React Three Fiber, Three.js, Drei, Lucide React, Vitest, Testing Library, CSS Modules/global CSS variables, optional Python FastAPI gateway.

**Spec:** `docs/superpowers/specs/2026-11-14-gaia-dashboard-design.md`

## Global Constraints

- Preserve the visual direction and tokens in `DESIGN.md`, the supplied screenshots, `logo.svg`, and `complete_logo.svg`.
- The desktop dashboard must fit 1440×900 and 1920×1080 without body scrolling; mobile uses `Map`, `Sensors`, and `Analysis` panels.
- The dashboard is a passive observer; simulated consensus and routing are always labeled simulation, while live consensus is accepted only from the gateway.
- Runtime assets are local/procedural; simulation requires no external API after the page loads.
- A high reading, local anomaly, network-confirmed alert, and visual simulated fire are separate domain states.
- All controls are functional, deterministic, combinable, and restore through `Reset All`.
- Routes follow configured graph edges through rooms, doors, corridors, stairs, exits, and trails; they never draw straight lines through walls.
- Live mode distinguishes gateway disconnected, node offline, stale data, normal data, and simulation active.
- The frontend is Vercel-compatible; the optional WebSocket gateway is a separate service.

## Review Focus

- Malformed or unknown live events must be ignored without corrupting the last valid snapshot; covered by Task 3 adapter tests.
- Concurrent fire, blockage, and offline-node scenarios must combine deterministically; covered by Task 2 simulation tests and Task 4 routing tests.
- A selected room with every exit unreachable must show `No available route`; covered by Task 4 routing tests and Task 8 interaction tests.
- A gateway loss must preserve readings but mark them stale/disconnected, never safe; covered by Task 3 freshness tests.
- Very short viewport heights and touch widths must not cause body overflow or inaccessible controls; covered by Task 9 browser verification.

---

### Task 1: Project foundation, domain types, and environment configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `public/logo.svg`, `public/complete_logo.svg`
- Create: `src/domain/types.ts`, `src/domain/adapter.ts`
- Create: `src/config/environments.ts`
- Test: `src/config/environments.test.ts`

**Interfaces:**
- Produces: `DataAdapter`, `EnvironmentDefinition`, `EnvironmentState`, `SensorNode`, `SensorReading`, `NetworkTopology`, `NetworkEvent`, `RouteGraph`, and `ENVIRONMENTS`.

- [ ] Write configuration tests asserting four environments (`building-a`, `building-b`, `forest-north`, `forest-south`), unique node IDs, valid neighbour references, valid graph references, and at least one exit per environment.
- [ ] Run `npm test -- src/config/environments.test.ts` and confirm failure before implementation.
- [ ] Create the Next.js/Vitest foundation and exact domain interfaces from the implementation instructions.
- [ ] Define reusable deterministic building and forest configurations, with Building B and Forest South reusing model kinds but retaining independent state.
- [ ] Copy the supplied logos to `public/` and create the minimal route shell.
- [ ] Run the configuration test, `npm run typecheck`, and confirm both pass.

### Task 2: Deterministic simulation engine and topology/consensus calculations

**Files:**
- Create: `src/simulation/scenarios.ts`, `src/simulation/engine.ts`, `src/simulation/SimulationAdapter.ts`
- Create: `src/domain/topology.ts`, `src/domain/selectors.ts`
- Test: `src/simulation/engine.test.ts`, `src/domain/topology.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `ENVIRONMENTS`.
- Produces: `SimulationAction`, `applySimulationAction(state, action)`, `deriveTopology(state)`, `deriveConsensus(state)`, and `SimulationAdapter implements DataAdapter`.

- [ ] Write failing tests for temperature increase, local anomaly without confirmed fire, confirmed simulated fire, blockage, node disable, network failure, combined scenarios, and reset.
- [ ] Write failing topology tests proving offline links disappear, only allowed/range-valid fallback links appear, and unaffected nodes remain connected.
- [ ] Implement deterministic scenario updates and event history without timers that make tests flaky.
- [ ] Implement simulated consensus as an explicitly labeled derived result based on configured neighbour reports.
- [ ] Implement `SimulationAdapter` snapshot/subscription/dispatch behavior.
- [ ] Run Task 2 tests and `npm run typecheck`; confirm pass.

### Task 3: Live WebSocket adapter and freshness handling

**Files:**
- Create: `src/live/protocol.ts`, `src/live/LiveNetworkAdapter.ts`, `src/live/freshness.ts`
- Test: `src/live/protocol.test.ts`, `src/live/LiveNetworkAdapter.test.ts`, `src/live/freshness.test.ts`

**Interfaces:**
- Consumes: Task 1 `DataAdapter`, `NetworkEvent`, and state types.
- Produces: `normalizeGatewayMessage(value)`, `LiveNetworkAdapter implements DataAdapter`, `getFreshness(lastUpdate, now, policy)`, and connection states `connecting | connected | reconnecting | disconnected`.

- [ ] Write failing normalization tests for snapshots, readings, topology, alerts, hazards, AI summaries, malformed data, and unknown node/environment IDs.
- [ ] Write failing adapter tests for initial snapshot, ordered updates, reconnect backoff, disconnect, and state preservation.
- [ ] Write freshness tests asserting stale/disconnected readings are never converted to normal/safe.
- [ ] Implement runtime validation and normalized event mapping without claiming frontend-derived live consensus.
- [ ] Implement injectable WebSocket creation, heartbeat timeout, capped reconnect backoff, and cleanup.
- [ ] Run Task 3 tests and `npm run typecheck`; confirm pass.

### Task 4: Hazard-aware multi-floor evacuation routing

**Files:**
- Create: `src/routing/priorityQueue.ts`, `src/routing/pathfinding.ts`, `src/routing/routeSelectors.ts`
- Test: `src/routing/pathfinding.test.ts`, `src/routing/routeSelectors.test.ts`

**Interfaces:**
- Consumes: Task 1 graph types and Task 2 scenario state.
- Produces: `findEvacuationRoutes(graph, originId, constraints): EvacuationRoute[]` and `selectBestRoute(routes): EvacuationRoute | null`.

- [ ] Write failing tests for room-to-exit routing, stairs, blocked edge exclusion, hazard-zone exclusion, hazard-first cost ordering, alternative route ordering, origin inside hazard, and no reachable exit.
- [ ] Implement deterministic Dijkstra routing with lexicographic risk/distance cost and exact configured edge geometry.
- [ ] Implement route selectors that return primary/alternative routes and `null` for unreachable origins.
- [ ] Run Task 4 tests and `npm run typecheck`; confirm pass.

### Task 5: Centralized application store and adapter switching

**Files:**
- Create: `src/state/appReducer.ts`, `src/state/AppProvider.tsx`, `src/state/hooks.ts`, `src/state/selectors.ts`
- Test: `src/state/appReducer.test.tsx`

**Interfaces:**
- Consumes: both adapters, environment configurations, simulation actions, route/consensus selectors.
- Produces: `AppProvider`, `useGaiaState()`, `useGaiaActions()`, and presentation actions for environment, floor, sensor, room, panel, route/link visibility, and mode.

- [ ] Write failing reducer/provider tests for environment switching, independent per-environment state, room/sensor selection, adapter event ingestion, mode switching, and reset.
- [ ] Implement normalized state ownership and memoized domain selectors; keep domain calculations out of React components.
- [ ] Ensure mode switching disposes the prior adapter and retains only valid selection for the active environment.
- [ ] Run Task 5 tests and `npm run typecheck`; confirm pass.

### Task 6: Shared design system and dashboard shell

**Files:**
- Create: `src/components/ui/Button.tsx`, `Card.tsx`, `StatusBadge.tsx`, `SegmentedControl.tsx`, `MetricCard.tsx`, `Dialog.tsx`
- Create: `src/components/shell/TopBar.tsx`, `DashboardShell.tsx`, `MobilePanelTabs.tsx`
- Create: `src/components/telemetry/TelemetryPanel.tsx`, `SensorCard.tsx`
- Create: `src/styles/tokens.css`, `src/styles/components.css`, `src/styles/dashboard.css`
- Test: `src/components/telemetry/TelemetryPanel.test.tsx`

**Interfaces:**
- Consumes: Task 5 hooks/selectors.
- Produces: the viewport-fitted application shell and reusable accessible UI primitives.

- [ ] Write failing component tests for sensor selection, status/source labels, stale/offline distinction, and keyboard activation.
- [ ] Translate `DESIGN.md` into CSS variables and reusable primitives.
- [ ] Implement top bar, desktop two-column shell, internal sensor-list scrolling, and mobile panel tabs.
- [ ] Implement telemetry metrics and sensor cards connected to shared state.
- [ ] Run Task 6 tests and `npm run typecheck`; confirm pass.

### Task 7: Reusable React Three Fiber digital twins

**Files:**
- Create: `src/components/scene/DigitalTwin.tsx`, `SceneCamera.tsx`, `SensorMarker.tsx`, `NetworkLinks.tsx`, `HazardMarker.tsx`, `FireEffect.tsx`, `ExitMarker.tsx`, `EvacuationPath.tsx`, `RoomSelection.tsx`
- Create: `src/components/scene/building/BuildingScene.tsx`, `BuildingShell.tsx`, `BuildingFurniture.tsx`
- Create: `src/components/scene/forest/ForestScene.tsx`, `Terrain.tsx`, `Trees.tsx`, `WaterFeature.tsx`
- Test: `src/components/scene/sceneModel.test.ts`

**Interfaces:**
- Consumes: environment definition, current snapshot, topology, selected route, and presentation callbacks.
- Produces: `DigitalTwin` supporting both `building` and `forest` model kinds, synchronized sensor/room selection, floor filtering, and camera reset.

- [ ] Write scene-model tests asserting that marker, link, hazard, route, exit, room, and floor visibility data is derived correctly for both model kinds.
- [ ] Implement shared markers, labels, links, hazards, fire, exits, routes with directional arrows, room hit targets, orbit controls, and reset.
- [ ] Implement a detailed two-level cutaway whose doors and corridors align with graph geometry.
- [ ] Implement deterministic elevated forest terrain with instanced local trees, trails, clearings, water, and exits aligned with graph geometry.
- [ ] Cap DPR/shadows, add Suspense fallback, and reduce/pause animation for reduced-motion.
- [ ] Run Task 7 tests and `npm run typecheck`; confirm pass.

### Task 8: Operational panels, simulation controls, overview, and logs

**Files:**
- Create: `src/components/operations/MapToolbar.tsx`, `EvacuationCard.tsx`, `IntelligenceCard.tsx`, `SimulationBar.tsx`, `ConsensusPanel.tsx`
- Create: `src/components/pages/OverviewDashboard.tsx`, `EnvironmentsOverview.tsx`, `SensorLogs.tsx`
- Modify: `app/page.tsx`
- Test: `src/components/pages/OverviewDashboard.test.tsx`, `src/components/pages/EnvironmentsOverview.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–7 state/actions/components.
- Produces: complete navigable application experience and every specified simulation control.

- [ ] Write failing interaction tests covering all controls, combined scenarios, automatic route updates, unreachable copy, topology visibility, environment overview cards, and mode labeling.
- [ ] Implement environment cards with status, active/offline counts, alerts, and last synchronization.
- [ ] Implement toolbar, route card, alternatives, simulated decision-support disclaimer, deterministic intelligence summary, consensus panel, logs, and simulation bar.
- [ ] Ensure no control is decorative and `Reset All` restores readings, topology, hazards, route, camera, selection, and logs as specified.
- [ ] Run Task 8 tests, the full suite, and `npm run typecheck`; confirm pass.

### Task 9: Optional FastAPI gateway, documentation, and end-to-end verification

**Files:**
- Create: `gateway/main.py`, `gateway/models.py`, `gateway/requirements.txt`, `gateway/README.md`, `gateway/tests/test_gateway.py`
- Create: `.env.example`, `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 3 gateway protocol.
- Produces: HTTP node update endpoint, WebSocket snapshot/event stream, disconnect tracking, documented frontend/live startup flow.

- [ ] Write failing gateway tests for node update, initial WebSocket snapshot, event broadcast, last-seen tracking, and node disconnect state.
- [ ] Implement the minimal in-memory FastAPI gateway with CORS configuration and heartbeat-compatible messages.
- [ ] Document frontend, simulation, gateway, live mode, HTTPS/WSS, CORS, authentication boundary, and LAN deployment considerations.
- [ ] Run gateway tests when Python dependencies are available; otherwise document the exact verification limitation.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` and confirm all pass.
- [ ] Verify nominal, fire, blocked, offline, combined, and no-route states at 1440×900, 1920×1080, and mobile; confirm no body horizontal scroll and no desktop body scroll.
- [ ] Correct observed layout, interaction, rendering, accessibility, or console failures and rerun affected checks.

