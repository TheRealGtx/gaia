# Gaia Live Demo — Gap Analysis and Target Design

## Intent

Turn the current Gaia digital-twin prototype into a reliable passive-observer demo for the Junction pitch. The dashboard must accept the real UDP packets produced by the Arduino network, show the network-owned `dist` and `alert` values without recomputing them as if the frontend controlled the mesh, and make decentralization, fault tolerance, sensor readings, and communication savings understandable in under three minutes.

## Current baseline

The current project is a Next.js/React/TypeScript dashboard with React Three Fiber scenes, deterministic simulation, two environments, hazard-aware routes, local reports, and a FastAPI/WebSocket live adapter. It contains 44 configured building sensors across four floors and 36 configured forest sensors. Its automated baseline is healthy: 45 frontend tests pass, TypeScript passes, the production build succeeds, and the two existing gateway store tests pass.

The live path is not yet compatible with the agreed Arduino transport. The gateway receives HTTP POST requests and broadcasts WebSocket events; it does not bind UDP port 5005. The frontend protocol also expects enriched sensor objects with known string IDs, names, positions, statuses, and environment IDs, whereas the agreed UDP packet is a compact node-owned message.

## Canonical UDP contract

Every physical node broadcasts one JSON datagram per second to UDP port 5005:

```json
{
  "id": 2,
  "anomaly": 0.12,
  "dist": 3,
  "mu": 22.4,
  "sigma": 1.1,
  "alert": false,
  "temperature": 23.8,
  "humidity": 46.2,
  "bytes_sent": 84,
  "bytes_if_raw_data": 960,
  "ts": 1731574800.2
}
```

Required fields are `id`, `anomaly`, `dist`, `mu`, `sigma`, `alert`, `temperature`, `humidity`, and `ts`. The byte counters may be omitted until Chuqi's implementation is connected; the UI must then show `Awaiting counters`, not a fabricated saving.

`dist` is the authoritative network-computed gradient. `dist == 0` or `alert == true` is critical/red; `dist` 1–2 is warning/amber; larger finite values are normal/green. A node not received for four seconds is offline/grey. Temperature and humidity are measurements and must never be silently substituted with `mu` or `sigma`.

## Identity and topology mapping

The compact UDP packet intentionally does not repeat UI metadata. A local demo manifest maps physical numeric IDs to the configured dashboard sensors, for example node `1` to `A-01`. The manifest owns environment, display name, 3D position, floor/room, and configured neighbours. Unknown IDs are retained in gateway diagnostics but are not inserted into the 3D scene until mapped.

For the physical three-node demo, neighbour lines come from this configured manifest. For the laptop scale simulation, the existing generated topology remains available. The dashboard must clearly label configured topology so it does not imply that physical neighbour discovery was measured if it was not sent by the nodes.

## Status ownership

In Live mode, the frontend does not derive consensus or overwrite network decisions. It translates only the received `dist`, `alert`, and freshness into display semantics. The source node and gradient levels therefore match the LEDs and the Arduino network.

In Simulation mode, the existing deterministic topology and consensus logic can continue to derive a simulated gradient. Both modes use the same visual components, but their sources are explicitly labeled `Network reported` and `Laptop simulation`.

## Situation report

The deterministic report is always available. It identifies:

- alert/source nodes (`dist == 0` or `alert`),
- the safest reporting node/area (largest finite `dist`),
- offline nodes,
- temperature and humidity at the source,
- whether byte counters are available.

A received Gemma report may appear as a second, labeled line. It never replaces the deterministic fallback.

## Green AI evidence

The dashboard shows cumulative `bytes_sent`, cumulative `bytes_if_raw_data`, absolute bytes avoided, and percentage reduction. Counters must have a documented meaning and aggregation rule. If each node sends cumulative counters, the gateway keeps the newest value per node and sums them. Counter resets after reboot are handled without producing negative savings.

## Demo-critical UI

The Overview page must show, without opening a secondary page:

- a large `ALL CLEAR`, `WARNING`, or `ALERT` banner;
- the 3D environment and neighbour links;
- the network-reported `dist` on every visible node;
- temperature, humidity, anomaly, `mu`, and `sigma` for the selected node;
- the deterministic situation report and optional Gemma line;
- the Green AI byte comparison;
- the exact statement `Dashboard is read-only: the network works without it.`;
- Live/Simulation and connection/freshness labels that cannot be confused.

The existing evacuation view may remain as supporting detail, but it must not displace the alert, gradient, report, or Green AI evidence needed by the pitch.

## Naming consistency

The current application, repository, and visual identity use `Gaia`, while the supplied pitch/submission checklist uses `EchoField`. Before recording or submitting, choose one public name and apply it consistently to the dashboard, spoken pitch, repository, Project Hub, Junction page, screenshots, and backup video. The lowest-risk choice for the current codebase is to keep `Gaia` and update the old `EchoField` wording.

## Reliability requirements

- Bind UDP `0.0.0.0:5005` with `SO_REUSEADDR` and continue after malformed datagrams.
- Use gateway receipt time for freshness; retain node `ts` separately for ordering and diagnostics.
- Ignore packets older than the newest accepted `ts` for that node.
- Preserve the last valid readings when transport is interrupted, but mark them offline after four seconds.
- Never change node/network behavior from the live dashboard.
- Simulation actions are visually isolated and cannot be sent accidentally while Live mode is selected.
- Provide a fake UDP sender that exercises nominal, alert, recovery, node loss, and rejoin states.
- Provide a minimal standard-library fallback viewer so the core node colors, `dist`, report, and byte panel still work if the full frontend cannot be started.

## Considered approaches

### 1. Replace the current application with the original one-script/one-HTML dashboard

This most closely follows the initial hackathon brief and minimizes dependencies, but discards the working 3D environments, routing, simulation, responsive UI, and existing tests. It is high regression risk at the current stage.

### 2. Keep the existing frontend and add UDP ingestion to the current gateway — selected primary path

This preserves the polished demo while limiting the high-risk change to the transport, normalization, and demo-critical panels. The browser continues to receive normalized events through the existing adapter. A minimal standalone fallback covers the dependency/startup risk.

### 3. Make each Arduino speak directly to the browser

Browsers cannot listen to UDP directly. This would require changing node transport or adding another bridge and would weaken the agreed passive-observer architecture.

## Non-goals for this iteration

- Production cloud deployment of the local UDP bridge.
- Claiming dynamically discovered topology when the demo uses configured neighbours.
- Generating a fire alert from frontend temperature thresholds when the network says `alert == false`.
- Replacing the deterministic report with mandatory Gemma inference.
- Reworking the already functional building/forest geometry unless a demo-critical overlay is unreadable.

