# sensing_ml (Chuqi): node model

Each node learns its own normal temperature (running mean + std, Welford)
and scores anomalies 0-1. Neighbours share only `mu`, `sigma`, `n`.

## Interface (for Giuliano's node loop)

```python
from model import anomaly_score, get_params, merge_params, bytes_report

state["anomaly"] = anomaly_score({"temp": 23.1, "hum": 41.0})
params = get_params()            # {"mu": 22.4, "sigma": 1.1, "n": 300}
merge_params([p1, p2])           # neighbours' params, every 10-20 s
bytes_report()                   # {"bytes_sent": ..., "bytes_if_raw_data": ...}  -> Pietro
```

## Score

`score = max(level, rate)`
- level: how many std devs from this node's mean, divided by `ZMAX` (0 during the first `WARMUP` readings)
- rate: temperature rise over the last `RATE_WINDOW` s, divided by `RATE_MAX`

The model only learns from readings with score < `LEARN_BELOW`, so a hazard never becomes "normal".
`n` is capped at `N_MAX`: without the cap, repeated merges count the same data again and again,
`n` explodes and the model stops learning.

## Test and calibrate

```bash
python test_model.py                         # fake data, no hardware
python calibrate.py normal.csv hazard.csv    # real recordings: time,temp,hum
```

## Parameters (calibrated on Node3, 14/11)

| Name | Value | Meaning |
| --- | --- | --- |
| SIGMA_FLOOR | 0.5 °C | minimum std dev, stops tiny noise causing alarms |
| ZMAX | 4.0 | z-score mapped to 1.0 |
| RATE_WINDOW | 10 s | window for rate of change |
| RATE_MAX | 1.5 °C | rise in the window mapped to 1.0 |
| LEARN_BELOW | 0.4 | learn only below this score |
| N_MAX | 300 | sample count cap |

### Calibration result

`normal.csv`: 5 min at room temperature (25.1-25.4 °C, noise sd 0.06 °C).
`hazard.csv`: 1 min, finger on the Thermo after ~10 s (25.3 -> 33.8 °C).

| sigma_floor | max normal score | seconds to > 0.7 in hazard |
| --- | --- | --- |
| 0.30 - 1.50 | 0.13 | 11 (about 1 s after the heat starts) |

No false alarm in 5 min (max 0.13, limit 0.4), and the hazard is caught about
one second after the heat arrives. Every floor gives the same result because
the rate feature catches the hazard first, so we keep the safer 0.5 for a
noisy hall. The recordings are in this folder.

Keep the Modulino Thermo on its cable, away from the board: the UNO Q warms up.
