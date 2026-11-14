# Gaia

Gaia is a digital-twin dashboard for decentralized Arduino UNO Q environmental networks. The dashboard is a passive observer: closing it does not stop anomaly detection, neighbour communication, local consensus, LEDs, or evacuation guidance on the physical mesh.

## Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Simulation Mode is the default and requires no external service. Use the controls to combine fire, obstruction, elevated temperature, local anomaly, node outage, and network-fault scenarios. `Reset` restores the selected environment.

Production verification:

```bash
npm test
npm run typecheck
npm run build
```

The Next.js app can be deployed directly to Vercel. Procedural 3D geometry and all visual assets are bundled locally.

## Live Mode

1. Start the two physical nodes first in UDP broadcast mode on port `5005`.
2. Follow [gateway/README.md](gateway/README.md) to run the FastAPI bridge on HTTP/WebSocket port `8000`.
3. Copy `.env.example` to `.env.local`, start the frontend on port `3000`, and select `Live` in the top bar.

The frontend reconnects with capped exponential backoff and preserves the last valid snapshot. Live Mode displays only physical IDs `1` and `2`, mapped to `A-01` and `A-02`. It uses network-owned `dist`, `alert`, and `escape_to`; it never recalculates consensus or safety in the browser. `dist >= 99` means no hazard path is known: it is nominal when no hazard exists and unknown only while another node reports a hazard. A silent node becomes offline after four seconds.

Dashboard is read-only: the network works without it.

The complete startup, rehearsal, and recovery checklist is in [docs/demo-runbook.md](docs/demo-runbook.md).

## Architecture

- `src/domain`: normalized types and pure selectors.
- `src/config`: reusable multi-environment definitions.
- `src/simulation`: deterministic demonstration adapter.
- `src/live`: WebSocket adapter, protocol validation, freshness policy.
- `src/routing`: hazard-first Dijkstra routing over configured rooms, doors, stairs, exits, and trails.
- `src/state`: centralized React presentation state.
- `src/components/scene`: shared React Three Fiber digital-twin components.
- `gateway`: optional local observer gateway.

This prototype provides simulated decision support and is not certified emergency evacuation guidance.
