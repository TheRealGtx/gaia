# Telemetry and Dashboard Layout Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw telemetry tiles with truthful visual summaries and refine the dashboard overlays, forest scene, and panel transition.

**Architecture:** Extend the pure environment metrics selector, keep gauge geometry in a small tested presentation module, and render dependency-free SVG components in the telemetry panel. Treat dashboard overlays as coordinated floating surfaces and animate the Three.js view offset toward the CSS layout target.

**Tech Stack:** TypeScript, React 19, SVG, CSS, React Three Fiber, Three.js, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-14-telemetry-layout-refinement-design.md`

## Global Constraints

- Do not invent telemetry or add dependencies.
- Keep mobile behavior and reduced-motion support.
- Preserve existing uncommitted camera-synchronization work and do not commit without the user's request.

## Review Focus

- Environments with no reporting temperatures show an unavailable temperature gauge without fake markers.
- Values outside -5 °C to 40 °C clamp visually while their numeric labels remain truthful.
- Empty topologies show an unavailable network ratio instead of 0% health.
- Opening and closing the sensor panel never covers the remaining floating controls.
- The forest route graph remains valid after the visible lake feature is removed.

---

### Task 1: Telemetry presentation model

**Files:**
- Modify: `src/domain/selectors.ts`
- Create: `src/components/telemetry/telemetryGauges.ts`
- Test: `src/domain/selectors.test.ts`
- Test: `src/components/telemetry/telemetryGauges.test.ts`

**Interfaces:**
- Produces temperature minimum/average/maximum, active/total link counts, bounded gauge ratios, and semicircle marker coordinates.

- [ ] Write failing tests for metric ranges, missing readings, empty topology, clamping, and marker coordinates.
- [ ] Run focused tests and confirm the new expectations fail.
- [ ] Implement the selector fields and pure gauge helpers.
- [ ] Run focused tests and confirm they pass.

### Task 2: Telemetry visual cards

**Files:**
- Create: `src/components/telemetry/TelemetryGauge.tsx`
- Modify: `src/components/telemetry/TelemetryPanel.tsx`
- Modify: `src/styles/dashboard.css`

**Interfaces:**
- Consumes Task 1 metrics and geometry helpers.
- Produces three semicircle visualizations plus a discrete confirmed-alert indicator.

- [ ] Render accessible SVG gauges for sensors, temperature, and links, including the three temperature markers.
- [ ] Render confirmed alerts as a count/status indicator without an arbitrary percentage.
- [ ] Fit all four cards into the existing telemetry panel in desktop and mobile layouts without an internal scrollbar.
- [ ] Run type checking and focused tests.

### Task 3: Overlay layout and smooth panel transition

**Files:**
- Modify: `src/components/pages/OverviewDashboard.tsx`
- Modify: `src/components/operations/MapToolbar.tsx`
- Modify: `src/components/scene/DigitalTwin.tsx`
- Modify: `src/components/scene/rendering.ts`
- Modify: `src/components/scene/rendering.test.ts`
- Modify: `src/styles/dashboard.css`

**Interfaces:**
- Produces separate floating control/legend surfaces and a damped scene view offset.

- [ ] Write a failing test for monotonic, snapping view-offset interpolation.
- [ ] Implement interpolation and use it from the digital twin frame loop.
- [ ] Remove the duplicated map alert banner and keep the top-bar badge.
- [ ] Add a reducer regression test and keep visible-floor changes exclusive to the upper floor selector.
- [ ] Split toolbar controls and legend visually; animate panel, reopen button, overlays, and view offset consistently.
- [ ] Run focused tests and type checking.

### Task 4: Forest cleanup and full verification

**Files:**
- Modify: `src/components/scene/forest/ForestScene.tsx`
- Modify: `src/config/environments.ts`
- Modify: `src/config/environments.test.ts`

**Interfaces:**
- Produces a pond-free forest while preserving stable graph identifiers.

- [ ] Add a failing configuration assertion that no visible forest waypoint is lake-named.
- [ ] Remove the pond mesh and water-shaped tree exclusion; rename the visible waypoint.
- [ ] Run the full test suite, typecheck, production build, and diff checks.
