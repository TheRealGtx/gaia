# Gaia Dashboard — Design Specification

## Intent

Gaia is an interactive, passive-observer dashboard for a decentralized network of Arduino UNO Q environmental nodes. The demo must make the distributed system understandable at a glance: sensors detect local anomalies, nearby nodes reach consensus, evacuation routes adapt, and the dashboard visualizes the result without becoming a central dependency.

The primary audience is hackathon judges and technical/non-technical observers. The main success criterion is that a user can understand the system and trigger a convincing emergency scenario within seconds.

## Goals

- Rebuild the project as a maintainable Next.js application using React and TypeScript.
- Match the supplied desktop reference: telemetry on the left, a large 3D operational viewport on the right, contextual controls at the top, and compact intelligence/simulation panels over the viewport.
- Keep the complete core experience visible within a 16:9 desktop viewport without page scrolling.
- Provide accurate, recognizable procedural 3D representations of a two-level building and a forest terrain.
- Make sensor nodes, hazards, routes, exits, blocked areas, and offline nodes visible directly in the 3D scenes.
- Allow the user to switch between the building and forest and run interactive demo scenarios.
- Make neighbour consensus and mesh self-healing observable rather than representing them only through explanatory text.
- Derive reusable UI and 3D components from the design system in `DESIGN.md` and the supplied Gaia SVG logos.
- Produce a project that builds cleanly and can be deployed to Vercel with normal Next.js defaults.

## Non-goals

- Connecting to physical Arduino devices in this iteration.
- Implementing a real Gemma inference service, federated-learning protocol, or production mesh transport.
- Reconstructing an exact real-world building from architectural CAD data.
- User accounts, persistent databases, or cloud storage.
- A marketing landing page; this deliverable is the operational application demo.

## Anti-goals

- A static mockup with non-functional controls.
- A generic admin dashboard where 3D is decorative rather than operational.
- Requiring internet access or remote model assets for the demo to render.
- Excessive visual effects that reduce telemetry readability or emergency-state clarity.
- A layout that requires scrolling on common laptop/desktop screens.

## Existing project state

- `DESIGN.md` defines the palette, typography, spacing, radii, status colors, component behavior, and responsive rules.
- `logo.svg` and `complete_logo.svg` provide the Gaia mark and complete wordmark.
- A compiled `.next` artifact exists, but editable application source and package metadata are missing; the source application will be reconstructed cleanly.
- The supplied screenshot is the visual reference for density, hierarchy, and overall information architecture.

## Constraints

- Framework: Next.js App Router, React, and TypeScript.
- 3D: Three.js through React Three Fiber, with Drei helpers where useful.
- Icons: a consistent React icon set; no emoji as interface icons.
- Asset strategy: procedural/local geometry and supplied local logos. No runtime dependency on remote 3D assets.
- Desktop-first at 1440×900 and 1920×1080, with a usable compact layout for narrower screens.
- Respect `prefers-reduced-motion` for pulsing markers and animated hazards.
- The dashboard is explicitly labeled as a demo/simulation so simulated values are not presented as live physical measurements.
- The app may require a network connection for the initial Vercel page load, but all scene assets and runtime demo logic are bundled locally and make no remote API or asset requests after loading.

## Considered approaches

### 1. React Three Fiber with procedural Three.js geometry — selected

Build both environments from reusable React components and primitive geometry. This provides genuine 3D interaction, predictable performance, local/offline assets, and direct coupling between application state and scene state. It is the best balance of fidelity, maintainability, and hackathon reliability.

### 2. Custom low-level WebGL renderer

This can produce a smaller rendering layer, but requires more bespoke camera, geometry, picking, fallback, and accessibility work. It is less maintainable and harder to extend under hackathon time pressure.

### 3. Imported GLTF models

This can provide higher artistic realism, but increases asset weight, makes room/route editing harder, and introduces a modeling pipeline not present in the project. It is better suited to a later phase using real BIM or GIS data.

## Information architecture

### Primary application shell

- Top bar: Gaia brand, `Overview`, `Environments`, and `Sensor Logs`; environment switcher; overall system state; mesh health/latency; demo badge; settings.
- Left telemetry rail: four summary metrics followed by a scroll-contained list of sensor cards and a mesh footer.
- Main workspace: environment/floor controls, legend, 3D scene, evacuation card, Gaia Intelligence card, and floating simulation controls.
- Secondary views:
  - `Environments`: compact cards to switch/open the building or forest.
  - `Sensor Logs`: table of current simulated readings and scenario history.

### Viewport fit

The app shell uses `100dvh` and internal grid rows. The body does not scroll on desktop. The sensor list has its own overflow region, while the 3D workspace grows to fill remaining space. Cards over the scene are compact and anchored so they do not cover the hazard focus.

At tablet/mobile widths, the three dashboard regions become switchable panels (`Map`, `Sensors`, `Analysis`) so the experience remains usable without shrinking telemetry below legible sizes.

## Design system implementation

