# aggregate — the nodes

Every node runs the same program, `node.py`, and talks only to its configured
neighbours. There is no server and no coordinator: each node computes its own
view of the field from what its neighbours say, once a second.

- **gradient** — a node in anomaly is the source and reports `dist = 0`; every
  other node takes the smallest distance it hears and adds one. `dist = 99`
  means *I know of no hazard*, which is what a healthy field reports.
- **consensus** — a node raises `alert` when its own anomaly is above
  `ALERT_ON` **and** at least `AGREE_MIN` neighbours agree. One noisy node
  cannot alarm the field on its own. It clears below `ALERT_OFF` with no
  neighbour in anomaly, so it cannot flicker.
- **escape direction** — `escape_to` is the alive neighbour furthest from the
  hazard; `null` when there is none.
- **self-healing** — a neighbour not heard for `TIMEOUT` seconds leaves the
  table and the distances are recomputed. A node that comes back is picked up
  again without anyone restarting anything.
- **federated learning** — `mu`, `sigma`, `n` from Chuqi's model ride one
  heartbeat in `PARAM_EVERY` and are merged in a separate thread, so the one
  second heartbeat is never delayed by it.

## Run it

Two boards or two laptops on the same Wi-Fi:

```bash
NODE_ID=1 NEIGHBORS=2 python3 node.py
NODE_ID=2 NEIGHBORS=1 python3 node.py
```

Three nodes in a line are `1 -> 2`, `2 -> 1,3`, `3 -> 2`. Several nodes on one
laptop need `MODE=unicast` (each node then owns port 5200+id), or just use
`sim.py`, which does it for you.

When the access point blocks broadcast — most phone hotspots and all guest
Wi-Fi do — give each node its neighbours' addresses instead:

```bash
NODE_ID=1 NEIGHBORS=2 PEERS=2=10.118.94.52 python3 node.py
```

Type `a` + Enter to toggle the fake anomaly, a number between 0 and 1 to set
it, `q` to quit. `ANOMALY=1` starts a node already in anomaly, which is how you
drive a board that has no console.

**On an Arduino UNO Q, run this on the board's host OS, not inside the App Lab
app.** The App Lab app runs in a container on a docker bridge (172.18.0.2): from
there the broadcast never reaches the Wi-Fi and no board can hear another. The
hardware stays in the app and reaches the node through the sensor bridge below.

## The three ports

| Port | What |
| --- | --- |
| 5005 | heartbeats between nodes, and what the dashboard listens to (read-only) |
| 5006 | sensor bridge: the App Lab app sends readings, the node answers with its state |
| 5200+id | heartbeats in `MODE=unicast`, for several nodes on one laptop (5000+id would put a fifth node on 5005) |

## The sensor bridge

The Modulino is only reachable from inside the App Lab container, and the node
runs on the host. So the app sends `{"temp": 23.4, "hum": 41.0}` to the node
once a second, and the node answers the same datagram with
`{"id", "dist", "alert", "escape_to", "anomaly"}`, which is what drives the
Pixels: the LEDs show what the network decided, not a local temperature
threshold.

A reading older than `SENSOR_TTL` is ignored, so a node whose app died falls
back to the keyboard anomaly instead of scoring degrees from five minutes ago.
The bridge is optional: if the port is busy the node says so and keeps running.

## The message

One JSON datagram per node per second, broadcast on 5005. `Plan.md` is the
contract; this is what it looks like:

```json
{"id": 2, "anomaly": 0.12, "dist": 3, "via": 1, "alert": false, "escape_to": 3,
 "mu": 22.4, "sigma": 1.1, "n": 120, "temperature": 23.8, "humidity": 46.2,
 "simulated": false, "bytes_sent": 84, "bytes_if_raw_data": 960,
 "ts": 1731574800.2}
```

`via` is the neighbour this distance came from: it keeps two nodes from adding
one to each other for ever, and the dashboard draws it as the arrow pointing at
where the alarm came from. `mu`, `sigma` and `n` are only in one heartbeat
every `PARAM_EVERY`: whoever reads them keeps the last value seen.
`simulated: true` means the degrees were derived from the fake anomaly and must
be labelled as such, never shown as a measurement.

## Settings

All of them are environment variables, all have working defaults.

| Name | Default | What |
| --- | --- | --- |
| `NODE_ID` | 1 | this node's id |
| `NEIGHBORS` | 2 | comma list of ids this node listens to |
| `MODE` | broadcast | `unicast` for several nodes on one laptop |
| `PEERS` | — | `2=10.0.0.5,3=10.0.0.6`: unicast to explicit addresses |
| `BROADCAST` | — | force one broadcast address instead of all interfaces |
| `ANOMALY` | 0 | the anomaly a node starts with |
| `ANOMALY_SRC` | auto | `model` scores fake readings with Chuqi's model; `fake` never uses it |
| `FAKE_SENSOR` | 1 | 0 sends `temperature: null` instead of invented degrees |
| `ALERT_ON` / `ALERT_OFF` | 0.7 / 0.4 | consensus thresholds, with hysteresis |
| `AGREE_MIN` | 1 | neighbours that must agree before `alert` |
| `TIMEOUT` | 4 | seconds before a silent neighbour is dropped |
| `HEARTBEAT` | 1 | seconds between messages |
| `PARAM_EVERY` | 15 | seconds between model merges, and between parameter sends |
| `SENSOR_PORT` / `SENSOR_TTL` | 5006 / 5 | the bridge, and when a reading goes stale |

## The other three programs

```bash
python3 sim.py --scenario consensus   # a whole field of real nodes on one laptop
python3 listen.py                     # watch every packet (sends nothing)
python3 netcheck.py                   # why the nodes cannot hear each other
```

`sim.py` runs real `node.py` processes, not an imitation: `nominal`, `alert`,
`consensus`, `failure`, `rejoin` and `coldstart` each end in a verdict, and
`--broadcast` puts them on 5005 for a dashboard to watch. `netcheck.py` prints
the interfaces, the addresses it would send to, what it hears and what that
means — run it on every machine at once when something is silent.

## Two things that surprise people

**A single hazard raises no `alert`.** With `AGREE_MIN=1` a source needs a
neighbour that agrees, so heating one board gives `dist = 0` and red LEDs
through the gradient, with `alert` false everywhere. Heat two adjacent boards
to see the consensus alarm: `sim.py --scenario consensus` shows exactly that.

**`dist = 99` is not "very far and therefore safe".** It means the node has no
path to any hazard. A quiet field is 99 everywhere; after a fire starts, a node
still at 99 is cut off from the alerting side, and that is worth showing, but it
is never the safest place to send people. `escape_to` is the value to trust.
