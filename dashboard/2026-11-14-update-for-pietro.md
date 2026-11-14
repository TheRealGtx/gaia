# Update for Pietro — after reading the first dashboard version

From: Giuliano. Saturday 14/11, 13:30. Follows `2026-11-14-report-for-pietro.md`
and `2026-11-14-contract-change-sticky-params.md`.

The boards talk to each other now: two nodes on the real hardware, gradient and
recovery working. So this is no longer theory, the packets are on the Wi-Fi.

You implemented everything I asked for: optional `mu`/`sigma`/`n` with sticky
carry-forward, `dist >= 99` excluded from the safest-area pick, `learning
(n/20)`, the four-second offline rule, the manifest, the read-only wording. Two
things to fix, and the first one is my fault.

---

## 1. The banner says WARNING when nothing is wrong (my bad instruction)

At rest **every node reports `dist = 99`**: 99 means "I know of no hazard", and
with no fire anywhere that is the normal, healthy state of the whole field.

`store.py` maps it to `status = "unknown"`, and `alertBannerModel.ts` turns any
`unknown` into `WARNING`. So the opening frame of the demo — three quiet nodes,
nothing burning — is a yellow **WARNING: elevated reading or unknown hazard
path**. ALL CLEAR can never appear.

I told you "treat `dist >= 99` as unknown, its own colour, excluded from the
safest area". That was right for *picking the safest node* and wrong as a
blanket status. The rule that is actually correct:

- **no hazard anywhere in the field** → `dist = 99` is **normal** (green). It is
  what every node reports when all is well.
- **a hazard exists** (some node with `dist == 0` or `alert`) → a node still at
  99 has no path to it: *that* is genuinely **unknown** (grey), and worth
  showing, because it means the field is split.

Concretely, in `store.py:update_udp_packet`:

```python
status = ("critical" if packet.alert or packet.dist == 0
          else "warning" if packet.dist == 1
          else "normal")              # >= 2 and 99 are both fine on their own
```

and keep the fact aside, for example `"hazardPathKnown": packet.dist < 99`.
Then in `snapshot()`, which is the only place that sees the whole field, upgrade
to `unknown` only when a source exists:

```python
sensors = environment["sensors"].values()
if any(s.get("status") == "critical" for s in sensors):
    for s in sensors:
        if s.get("status") == "normal" and not s.get("hazardPathKnown"):
            s["status"] = "unknown"
```

Same error in the line below it: `connectivity = "unknown" if packet.dist >= 99`.
Connectivity is about **being heard**, not about knowing where a fire is. A node
that answers every second is connected even if its `dist` is 99. Derive
connectivity from freshness only (your four-second rule), never from `dist`.

Worth a test: a field of three quiet nodes must give `ALL CLEAR`.

## 2. `simulated` is stored but never shown

`store.py` carries `simulated` through and nothing in the UI reads it. Right now
**every reading on the network has `simulated: true`**: there is no
`read_sensor()` on the boards yet, so `temperature` is derived from the fake
anomaly. Without a badge the dashboard shows 47.0 °C as if a sensor had measured
it, which is the kind of thing that ends a pitch badly if a judge asks.

Show it where the number is: a small "simulated" chip next to the temperature in
`SensorCard`, and in the situation report ("readings simulated"). When Chuqi's
sensor path lands, the same packets start arriving with `simulated: false` and
the badge disappears by itself.

## 3. Smaller things, in order of how much they can bite

- **Duplicate packets are normal now.** Each node sends one copy of the
  heartbeat per local interface (a board has Wi-Fi plus a USB link, and that is
  how we fixed the boards not hearing each other). Your store overwrites, so the
  state stays right, but you emit a WebSocket event per datagram: two or three
  per node per second instead of one. If the socket gets noisy, drop a packet
  whose `(id, ts)` you have already processed.
- **Three nodes in the manifest, two boards running.** Node 3 will sit there
  grey for the whole demo and reads as "a third of the network is down". If only
  two boards run tonight, ship a two-node manifest and add the third back when
  it joins.
- **`mu`/`sigma` arrive every 15 s**, so right after the gateway starts a node
  can be on screen for up to 15 s with no model values. `learning (0/20)` is the
  right thing to show, which you already do — just do not let it flicker back to
  `—` when a packet without parameters arrives.
- Check the gateway against the real boards **now**, not at 20:00:
  `python3 aggregate/listen.py` on the same Wi-Fi tells you in five seconds
  whether the packets reach your machine at all; then point the gateway at them.

## 4. What is true on our side right now

- Two boards, `node.py` running **on the board's host OS**, not inside App Lab:
  the App Lab container sits on a docker bridge (172.18.0.2) and its broadcast
  never reaches the Wi-Fi. That cost us the whole morning; it is why the LEDs
  are not wired yet.
- Readings are still simulated, the anomaly still comes from the keyboard
  (`ANOMALY=1` at startup, or `a` + Enter).
- The packet shape is exactly the one your parser accepts; I re-read
  `protocol.py` against a live capture and found nothing to change there.