- Translate `DESIGN.md` into CSS custom properties for color, spacing, typography, radius, elevation, and semantic states.
- Use Inter with a system fallback and tabular figures for telemetry.
- Shared primitives: `Button`, `StatusBadge`, `StatusDot`, `SegmentedControl`, `Card`, `MetricCard`, and `IconButton`.
- Shared operational components: `TopBar`, `TelemetryPanel`, `SensorCard`, `MapToolbar`, `StatusLegend`, `EvacuationCard`, `IntelligenceCard`, `SimulationBar`, and `SettingsDialog`.
- Status semantics are consistent everywhere:
  - Safe: emerald.
  - Warning: amber.
  - Critical/fire: red.
  - Offline: slate.

## Domain model

An `EnvironmentDefinition` contains environment metadata, sensor definitions, exits, waypoints, floor/terrain options, and a weighted route graph. Scenario state contains three independent toggles: `fire`, `blocked`, and `offline`.

The definition also contains a neighbour topology for the sensor mesh. The selected node can show its current peer links, and the consensus UI reports how many nearby nodes agree with the anomaly. Disabling a node removes its peer links; remaining links and the route are recomputed, visually demonstrating self-healing while the dashboard stays passive.

Derived state calculates:

- Sensor status and altered readings.
- Active sensor/alert counts and average temperature.
- Overall system state.
- Shortest safe route from the selected sensor to an available exit.
- Human-readable local situation report.
- Scenario event log.

The route calculator excludes edges blocked by the active scenario and excludes the hazard node during a fire. This provides a visible rerouting demonstration rather than a hard-coded text swap.

When fire and obstruction scenarios overlap, both constraints apply. Routes must avoid explicitly blocked edges and any edge designated inside the active hazard zone. If the selected node is itself critical, the route begins at its nearest safe connected waypoint and the UI labels the origin as unsafe. If no exit remains reachable, the route card shows `No safe route available` and the intelligence report instructs the observer to shelter and await local guidance rather than displaying a fabricated path.

## 3D environments

### Building scene

- Two-level cutaway/isometric building with exterior shell, floor slabs, interior walls, door openings, corridors, offices, reception, meeting room, storage room, stairs, furniture landmarks, and labeled exits.
- Floor selector: `All Floors`, `Level 1`, `Level 2`.
- Five positioned sensor nodes corresponding to the telemetry rail.
- Subtle neighbour-link lines between sensor nodes; the active/alert cluster becomes more prominent when consensus is reached.
- Routes render as elevated, directional green paths. Unsafe/blocked segments are removed from the selected route.
- The active fire scenario adds animated flame/smoke at the storage node, changes nearby telemetry, highlights danger, and recomputes the selected escape route.
- Camera supports orbit, zoom, and reset while keeping a stable default isometric view.

### Forest scene

- Sculpted terrain with height variation, clearings, trails, river/water feature, rocks, shrubs, and a dense mixture of procedural conifer and deciduous trees.
- Four field sensor nodes positioned across ridge, river trail, east pines, and south valley.
- Visible neighbour-link lines across the terrain; disabling a field node removes its links while remaining nodes reconnect where topology allows.
- Trailheads act as exits; the route graph follows visible trails.
- The fire scenario appears in the east pines with flame/smoke and a local danger radius.
- The same marker, route, camera, and hazard components are reused from the building scene.

## Interactions and demo states

- Selecting an environment resets the scenario, floor/terrain filter, selected node, and camera.
- Selecting a sensor in either the telemetry rail or 3D scene synchronizes the selection everywhere.
- `Evacuation Paths` toggles route visibility.
- `Reset Isometric` restores the environment's default camera.
- `Simulate Fire` toggles the main critical scenario.
- `Block Corridor` / `Block Trail` removes a key edge and recomputes the route.
- `Disable Node` marks one sensor offline and demonstrates mesh resilience.
- A compact consensus indicator reports agreeing nearby nodes (for example `3/4 neighbours agree`) and mesh topology changes are visible in the scene.
- `Reset All` returns to the nominal state.
- Gaia Intelligence produces a concise, deterministic explanation based on aggregated scenario state and the currently computed route. It is labeled as a local demo explanation, not live Gemma output.
- Sensor Logs records scenario changes with local timestamps for the current browser session.

## Accessibility and performance

- All controls use native buttons and visible focus states.
- Scene markers have DOM-accessible labels and synchronize with the sensor list; core status information is never available only through color or 3D position.
- Canvas rendering uses a capped device-pixel ratio and conservative shadow settings.
- Repeated trees, markers, and route geometry are memoized or instanced where appropriate.
- A loading/fallback surface is shown while the 3D scene initializes.
- Animations pause or simplify for reduced-motion users.

## Testing and verification

- Unit tests for route calculation and scenario-derived sensor state.
- Component/interaction tests for environment switching, sensor selection, scenario toggles, and reset behavior.
- TypeScript and production Next.js build must pass.
- Browser verification at desktop and compact viewport sizes.
- Visual checks for nominal, fire, blocked-route, and offline scenarios in both environments.

## Builder decisions

The implementation may choose exact room dimensions, tree distribution seeds, terrain noise function, furniture placement, and camera parameters as long as the scenes remain accurate, readable, deterministic, and visually consistent with the reference. The implementation may also choose the test runner and internal folder structure appropriate to the generated Next.js project.

