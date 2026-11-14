# Interactive 3D Hazard Gradient Design

## Intent

Replace the current flat hazard-gradient projection with a spatial 3D representation so operators can understand which sensors are physically close to an incident. The panel must show only sensor points and their active mesh connections; building, terrain, furniture, walls, maps, labels, and other environment geometry must not appear.

## Goals

- Place every sensor at its existing real `position` within the selected environment.
- Preserve the current hazard-level colors, source indication, offline state, selected-sensor highlighting, and active network links.
- Allow pointer and touch rotation and zoom through the project's existing Three.js/React Three Fiber stack.
- Fit both the multi-floor building and forest sensor layouts into the panel with environment-specific camera framing.
- Preserve sensor selection and provide a keyboard/screen-reader equivalent to the visual WebGL interaction.

## Non-goals and anti-goals

- Do not render the building, forest terrain, rooms, furniture, walls, map tiles, routes, hazards, or decorative geometry.
- Do not change how gradient levels, live distances, topology, sensor status, or incident sources are calculated.
- Do not add dependencies or couple the gradient panel to the full digital-twin scene.
- Do not leave the obsolete 2D coordinate projection, its types, tests, or CSS selectors after repository-wide usage checks confirm they are no longer needed.

## Constraints

- Maintain the current panel header, status, legend, and responsive placement.
- Keep WebGL rendering demand-driven where possible and cap pixel density consistently with the existing dashboard to control GPU cost.
- Respect reduced-motion preferences by avoiding required animation; navigation remains manually controlled.
- Automated tests, type checking, and production build must pass before completion.
- A visual verification may run only after explicit user authorization.

## Approaches considered

1. **Independent 3D gradient scene — selected.** A focused canvas renders gradient-colored sensor meshes and active connection lines using existing sensor coordinates. This keeps the view small, explicit, and isolated from the digital twin while supporting rotation and zoom.
2. **Reuse the full digital twin with hidden layers — rejected.** This would share more scene code but retain unnecessary environment coupling and make the gradient vulnerable to future building or terrain changes.

## Interaction and rendering design

The gradient model continues to determine each sensor's level and color. The panel passes those values, real sensor positions, active links, and selection state into a dedicated client-side 3D scene. A perspective camera frames the environment bounds; orbit controls rotate around the sensor network and constrain zoom to practical minimum and maximum distances. Selecting a rendered sensor updates the same application state used by the telemetry list and main digital twin.

The canvas is an enhanced visual representation. A screen-reader-only group of native buttons exposes every sensor with its identifier and gradient state so keyboard and assistive-technology users retain equivalent selection capability. The scene itself receives a concise accessible description without duplicating interactive semantics.

## Verification

- Unit tests will cover 3D bounds/framing calculations independently of WebGL.
- Existing gradient-model tests will continue to verify levels, source selection, live behavior, and colors.
- Repository searches will confirm removal of the obsolete 2D layout code and selectors.
- Run the focused tests first, then the full test suite, TypeScript typecheck, and production build.
- Ask for permission before opening or visually inspecting the dashboard.
