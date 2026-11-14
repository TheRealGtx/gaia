# Gaia Local Gateway

The gateway is a read-only observer bridge. Arduino nodes continue detecting anomalies, exchanging topology and reaching consensus without it. The gateway listens to their UDP broadcasts, enriches the three physical IDs with `node_manifest.json`, and streams the network-owned state to dashboards.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r gateway/requirements.txt
uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload
```

The gateway simultaneously binds UDP `0.0.0.0:5005` with `SO_REUSEADDR`. Start the nodes first, in broadcast mode, then the gateway, then the frontend on port `3000`. Configuration:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GAIA_UDP_HOST` | `0.0.0.0` | UDP listener address |
| `GAIA_UDP_PORT` | `5005` | Node broadcast port |
| `GAIA_OFFLINE_AFTER_SECONDS` | `4` | Receipt-time node timeout |
| `GAIA_NODE_MANIFEST` | `gateway/node_manifest.json` | Physical ID mapping |
| `GAIA_ALLOWED_ORIGINS` | `http://localhost:3000` | Browser origin |

Send a reading:

```bash
curl -X POST http://localhost:8000/v1/environments/building-a/nodes/A-01 \
  -H 'content-type: application/json' \
  -d '{"name":"Reception","position":[-12,1.1,7],"temperature":24.5,"humidity":42,"anomalyScore":0.12,"status":"normal","connectivity":"connected","neighbourIds":["A-02","A-05"]}'
```

`POST /v1/events` remains available for integrations. WebSocket clients connect to `/ws` and receive an initial snapshot followed by normalized events. Node timestamps are retained as `sourceTimestamp` for diagnostics but never reject a later-arriving heartbeat; gateway receipt time controls ordering and the four-second timeout.

Unknown packet fields are ignored. Nullable readings remain nullable. Missing `mu`, `sigma`, `n`, and byte counters retain their last known values, so nodes may send learned parameters only at their real 15-second cadence. The gateway adds `modelUpdatedAt` using its receipt clock whenever a complete parameter trio arrives. A partial trio is ignored without dropping the rest of the heartbeat. Missing counters are not converted to zero, and a lower counter value starts a fresh post-reboot baseline.

For a Vercel frontend served over HTTPS, the browser requires a secure `wss://` gateway. A gateway on a private LAN is normally best viewed by a dashboard on that LAN; exposing it publicly requires authentication, TLS, rate limits, and environment-level authorization that this prototype intentionally does not pretend to provide.
