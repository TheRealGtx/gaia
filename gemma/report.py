"""Gaia situation report: Gemma 3 1B explains the field in plain words (Chuqi).

Gemma never decides anything. The nodes already did: dist, alert and escape_to
come from the network. This script only turns that state into one or two
sentences a non-technical person can read, and sends them to the dashboard.

    gateway (Pietro, :8000)  --ws snapshot-->  report.py  --prompt-->  Gemma (Ollama)
                                                   |
                                                   +--POST ai-summary-->  dashboard

The template line goes to the dashboard at once; Gemma's version replaces it
when it is ready (seconds on a laptop, tens of seconds on a UNO Q), unless the
field changed meanwhile. If Gemma is not reachable or says something empty,
the template line simply stays, so the demo never depends on it. Every
line says which one wrote it ("Gemma:" or "Template:").

Run (gateway already running; Ollama with `ollama pull gemma3:1b` for Gemma):
    python3 gemma/report.py
Settings (environment, all optional):
    GATEWAY   http://localhost:8000      Pietro's gateway
    OLLAMA    http://localhost:11434     where Gemma runs (can be a board's IP)
    MODEL     gemma3:1b
    EVERY     10        seconds between reports (only sent when something changed)
    GEMMA_TIMEOUT 120   seconds to wait for Gemma (a UNO Q is slow, a laptop is not)
    NO_GEMMA  1         template only
Needs only the standard library plus `websockets` (already in the gateway venv).
"""
import json
import threading
import os
import time
import urllib.request

from websockets.sync.client import connect

GATEWAY = os.environ.get("GATEWAY", "http://localhost:8000").rstrip("/")
OLLAMA = os.environ.get("OLLAMA", "http://localhost:11434").rstrip("/")
MODEL = os.environ.get("MODEL", "gemma3:1b")
EVERY = float(os.environ.get("EVERY", 10))
TIMEOUT = float(os.environ.get("GEMMA_TIMEOUT", 120))   # a UNO Q needs tens of seconds
NO_GEMMA = os.environ.get("NO_GEMMA") == "1"
UNKNOWN = 99


def nodes_of(env):
    """The sensors of one environment, as a list sorted by physical id."""
    return sorted(env.get("sensors", {}).values(), key=lambda s: s.get("physicalId") or 0)


def facts(nodes):
    """What the network says, one line per node: the only thing Gemma may use."""
    by_id = {s.get("id"): s.get("name") for s in nodes}
    lines = []
    for s in nodes:
        if s.get("status") == "offline":
            lines.append("- %s (node %s): OFFLINE" % (s.get("name"), s.get("physicalId")))
            continue
        d = s.get("gradientDistance")
        where = ("HAZARD HERE" if d == 0 else "no hazard known" if d is None or d >= UNKNOWN
                 else "%s hop(s) from the hazard" % d)
        t = s.get("temperature")
        lines.append("- %s (node %s): %s, %s, consensus alert %s%s" % (
            s.get("name"), s.get("physicalId"),
            "%.1f C" % t if isinstance(t, (int, float)) else "temperature unknown",
            where, "ON" if s.get("networkAlert") else "off",
            ", escape towards %s" % by_id.get(s["escapeTo"], s["escapeTo"]) if s.get("escapeTo") else ""))
    return "\n".join(lines)


def template(nodes):
    """The report without any model. Always correct, a bit robotic."""
    online = [s for s in nodes if s.get("status") != "offline"]
    off = [s.get("name") for s in nodes if s.get("status") == "offline"]
    hot = [s for s in online if s.get("gradientDistance") == 0]
    tail = (" %s not reporting." % ", ".join(off)) if off else ""
    if not hot:
        return "All clear: %d of %d nodes online, no hazard detected.%s" % (
            len(online), len(nodes), tail)
    names = ", ".join(s.get("name") for s in hot)
    agree = any(s.get("networkAlert") for s in online)
    dist = lambda s: s.get("gradientDistance") if s.get("gradientDistance") is not None else -1
    far = max(dist(s) for s in online)
    safe = [s.get("name") for s in online if dist(s) == far and far > 0]
    msg = "Heat anomaly at %s. %s %s" % (
        names,
        "Neighbouring nodes agree: fire risk confirmed." if agree
        else "Only one node sees it so far: check before acting.",
        "Move away from it, towards %s." % " or ".join(safe) if safe else "Move away from it.")
    return msg + tail


