# Interactive 3D Hazard Gradient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat hazard-gradient SVG with an interactive 3D sensor mesh that uses each environment's real sensor coordinates and renders nothing except sensor points and active links.

**Architecture:** Keep hazard-source, distance, color, and topology derivation in the existing domain model. Add a small pure scene-model/framing module, then feed its tested output into a dedicated React Three Fiber canvas with orbit controls; the existing panel remains responsible for application state and accessible sensor selection.

**Tech Stack:** Next.js 16, React 19, TypeScript, Three.js, React Three Fiber, Drei, Node test runner, existing CSS.

**Spec:** `docs/superpowers/specs/2026-11-14-interactive-3d-hazard-gradient-design.md`

## Global Constraints

- Render only sensor points and active mesh links inside the gradient viewport.
- Use each sensor's existing `position` tuple without changing environment data.
- Preserve gradient colors, source indication, offline state, selected-sensor state, header, status, legend, and responsive placement.
- Rotation and zoom must work with pointer and touch through the project's existing dependencies.
- Add no dependencies and do not couple the new view to `BuildingScene`, `ForestScene`, or `DigitalTwin`.
- Keep rendering demand-driven and use a capped device-pixel ratio.
- Preserve accessible sensor selection with native controls and visible keyboard focus.
- Do not run visual verification without explicit user authorization.
- The worktree already contains unrelated user changes, including `dashboard.css`; edit only the required selectors and do not commit or overwrite unrelated changes.

## Review Focus

- A multi-floor environment must keep vertical separation rather than flattening the Y axis; covered by Task 1 framing tests.
- A nearly planar outdoor environment must still receive a stable center and useful camera distance; covered by Task 1 framing tests.
- A single sensor or several colocated sensors must not produce zero/invalid zoom bounds; covered by Task 1 framing tests.
- Links whose endpoint is absent from the current sensor set must not render or throw; covered by Task 1 scene-model tests.
- Keyboard focus must remain visible when selecting a sensor outside the WebGL canvas; covered by Task 3 source/CSS inspection and production build.

---

### Task 1: Test and build the pure 3D scene model

**Files:**
- Create: `src/components/telemetry/hazardGradientSceneModel.test.ts`
- Create: `src/components/telemetry/hazardGradientSceneModel.ts`

**Interfaces:**
- Consumes: `SensorNode`, `HazardGradientModel`, and `Vector3Tuple` from the existing domain types/model.
- Produces: `createHazardGradientSceneModel(sensors, gradient, selectedSensorId): HazardGradientSceneModel` and `fitHazardGradientScene(positions): HazardGradientSceneFrame`.

- [ ] **Step 1: Write failing tests for real positions and valid links**

  Assert that the scene model copies each sensor's exact `[x, y, z]`, carries its gradient level/offline/selected state, retains valid model links, and drops links with a missing endpoint.

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

  Run: `npm test -- src/components/telemetry/hazardGradientSceneModel.test.ts`

  Expected: FAIL because `hazardGradientSceneModel.ts` does not exist.

- [ ] **Step 3: Implement the minimal scene-model mapping**

  Define focused types for renderable nodes, links, and frame data. Use ID maps for deterministic O(n + e) node/link construction and do not mutate domain objects.

- [ ] **Step 4: Write failing framing tests**

  Assert exact bounds center for a multi-floor sample; assert finite positive radius, camera distance, minimum zoom, and maximum zoom for outdoor-planar, one-point, and colocated inputs.

- [ ] **Step 5: Run the focused test and verify the framing assertions fail**

  Run: `npm test -- src/components/telemetry/hazardGradientSceneModel.test.ts`

  Expected: FAIL because framing is not implemented.

- [ ] **Step 6: Implement `fitHazardGradientScene`**

  Compute axis-aligned bounds, their center, a non-zero bounding radius, a perspective camera position, and ordered `minDistance`/`maxDistance` values. Return stable defaults for an empty input even though the configured environments currently contain sensors.

- [ ] **Step 7: Run the focused test**

  Run: `npm test -- src/components/telemetry/hazardGradientSceneModel.test.ts`

  Expected: PASS.

### Task 2: Render the interactive sensor-only 3D scene

**Files:**
- Create: `src/components/telemetry/HazardGradientScene3D.tsx`
- Modify: `src/components/telemetry/HazardGradientPanel.tsx`

**Interfaces:**
- Consumes: `HazardGradientSceneModel`, a color callback/result for the active simulation/live mode, and `onSelectSensor(sensorId)`.
- Produces: a client-only, demand-driven canvas with selectable sensor spheres, source/selection rings, active connection lines, and orbit controls.

- [ ] **Step 1: Add the client-only scene component**

  Use `Canvas`, `OrbitControls`, and Drei `Line`. Set the perspective camera from the fitted frame; aim controls at the calculated center; enable rotation and zoom, disable panning, and constrain distance to the tested limits.

