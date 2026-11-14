# Contract change: the model parameters are now sticky (one heartbeat in 15)

From: Giuliano. Date: Saturday 14/11, after `2026-11-14-report-for-pietro.md`.
Decided by Chuqi: option (a) of §3.5 of that report. Implemented and tested in
`aggregate/node.py`; `Plan.md` is updated.

**One change for you: `mu`, `sigma` and `n` are no longer in every packet.
Treat them as last-known values.**

---

## 1. Why

The node used to call Chuqi's `get_params()` once per second to put
`mu`/`sigma`/`n` in every heartbeat, while parameters are only merged every
15 s. Her `bytes_sent` counter is incremented inside `get_params()`, so
federated learning was charged for fifteen copies the learning never needed,
and the green-AI figure came out at 55% instead of ~95%. Now the parameters go
on the wire once every `PARAM_EVERY` (15 s) and the counter measures what we
actually spend.

Measured, two nodes, cadence forced to 3 s for the test: 10 packets, 4 with
parameters, `bytes_sent` 107 against `bytes_if_raw_data` 779 — 86% saved. At the
production 15 s it is ~95%.

## 2. What changes on the wire

A heartbeat **with** parameters (one in fifteen, and always the first one after
startup, so a node that just joined is immediately useful to its neighbours):

```json
{"id": 1, "anomaly": 0.0, "dist": 99, "via": null, "alert": false,
 "escape_to": null, "temperature": 20.0, "humidity": 45.0, "simulated": true,
 "bytes_sent": 0, "bytes_if_raw_data": 41, "ts": 1794651684.79,
 "mu": 20.0, "sigma": 1.0, "n": 1}
```

The other fourteen, identical minus those three keys:

```json
{"id": 1, "anomaly": 0.0, "dist": 99, "via": null, "alert": false,
 "escape_to": null, "temperature": 20.0, "humidity": 45.0, "simulated": true,
 "bytes_sent": 34, "bytes_if_raw_data": 123, "ts": 1794651685.79}
```

Everything else is unchanged: `dist`, `via`, `alert`, `escape_to`,
`temperature`, `humidity`, `simulated`, the byte counters, `ts`, the four-second
offline rule, and `dist = 99` still meaning *unknown*.

## 3. What you need to change

- **Task 1, the validator.** `mu`, `sigma` and `n` move from required to
  optional. Required: `id`, `anomaly`, `dist`, `alert`, `ts`, plus
  `temperature` and `humidity` as nullable. A packet without the parameters is
  valid and is the normal case — fourteen out of fifteen.
- **Task 2, the store.** Keep the last parameters seen per node and carry them
  forward. Never overwrite them with nothing because a packet had none. Keep
  the time they were last updated: it is the only honest way to show them.
- **Task 3, the normalizer.** `mu`/`sigma`/`n` become last-known plus an age.
  Their absence is not a state change: it must not flip a node to "learning",
  to zero, or to stale. Only the node going offline makes them stale.
- **Task 4, the node detail.** Show the parameters with their age ("updated 12 s
  ago"). While `n < 20` show "learning (n/20)" instead of a temperature: before
  that Chuqi's model reports `mu = 0.0`, `sigma = 1.0`, which reads as a broken
  sensor.
- **Task 5, Green AI.** The counters still arrive every second — they are two
  small integers of telemetry, not the learning payload, and Chuqi's counter
  does not count them. Cumulative per node: keep the newest per node, sum across
  nodes, and treat a counter that goes **down** as a reboot (reset the baseline;
  never render a negative saving). `bytes_sent` of 0 with a non-zero
  `bytes_if_raw_data` is correct on a fresh node: nothing shared yet.
- **Task 6, the fake sender.** It must reproduce this cadence: parameters in one
  packet out of fifteen, the first one included. A generator that puts them in
  every packet makes your tests pass against a packet shape that no longer
  exists on the real network — which is the argument for dropping it in favour
  of `sim.py` running real nodes (§3.6 of the previous report).

## 4. Tests worth adding

- A node whose first packets carry no parameters (it joined while you were
  running): the detail panel must say "learning", not 0 °C.
- Parameters received once, then absent for 60 s: still displayed, with the age.
- Node reboot: `n` drops back to a small number and the byte counters restart
  from zero — no negative saving, no rewind of the readings.
- A packet with `mu` present but `n` missing: reject the parameters, keep the
  previous ones, accept the rest of the packet.

## 5. One honesty point before the pitch

`bytes_if_raw_data` counts the readings the model scored, that is what we would
have had to ship to a server to train a central model. `bytes_sent` counts the
parameters actually shared with the neighbours. The comparison is about
**learning**, and it is now honest.

What it is not: a claim that the network sends 95% fewer bytes. The heartbeat
still carries `temperature` and `humidity` every second, because your dashboard
and Gemma need them — locally, never to a server. A judge who reads one packet
will see those fields, so the sentence on stage should be close to: "sharing
what each node learned costs ~95% less than shipping its readings away to train
a central model, and the readings themselves never leave the local network."
That is defensible against the packet dump; "we send 95% less data" is not.
