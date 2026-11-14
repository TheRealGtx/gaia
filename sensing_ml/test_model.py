"""Check the model on a laptop with fake readings (no hardware needed).

    python test_model.py
"""
import random

from model import NodeModel, N_MAX


def normal(t):
    return {"temp": 22.0 + random.gauss(0, 0.08), "hum": 45.0}


def hairdryer(t, start):
    rise = min(2.0 * (t - start), 25.0)          # about +2 °C per second, up to +25
    return {"temp": 22.0 + rise + random.gauss(0, 0.08), "hum": 40.0}


def run(model, reading, t0, t1):
    return [model.score(reading(t), t=t) for t in range(t0, t1)]


random.seed(0)

print("1) normal for 2 minutes: no false alarm")
m = NodeModel()
s = run(m, normal, 0, 120)
print(f"   max score {max(s[30:]):.2f}  (want < 0.4)")

print("2) hair dryer: score above 0.7 quickly")
s = run(m, lambda t: hairdryer(t, 120), 120, 140)
first = next(i for i, v in enumerate(s) if v > 0.7)
print(f"   above 0.7 after {first} s, peak {max(s):.2f}")

print("3) back to room temperature: score back below 0.4")
s = run(m, normal, 140, 200)
back = next((i for i, v in enumerate(s) if v < 0.4), None)
print(f"   below 0.4 after {back} s")

print("4) cold start: new node with n=0 gets neighbours' params")
new = NodeModel()
new.merge_params([m.get_params(), m.get_params()])
print(f"   mu {new.mu:.2f}  sigma {new.sigma:.2f}  n {new.n}")
print(f"   normal reading -> {new.score(normal(0), t=0):.2f}, "
      f"hot reading -> {new.score({'temp': 30.0}, t=1):.2f}")

print("5) repeated merges: n stays capped, model keeps learning")
a, b = NodeModel(), NodeModel()
run(a, normal, 0, 100)
run(b, normal, 0, 100)
for _ in range(50):
    pa, pb = a.get_params(), b.get_params()
    a.merge_params([pb])
    b.merge_params([pa])
print(f"   n after 50 merges: {a.n} (cap {N_MAX})")

print(f"6) bytes: sent {m.bytes_sent}, raw would be {m.bytes_if_raw_data}")