- [ ] **Step 2: Render only the approved visual primitives**

  Render one sphere per sensor at its exact real position and one line per valid active mesh connection. Use existing gradient color functions; use emissive intensity and a ring belonging to the sensor marker for source/selection emphasis. Do not import or render environment geometry, labels, routes, hazards, lights that create environmental objects, or decorative meshes.

- [ ] **Step 3: Replace the SVG in `HazardGradientPanel`**

  Remove 2D projection, radius, font-size, SVG-node, and SVG-line code. Dynamically load the new scene with server-side rendering disabled, pass the selected environment/model/mode, and dispatch the existing `select-sensor` action from 3D selection.

- [ ] **Step 4: Run TypeScript checking**

  Run: `npm run typecheck`

  Expected: PASS with no new errors.

### Task 3: Preserve accessibility and responsive interaction

**Files:**
- Modify: `src/components/telemetry/HazardGradientPanel.tsx`
- Modify: `src/styles/dashboard.css`

**Interfaces:**
- Consumes: the plotted sensor nodes and existing application dispatch.
- Produces: accessible native sensor controls associated with the visual scene and CSS that supports mouse, touch, keyboard, mobile, and loading states.

- [ ] **Step 1: Add a concise scene description and native sensor controls**

  Mark the canvas as the visual representation and expose buttons whose accessible names include sensor ID plus gradient level/offline/unreachable state. Keep the controls compact by default, but reveal the focused control so keyboard focus is visible; selecting one dispatches the same state action as clicking a 3D point.

- [ ] **Step 2: Replace obsolete SVG CSS with canvas CSS**

  Keep `.gradient-map` sizing, border, and dark contrast surface. Remove selectors for SVG lines, `.gradient-node`, and `.gradient-node__source`; add full-size canvas/touch handling, loading, and accessible-control focus styles. Preserve the existing responsive panel rules.

- [ ] **Step 3: Verify repository references before cleanup**

  Run: `rg -n "gradient-node|gradient-link--highlighted|gradient-node__source|gradient-map svg|gradient-map line" src app`

  Expected: no results.

- [ ] **Step 4: Run TypeScript checking**

  Run: `npm run typecheck`

  Expected: PASS.

### Task 4: Remove the obsolete 2D layout code

**Files:**
- Modify: `src/domain/hazardGradient.ts`
- Modify: `src/domain/hazardGradient.test.ts`

**Interfaces:**
- Removes: `GradientLayoutSensor`, `GradientPoint`, `layoutGradientSensors`, and the two tests that only validate the discarded 2D projection.
- Preserves: all gradient derivation, source selection, live-mode, link, and color interfaces/tests.

- [ ] **Step 1: Search every 2D-layout reference**

  Run: `rg -n "layoutGradientSensors|GradientLayoutSensor|GradientPoint" . -g '!node_modules/**' -g '!.next/**'`

  Expected: only the domain implementation/tests and any remaining panel import; clear the panel import before deletion.

- [ ] **Step 2: Remove the unused projection and its projection-only tests**

  Delete only the confirmed-unused types, normalization/jitter helpers used exclusively by the projection, function, imports, and two projection tests.

- [ ] **Step 3: Confirm no stale references remain**

  Run: `rg -n "layoutGradientSensors|GradientLayoutSensor|GradientPoint|stableJitter|function normalized" . -g '!node_modules/**' -g '!.next/**'`

  Expected: no results.

- [ ] **Step 4: Run the gradient and scene-model tests**

  Run: `npm test -- src/domain/hazardGradient.test.ts src/components/telemetry/hazardGradientSceneModel.test.ts`

  Expected: PASS.

### Task 5: Verify the complete change without visual inspection

**Files:**
- Verify all files modified in Tasks 1–4.

**Interfaces:**
- Consumes: the finished 3D gradient implementation.
- Produces: automated evidence that existing behavior and production compilation remain intact.

- [ ] **Step 1: Run the full frontend test suite**

  Run: `npm test`

  Expected: all tests PASS; report any pre-existing or new failure by name.

- [ ] **Step 2: Run TypeScript checking**

  Run: `npm run typecheck`

  Expected: PASS.

- [ ] **Step 3: Run the production build**

  Run: `npm run build`

  Expected: PASS without compilation errors.

- [ ] **Step 4: Inspect the final diff and dead-code searches**

  Confirm only intended files/hunks changed, unrelated user work remains intact, obsolete 2D names/selectors have zero references, and no new dependency or asset was added.

- [ ] **Step 5: Request visual-test authorization**

  Stop after automated verification and ask the user for explicit authorization before starting the development server or opening the dashboard for visual inspection.

## Plan self-review

- Spec coverage: every approved goal, non-goal, and constraint maps to Tasks 1–5.
- Step scan: each step has one checkable outcome; production behavior is introduced only after a failing pure-logic test where automated testing is available.
- Type consistency: scene nodes carry `sensorId`, `position`, `level`, `offline`, and `selected`; scene links carry `sourceId` and `targetId`; framing consumes only positions.
- Review focus: multi-floor, planar, degenerate bounds, missing link endpoints, and visible keyboard focus are explicitly owned above.
- Proportion: component rendering details remain implementation choices except where the approved design fixes behavior.
