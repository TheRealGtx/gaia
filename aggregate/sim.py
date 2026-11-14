#!/usr/bin/env python3
"""Run a whole Gaia field on one laptop, with the real node code.

Not a fake sender: every node here is `node.py` in its own process, so what you
see is the real gradient, the real consensus and the real recovery. It is how
we rehearse the cases that are slow or impossible to stage on the boards.

    python3 sim.py --scenario consensus        # the hard cases, with verdicts
    python3 sim.py --list                      # what there is
    python3 sim.py --scenario alert --broadcast --keep
                                               # feed a dashboard on UDP 5005

Scenarios (a line of nodes, 1-2-3-...):

    nominal    nobody in anomaly: every node reports dist 99, which is what a
               healthy field looks like. 99 means "I know of no hazard".
    alert      node 1 heats up alone. The gradient becomes 0-1-2, and `alert`
               stays OFF everywhere: with AGREE_MIN=1 a source needs a
               neighbour that agrees. This surprises people, so it is a test.
    consensus  nodes 1 and 2 heat up together: both see an agreeing neighbour,
               so the consensus alarm fires. This is the one to put in the
               video, and the reason to heat two boards on stage.
    failure    node 1 is the hazard, then the middle node is killed: the far
               side loses its path and falls back to 99 within the timeout.
    rejoin     the killed node comes back and the distances heal by themselves.
    coldstart  every node starts at once with the hazard already burning.
    reroute    --topology ring only, and the reason to wire the boards in a
               loop: the hazard is at node 1, a node on the path is killed, and
               the far side keeps a distance because the field finds the other
               way round. In a line the same kill just cuts the far side off.

Default is unicast on 127.0.0.1 (no traffic on your network). --broadcast puts
the real thing on UDP 5005, where a dashboard or `listen.py` can watch.
"""
import argparse
import os
import re
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
NODE = os.path.join(HERE, "node.py")
STATUS = re.compile(
    r"id=(\d+)\s+anom=([\d.]+)(?:\s+t=[-\d.]+)?\s+dist=(\d+)\s+via=(\S+)"
    r"\s+alert=(\S+)\s+esc=(\S+)")

SCENARIOS = ("nominal", "alert", "consensus", "failure", "rejoin", "coldstart",
             "reroute")
TOPOLOGIES = ("line", "ring")


