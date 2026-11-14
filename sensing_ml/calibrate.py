"""Tune SIGMA_FLOOR / ZMAX on your real recordings.

    python calibrate.py normal.csv hazard.csv

CSV columns: time,temp,hum  (time in seconds, one row per reading)
Prints, for several SIGMA_FLOOR values, the highest score on normal data
(should stay < 0.4) and how fast the hazard run goes above 0.7.
"""
import csv
import sys

import model


def load(path):
    with open(path) as f:
        return [(float(r["time"]), {"temp": float(r["temp"]), "hum": float(r["hum"])})
                for r in csv.DictReader(f)]


def main(normal_path, hazard_path):
    normal, hazard = load(normal_path), load(hazard_path)
    t_shift = normal[-1][0] + 1 - hazard[0][0]       # play hazard right after normal
    print("sigma_floor | max normal score | seconds to >0.7 in hazard")
    for floor in [0.3, 0.5, 0.75, 1.0, 1.5]:
        model.SIGMA_FLOOR = floor
        m = model.NodeModel()
        normal_scores = [m.score(v, t=t) for t, v in normal]
        hazard_scores = [m.score(v, t=t + t_shift) for t, v in hazard]
        skip = model.WARMUP + 5
        worst = max(normal_scores[skip:], default=0.0)
        hit = next((i for i, s in enumerate(hazard_scores) if s > 0.7), None)
        ok = "OK" if worst < 0.4 and hit is not None else "  "
        print(f"   {floor:5.2f}    |      {worst:.2f}        | {hit}  {ok}")
    print("Pick the smallest floor marked OK, and set it in model.py")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
