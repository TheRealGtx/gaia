# Fake UDP nodes

This standard-library sender exercises the dashboard without physical boards. It emits the same heartbeat shape as `aggregate/node.py`: readings and byte counters every second, while `mu`, `sigma`, and `n` appear on the first heartbeat and then once every 15 heartbeats.

From `dashboard/`, with the gateway already running:

```bash
python3 demo/fake_nodes.py --scenario nominal --host 127.0.0.1 --port 5005
python3 demo/fake_nodes.py --scenario alert --host 127.0.0.1 --port 5005
python3 demo/fake_nodes.py --scenario failure --host 127.0.0.1 --port 5005
python3 demo/fake_nodes.py --scenario rejoin --host 127.0.0.1 --port 5005
```

Use `--count 20` for a bounded run. The sender only produces observer heartbeats; it never sends control commands to physical nodes. Stop it before starting the Arduino broadcasts so the fake IDs do not compete with real IDs 1–2.

The `alert` scenario mirrors the stage demo with `AGREE_MIN=1`: both adjacent
nodes are hot, report `dist 0`, and raise the consensus alert. A single hot node
still produces the visible gradient, but it cannot truthfully raise `alert`
without an agreeing neighbour.