class Field:
    """A line of nodes, each one a real node.py process."""

    def __init__(self, count, broadcast=False, agree_min=1, hot=(), topology="line"):
        self.count = count
        self.topology = topology
        self.broadcast = broadcast
        self.agree_min = agree_min
        self.hot = set(hot)                     # nodes that start in anomaly
        self.procs = {}
        self.last = {}                          # id -> parsed status line
        self.lock = threading.Lock()

    def neighbours(self, nid):
        if self.topology == "ring":                 # ...-> n -> 1, both ways
            before = self.count if nid == 1 else nid - 1
            after = 1 if nid == self.count else nid + 1
            return sorted({before, after} - {nid})
        return [n for n in (nid - 1, nid + 1) if 1 <= n <= self.count]

    def start(self, nid):
        env = dict(os.environ, PYTHONUNBUFFERED="1",
                   NODE_ID=str(nid),
                   NEIGHBORS=",".join(str(n) for n in self.neighbours(nid)),
                   AGREE_MIN=str(self.agree_min),
                   ANOMALY="1" if nid in self.hot else "0")
        env["MODE"] = "broadcast" if self.broadcast else "unicast"
        p = subprocess.Popen([sys.executable, NODE], env=env, cwd=HERE,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.procs[nid] = p
        threading.Thread(target=self._read, args=(nid, p), daemon=True).start()

    def _read(self, nid, p):
        for line in p.stdout:
            m = STATUS.search(line)
            if not m:
                continue
            with self.lock:
                self.last[nid] = {
                    "id": int(m.group(1)), "anomaly": float(m.group(2)),
                    "dist": int(m.group(3)), "via": m.group(4),
                    "alert": m.group(5) == "ON", "escape_to": m.group(6)}

    def say(self, nid, text):
        p = self.procs.get(nid)
        if not p or p.poll() is not None:
            return
        try:
            p.stdin.write(text + "\n")
            p.stdin.flush()
        except OSError:
            pass

    def kill(self, nid):
        p = self.procs.pop(nid, None)
        if p:
            p.kill()
            p.wait(timeout=5)
        with self.lock:
            self.last.pop(nid, None)

    def stop(self):
        for nid in list(self.procs):
            self.say(nid, "q")
        time.sleep(0.4)
        for nid in list(self.procs):
            self.kill(nid)

    def states(self):
        with self.lock:
            return dict(self.last)

    def show(self, label):
        s = self.states()
        row = "  ".join(
            "%d:[d=%-2s a=%.2f%s]" % (nid, s[nid]["dist"], s[nid]["anomaly"],
                                      " ALERT" if s[nid]["alert"] else "")
            for nid in sorted(s))
        print("%-26s %s" % (label, row or "(no node reporting)"), flush=True)
        return s


def wait(seconds, field=None, label=None):
    """Let the field settle; nodes need a heartbeat or two to agree."""
    end = time.time() + seconds
    while time.time() < end:
        time.sleep(0.25)
    if label:
        return field.show(label)
    return None


def check(ok, message, failures):
    print("   %s %s" % ("OK  " if ok else "FAIL", message), flush=True)
    if not ok:
        failures.append(message)


def run(scenario, count, broadcast, keep, agree_min=1, topology="line"):
    failures = []
    hot = {"coldstart": (1,)}.get(scenario, ())
    field = Field(count, broadcast=broadcast, hot=hot, agree_min=agree_min,
                  topology=topology)
    print("scenario %s, %d nodes in a %s, AGREE_MIN=%d, %s"
          % (scenario, count, topology, agree_min,
             "broadcast on 5005" if broadcast else "unicast on 127.0.0.1"))
    print("neighbours: %s\n" % "  ".join(
        "%d->%s" % (n, ",".join(str(x) for x in field.neighbours(n)))
        for n in range(1, count + 1)))

    def hops(nid):
        """Distance from node 1 once the field has settled: on a ring the short
        way round wins, which is the whole reason to wire the boards in a loop."""
        return min(nid - 1, count - (nid - 1)) if topology == "ring" else nid - 1
    try:
        for nid in range(1, count + 1):
            field.start(nid)
        s = wait(4, field, "started")

        if scenario == "nominal":
            check(all(v["dist"] == 99 for v in s.values()),
                  "a quiet field reports 99 everywhere (no hazard known)", failures)
            check(not any(v["alert"] for v in s.values()),
                  "nobody raises an alert", failures)

        elif scenario in ("alert", "failure", "rejoin"):
            field.say(1, "a")                           # node 1 becomes the hazard
            s = wait(4, field, "node 1 in anomaly")
            check(s[1]["dist"] == 0, "node 1 is the source (dist 0)", failures)
            check(all(s[n]["dist"] == hops(n) for n in s if n > 1),
                  "the gradient counts the hops away from it", failures)
            check(not any(v["alert"] for v in s.values()),
                  "no consensus alert: one source alone is not agreement", failures)

            if scenario in ("failure", "rejoin"):
                field.kill(2)
                s = wait(7, field, "node 2 killed")
                if topology == "ring":
                    check(all(s[n]["dist"] < 99 for n in s if n > 2),
                          "on a ring nobody is cut off: the field routes around it",
                          failures)
                else:
                    check(all(s[n]["dist"] == 99 for n in s if n > 2),
                          "the far side loses its path and says 99, not a stale number",
                          failures)
                check(s[1]["dist"] == 0, "the source is unaffected", failures)

            if scenario == "rejoin":
                field.start(2)
                s = wait(7, field, "node 2 back")
                check(all(s[n]["dist"] == hops(n) for n in s if n > 1),
                      "the field heals by itself, nobody restarted anything else",
                      failures)

        elif scenario == "consensus":
            field.say(1, "a")
            field.say(2, "a")                           # two adjacent sources
            s = wait(5, field, "nodes 1 and 2 in anomaly")
            if agree_min <= 1:
                check(s[1]["alert"] and s[2]["alert"],
                      "both sources raise the consensus alert", failures)
            else:
                # In a line only the middle nodes have two neighbours, so with
                # AGREE_MIN=2 the ends can never alert, whatever you heat.
                check(not s[1]["alert"],
                      "with AGREE_MIN=%d the end node cannot alert, by design"
                      % agree_min, failures)
            check(all(not s[n]["alert"] for n in s if n > 2),
                  "nodes that are not in anomaly do not", failures)
            field.say(1, "0")
            field.say(2, "0")
            s = wait(6, field, "both cooled down")
            check(not any(v["alert"] for v in s.values()),
                  "the alert clears once the anomaly is gone (hysteresis)", failures)

        elif scenario == "reroute":
            far = 1 + count // 2                    # the node opposite the hazard
            field.say(1, "a")
            s = wait(4, field, "node 1 in anomaly")
            before = s[far]["dist"]
            check(before < 99, "node %d has a path to the hazard" % far, failures)
            field.kill(2)                           # one side of the loop
            s = wait(7, field, "node 2 killed")
            check(s[far]["dist"] < 99,
                  "node %d keeps a distance: the field went round the other way"
                  % far, failures)
            if count % 2 == 0:
                check(s[far]["dist"] == before,
                      "and the same distance, because an even loop is symmetric",
                      failures)
            else:
                check(s[far]["dist"] > before,
                      "at a longer distance (%d -> %d): the other way round an odd "
                      "loop has one more hop, and the LEDs show it"
                      % (before, s[far]["dist"]), failures)

        elif scenario == "coldstart":
            check(s[1]["dist"] == 0, "the node that booted hot is the source", failures)
            check(all(s[n]["dist"] == hops(n) for n in s if n > 1),
                  "the others find their distance without any warm-up", failures)

        if keep:
            print("\nkeeping the field alive, ctrl-c to stop", flush=True)
            while True:
                time.sleep(2)
                field.show("")
    except KeyboardInterrupt:
        pass
    finally:
        field.stop()

    print()
    if failures:
        print("FAILED: %d check(s)" % len(failures))
        for f in failures:
            print("  -", f)
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scenario", choices=SCENARIOS, default="alert")
    ap.add_argument("--nodes", type=int, default=3)
    ap.add_argument("--topology", choices=TOPOLOGIES, default="line",
                    help="a line of boards, or a loop where every node has two "
                         "neighbours and the field can route around a loss")
    ap.add_argument("--broadcast", action="store_true",
                    help="put the packets on UDP 5005 for a dashboard to watch")
    ap.add_argument("--agree-min", type=int, default=1,
                    help="neighbours that must agree before a node alerts (default 1)")
    ap.add_argument("--keep", action="store_true", help="leave the field running")
    ap.add_argument("--list", action="store_true", help="print the scenarios")
    args = ap.parse_args()
    if args.list:
        print(__doc__)
        sys.exit(0)
    if args.nodes < 2:
        ap.error("a field needs at least two nodes")
    if args.scenario == "reroute" and (args.topology != "ring" or args.nodes < 4):
        ap.error("reroute needs --topology ring and at least four nodes: "
                 "that is the whole point of it")
    sys.exit(run(args.scenario, args.nodes, args.broadcast, args.keep,
                 args.agree_min, args.topology))