def ollama(prompt, num_predict=60):
    body = json.dumps({"model": MODEL, "prompt": prompt, "stream": False,
                       "keep_alive": "2h",        # stay in memory: loading is the slow part
                       "options": {"temperature": 0.2, "num_predict": num_predict,
                                   "num_ctx": 512}}).encode()
    req = urllib.request.Request(OLLAMA + "/api/generate", body,
                                 {"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read()).get("response", "")


def gemma(nodes, fallback):
    """Gemma rewrites the template line for people. The prompt is kept short on
    purpose: on a UNO Q every prompt token costs time."""
    hot = ", ".join("%s %.0f C" % (s.get("name"), s["temperature"]) for s in nodes
                    if s.get("gradientDistance") == 0 and isinstance(s.get("temperature"), (int, float)))
    prompt = ("Rewrite this wildfire sensor alert for the public in at most two short, calm "
              "sentences. Keep every place name. Do not add facts.\n"
              "Alert: %s%s\nRewritten:" % (fallback, (" (%s)" % hot) if hot else ""))
    text = ollama(prompt).strip().strip('"')
    return " ".join(text.split())


def send(env_id, text):
    body = json.dumps({"type": "ai-summary", "environmentId": env_id, "summary": text}).encode()
    req = urllib.request.Request(GATEWAY + "/v1/events", body, {"content-type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=3).read()
    except OSError as e:
        print("   (dashboard did not take it: %s)" % e, flush=True)


def key(nodes):
    """What has to change before a new report is worth writing."""
    return tuple((s.get("id"), s.get("status"), s.get("gradientDistance"),
                  bool(s.get("networkAlert")), s.get("escapeTo")) for s in nodes)


def main():
    ws_url = GATEWAY.replace("http", "ws", 1) + "/ws"
    print("Gaia report: gateway %s, %s" % (
        ws_url, "template only" if NO_GEMMA else "Gemma %s at %s" % (MODEL, OLLAMA)), flush=True)
    envs, last_key, last_at = {}, {}, {}
    if not NO_GEMMA:
        threading.Thread(target=warm_up, daemon=True).start()
    with connect(ws_url, open_timeout=5) as ws:
        while True:
            try:
                msg = json.loads(ws.recv(timeout=1))
                if msg.get("type") == "snapshot" and isinstance(msg.get("environments"), dict):
                    envs = msg["environments"]
            except TimeoutError:
                pass
            now = time.time()
            for env_id, env in envs.items():
                nodes = nodes_of(env)
                if not nodes or now - last_at.get(env_id, 0) < EVERY or key(nodes) == last_key.get(env_id):
                    continue
                last_key[env_id], last_at[env_id] = key(nodes), now
                text = template(nodes)
                report(env_id, "Template: " + text)
                if not NO_GEMMA:
                    threading.Thread(target=rewrite, daemon=True,
                                     args=(env_id, nodes, text, last_key)).start()


busy = threading.Lock()                     # one Gemma request at a time


def report(env_id, line):
    print(time.strftime("%H:%M:%S"), env_id, line, flush=True)
    send(env_id, line)


def rewrite(env_id, nodes, text, last_key):
    """Gemma's version of the line, sent only if the field has not changed since."""
    with busy:                              # queue behind a slower earlier request
        if last_key.get(env_id) != key(nodes):
            return                          # the field moved on while we waited
        t0 = time.time()
        try:
            g = gemma(nodes, text)
        except Exception as e:              # no Ollama, timeout: the template line stays
            print("   (Gemma unavailable after %.0fs: %s)" % (time.time() - t0, e), flush=True)
            return
        print("   (Gemma took %.1fs)" % (time.time() - t0), flush=True)
        if g and last_key.get(env_id) == key(nodes):
            report(env_id, "Gemma: " + g)


def warm_up():
    """Load the model before the demo needs it (the first call is the slowest)."""
    with busy:
        t0 = time.time()
        try:
            ollama("Say OK.", num_predict=3)
            print("   (Gemma ready, warm-up took %.1fs)" % (time.time() - t0), flush=True)
        except Exception as e:
            print("   (Gemma warm-up failed: %s)" % e, flush=True)

if __name__ == "__main__":
    main()
