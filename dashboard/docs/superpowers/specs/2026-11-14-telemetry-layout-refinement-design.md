# Telemetry and Dashboard Layout Refinement

## Intent

Make the overview easier to scan during the Gaia demo: remove duplicated situation status, prevent overlays from colliding, turn telemetry totals into meaningful visual measures, simplify the forest, and make opening or closing the sensor panel feel continuous.

## Approved design

- Keep the compact overall-status badge in the top bar and remove the large alert banner from the map.
- Show active sensors as a semicircular percentage gauge.
- Show temperature on a fixed -5 °C to 40 °C semicircle. Color only the observed minimum-to-maximum interval and mark minimum, average, and maximum, with the average marker emphasized.
- Show network health as active links divided by all reported links on a semicircular gauge.
- Keep confirmed alerts as a discrete count/status card because alerts have no truthful fixed maximum.
- Keep the telemetry values and accessible text alongside every visualization; missing data must render as unavailable, never as zero.
- Fit all four telemetry summaries inside the visible panel without an internal scrollbar.
- Change the visible building floor only through the floor selector in the upper map controls; selecting a room or sensor may update route context but must not change the floor.
- Present map controls and the status legend as two independent floating surfaces.
- Animate the sensor panel, reopen button, overlay positions, and 3D view offset with the same transition character; reduced-motion preferences remain respected.
- Remove the forest pond, remove its artificial tree exclusion, and rename the visible lake waypoint to a neutral woodland name. Internal graph identifiers stay stable.

## Constraints

- Use existing React, SVG, CSS, React Three Fiber, and Three.js dependencies only.
- Preserve current simulation/live behavior, sensor selection, routes, mesh toggles, camera reset, responsive mobile views, and keyboard/screen-reader semantics.
- Use current environment readings and topology only; do not invent telemetry.

## Approaches considered

1. **Semantic SVG gauges and a discrete alert indicator — selected.** This gives precise range markers, works in both themes, remains accessible, and needs no dependency.
2. Canvas gauges were rejected because they complicate responsive sizing and accessibility for four small cards.
3. A gauge for alerts was rejected because choosing an arbitrary maximum would imply a false percentage.

