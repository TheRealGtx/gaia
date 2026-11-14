# Update for Chuqi — after the sensors started working

From: Giuliano. Saturday 14/11, 13:30. Follows
`sensing_ml/2026-11-14-report-for-chuqi.md`.

Your glue is right and I am using it: `read_sensor()` stayed in the App Lab app,
the node is started with `node.main(sensor=..., score=...)`, the LEDs follow the
network state, `score()` has the readable `temp` guard, and `get_params(share=)`
makes the green figure honest. The LED colours match the dashboard exactly.

One thing has to change, and it is not your mistake: it is something we only
learned at 13:00 today.

---

## 1. The node cannot run inside the App Lab app

Your `main.py` starts `node.main()` in a thread inside the App Lab app. That app
runs in a **container**, on a docker bridge: the board prints

```
my address 172.18.0.2, sending to 255.255.255.255:5005, 172.18.0.255:5005
```

`172.18.0.2` is the container, not the board. From there the broadcast never
reaches `wlan0`, so no board can hear another — that is why nothing worked all
morning, with the boards correctly connected to the hotspot the whole time
(`10.118.94.238`, SSID CMF Giuli).

The mesh works now because `node.py` runs on the **board's host OS**, outside
App Lab. Which leaves your app with the hardware (Thermo, Pixels) and the node
on the other side of a container boundary.

## 2. What to change: the app becomes a sensor client

The host is reachable from inside the container at the gateway address,
normally `172.18.0.1`. So: the app sends readings there once a second, and the
node answers with its state for the LEDs. One datagram each way.

**The node side is done and tested** (commit `cc69b69`). Your side replaces the
whole `# ---- network node ----` block with this:

```python
import json, socket

HOST = os.environ.get("NODE_HOST", "172.18.0.1")   # the board's host from here
PORT = int(os.environ.get("SENSOR_PORT", 5006))
_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
_sock.settimeout(0.5)
_state = {"dist": 99, "alert": False}

def send_reading():
    """One reading to the node on the host; its answer drives the LEDs."""
    v = read_sensor()                                  # your Bridge read, unchanged
    try:
        _sock.sendto(json.dumps(v).encode(), (HOST, PORT))
        _state.update(json.loads(_sock.recv(1024)))     # {"dist":1,"alert":false,...}
    except OSError:
        pass                                            # node not up yet: keep the last state
    return _state
```

and `colour()` reads `_state["dist"]` / `_state["alert"]` instead of
`node.state`. The colour mapping you wrote stays exactly as it is.

What the node does on its side, so you can predict it:

- it answers the **same** datagram with `{"id", "dist", "alert", "escape_to",
  "anomaly"}`: no second socket, nothing to open on your side;
- it listens on 5006 on a board (`SENSOR_PORT`; 5100+id when several nodes share
  a laptop, which is only for our tests);
- a reading older than five seconds (`SENSOR_TTL`) is not used, so keep sending
  once a second even when nothing changes. If the app stops, the node goes back
  to the keyboard anomaly rather than scoring degrees from five minutes ago;
- the first reading switches it to your model by itself, and it says so in its
  opening line: `anomaly=Chuqi's model on the sensor`;
- if the port is busy it prints `sensor bridge off, ...` and keeps running on
  the keyboard anomaly. The mesh never depends on the hardware being there.

Measured end to end, with your model loaded in the node: 22.5 °C gives anomaly
0.0 and `dist 99`; 60.0 °C gives 1.0 through your rate feature, `dist 0`, and
the reply that turns the Pixels red. So the moment your ten lines are in, the
hair dryer drives the LEDs of every board.

Three things get simpler for you:

- **`[P5]` disappears.** Only your `loop()` touches the Bridge now, so the
  question about calling it from two threads is moot.
- **`[P4]` and `GAIA_ROOT` disappear.** The app no longer imports `node.py` or
  `sensing_ml`: App Lab can upload only the app folder, it does not matter.
- **The model runs on the host**, where `node.py` imports `sensing_ml.model`
  from the repo. So your model keeps driving the anomaly, with the real
  readings, exactly as planned for the 17:00 checkpoint.

Keep `GAIA_MODE=test` as it is: it is the right thing for wiring checks, and the
30 °C threshold comment is clear enough that nobody will ship it by accident.

## 3. Calibration, now that the sensors read

This is the one thing only you can do, and it is on the critical path for the
17:00 checkpoint:

1. `RECORD=normal.csv` for ~5 minutes at room temperature, on a board in the
   place where it will sit during the demo.
2. `RECORD=hazard.csv` for ~1 minute with the hair dryer at a distance — the
   distance matters: too close and you calibrate for an event we cannot
   reproduce on stage.
3. `python calibrate.py normal.csv hazard.csv`, and put the numbers in
   `SIGMA_FLOOR` / `ZMAX` / `RATE_WINDOW` / `RATE_MAX`.

Until then every tuning knob is a guess, and the demo depends on the score
crossing 0.7 when you heat a board and staying below 0.4 when you do not.
Check both directions explicitly: heat it, see the alarm; put it down, see it
come back to normal within a few seconds.

Two numbers to watch while calibrating, because they decide what happens on
stage: `WARMUP = 20` means a node needs 20 readings (20 s) before its level
score counts at all — so do not power a board on and immediately heat it.
`RATE_MAX = 1.5 °C` in 10 s is what makes the hair dryer work: if the
temperature rises more slowly than that in the real room, the rate feature never
fires and only the level score saves you.

## 4. Small leftovers

- Rename `app_lab/echofield_node` to `app_lab/gaia_node`, and EchoField → Gaia
  in the docstrings of `main.py`, `model.py`, `app.yaml` and the sketch. The
  public name is Gaia; this is the last place it survives.
- `.DS_Store` (twice) and `sensing_ml/__pycache__/*.pyc` are still tracked in
  git and dirty the status of everyone else:
  `git rm -r --cached .DS_Store app_lab/*/.DS_Store sensing_ml/__pycache__`.
- Ask the mentors whether an App Lab app can use host networking. If it can, it
  is one line in `app.yaml` and the bridge in §2 becomes unnecessary — but do
  not wait for the answer: the bridge works today and tonight is close.
