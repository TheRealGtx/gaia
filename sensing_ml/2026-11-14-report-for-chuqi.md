# Report for Chuqi — model, App Lab app, what to change

From: Giuliano (aggregate computing / nodes). Date: Saturday 14/11.
About `sensing_ml/model.py` and `app_lab/echofield_node/`.

Your model is wired into the node and tested. Four things need a change, one of
them before we go on the boards. `Plan.md` stays the source of truth for the
contract.

---

## 1. What already works, do not change the signatures

The node imports and uses, exactly as your README promised:

| Function | Used for | Status |
| --- | --- | --- |
| `anomaly_score(values, t=None)` | the anomaly that drives the gradient | wired |
| `get_params()` | `mu`/`sigma`/`n` in every heartbeat | wired |
| `merge_params(others)` | federated averaging every 15 s, own thread | wired |
| `bytes_report()` | `bytes_sent` / `bytes_if_raw_data` to Pietro's green panel | wired |

Test the whole chain against your real model right now, with no hardware:

```bash
ANOMALY_SRC=model python3 aggregate/node.py
```

That feeds simulated readings into your `anomaly_score()`. Press `a` and the
score jumps to 1.0 through the rate feature; `n` grows one per second; the byte
counters appear in the packet. If you change the tuning knobs, this is the
fastest way to see the effect end to end.

## 2. Do NOT move `read_sensor()` into `model.py`

Your app README says, as step 2, to move `read_sensor()` into
`sensing_ml/model.py` so the node switches to the real score. That will not work
on the board: `read_sensor()` needs `Bridge`, which only exists inside the App
Lab runtime, and `model.py` also runs on our laptops, in `test_model.py` and in
`calibrate.py`. Importing the Bridge there breaks all three.

Keep `read_sensor()` where it is, in the App Lab app, and **pass it to the node**.
I made `aggregate/node.py` importable for this. In
`app_lab/echofield_node/python/main.py`:

```python
import sys, threading
sys.path.insert(0, "<repo>/aggregate")        # wherever the repo sits on the board
import node
from sensing_ml.model import anomaly_score

threading.Thread(target=node.main,
                 kwargs={"sensor": read_sensor, "score": anomaly_score},
                 daemon=True).start()
```

Your `App.run(user_loop=loop)` keeps the main thread, the node runs beside it.
`node.main()` then reports `anomaly=Chuqi's model on the sensor` in its first
line: that is how you know the injection worked. Set `NODE_ID` and `NEIGHBORS`
per board in the app environment (`1` → `2`, `2` → `1,3`, `3` → `2`).

## 3. The LEDs must follow the network, not a temperature threshold

`main.py` currently does `red if temp > 30`. Two problems: a fixed threshold is
exactly what our pitch says we do *not* do, and the LED would contradict the
dashboard, which shows the network-computed state. Once the node is running in
the app, read the colour from it:

```python
def colour():
    with node.lock:
        d, alert = node.state["dist"], node.state["alert"]
    if alert or d == 0:        return (60, 0, 0)    # red:   I am the hazard
    if d == 1:                 return (50, 35, 0)   # amber: one hop away
    if d >= node.UNKNOWN:      return (0, 0, 30)    # blue:  I know of no hazard
    return (0, 40, 0)                               # green: far from the hazard
```

Keep the `30 °C` version only for your step-1 sensor test, and say so in a
comment, so nobody ships it by accident. The colour thresholds are Pietro's
business too — same mapping as the dashboard: `0` red, `1` amber, `>= 2` green,
`99` grey/blue.

## 4. The byte counter bills federated learning fifteen times over

Measured on a two-node run: `bytes_sent` 204 against `bytes_if_raw_data` 451 —
a 55% saving, when the real story is ~95%. The cause is a side effect in
`get_params()`: it increments `bytes_sent` every time it is called, and the node
calls it **once per second** to put `mu`/`sigma`/`n` in the heartbeat for the
dashboard, while parameters are only merged **every 15 s**. So the counter
charges learning for fourteen copies it never needed.

Cleanest fix is on your side, two lines: stop counting in the getter and count
where the sharing actually happens.

```python
def get_params(self, share=False):
    p = {"mu": round(self.mu, 3), "sigma": round(self.sigma, 3), "n": self.n}
    if share:                       # only when these bytes are really spent
        self.bytes_sent += len(json.dumps(p))
    return p
```

The node would then call `get_params()` for display and `get_params(share=True)`
once per merge. Tell me if you prefer it the other way (we send the parameters
only every 15 s and the dashboard keeps the last value) — that is five lines in
`node.py` instead, but it changes the contract with Pietro, so it needs his ok.
Either way, decide it today: it is the number we say on stage.

## 5. Small fixes in `model.py`

- `score()` does `x = values["temp"]`: a reading without `temp` raises KeyError.
  The node catches it and falls back to the fake anomaly, which on stage looks
  like "the model is doing nothing" with no error anywhere. Guard it, or raise
  something explicit.
- `main.py` writes the CSV to a path nobody knows ([P3]). Print
  `os.path.abspath(RECORD)` on startup, or you will record five minutes of
  normal data and then hunt for the file.
- `merge_params` pools variance across nodes, so a node sitting in a warm spot
  raises everyone's `sigma` and makes the whole field less sensitive. Not a bug,
  but check it during calibration with two boards at different temperatures.

## 6. The Bridge calls must not block

Your sketch notes `provide_safe` as the fallback if I2C reads hang. Please
verify it with the mentors and use it if there is any doubt: the node calls
`read_sensor()` once per second from its main loop. Until an hour ago a hanging
Bridge call would have frozen the node's heartbeat and taken it off the network
entirely while it kept running — my bug, now fixed (the reading happens outside
the lock), but a Bridge call that blocks for seconds still means a stale anomaly
and a node the others see as a dead neighbour after four seconds. Keep
`read_temp` / `read_hum` fast and non-blocking.

## 7. Naming and git hygiene

- The public name is **Gaia**. Rename `app_lab/echofield_node` →
  `app_lab/gaia_node`, and replace EchoField in `sensing_ml/model.py` line 1,
  `app.yaml` (`name`, `description`), the app README and the sketch comments.
- `.DS_Store` (twice) and `sensing_ml/__pycache__/model.cpython-313.pyc` are in
  git. They were committed before the `.gitignore` existed, so the ignore rules
  do not untrack them: `git rm -r --cached .DS_Store app_lab/echofield_node/.DS_Store sensing_ml/__pycache__`
  and commit. After that the `.gitignore` keeps them out.

## 8. Checklist, in the order I would do it

1. The glue in `main.py` (§2) and the LED colour from the node state (§3) —
   this is what the 14:30 checkpoint needs: a board in anomaly changing the
   other boards' LEDs.
2. The decision on the byte counter (§4), and the two lines if it is yours.
3. Verify the Bridge API with the mentors ([B1] [B2] [M1] [P1] [P2] [A1]) — the
   whole sensor path is guesswork until then, and it is the last unknown on the
   critical path.
4. Record `normal.csv` and `hazard.csv`, run `calibrate.py`, and put the real
   numbers in `SIGMA_FLOOR` / `ZMAX` / `RATE_WINDOW` / `RATE_MAX`.
5. Naming and git cleanup (§7), five minutes, before the submission rush.

Nothing else is needed from you for the aggregate side: gradient, consensus,
neighbour timeout, escape direction and the parameter exchange are done and
tested, and `aggregate/listen.py` prints everything that moves on the network if
you want to watch your score propagate.
