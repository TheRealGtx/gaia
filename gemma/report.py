"""Gaia situation report: Gemma 3 1B explains the field in plain words (Chuqi).

Gemma never decides anything. The nodes already did: dist, alert and escape_to
come from the network. This script only turns that state into one or two
sentences a non-technical person can read, and sends them to the dashboard.

    gateway (Pietro, :8000)  --ws snapshot-->  report.py  --prompt-->  Gemma (Ollama)
                                                   |
                                                   +--POST ai-summary-->  dashboard

If Gemma is not reachable, slow, or says something empty, the same report is
written from a fixed template instead, so the demo never depends on it. Every
line says which one wrote it ("Gemma:" or "Template:").

Run (gateway already running; Ollama with `ollama pull gemma3:1b` for Gemma):
    python3 gemma/report.py
Settings (environment, all optional):
    GATEWAY   http://localhost:8000      Pietro's gateway
    OLLAMA    http://localhost:11434     where Gemma runs (can be a board's IP)
    MODEL     gemma3:1b
    EVERY     10        seconds between reports (only sent when something changed)
    NO_GEMMA  1         template only
Needs only the standard library plus `websockets` (already in the gateway venv).
"""
import json
import os
import time
import urllib.request

from websockets.sync.client import connect

GATEWAY = os.environ.get("GATEWAY", "http://localhost:8000").rstrip("/")
OLLAMA = os.environ.get("OLLAMA", "http://localhost:11434").rstrip("/")
MODEL = os.environ.get("MODEL", "gemma3:1b")
EVERY = float(os.environ.get("EVERY", 10))
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


def gemma(nodes, fallback):
    prompt = (
        "You write the status line of a wildfire sensor network for people with no "
        "technical background. Use ONLY the facts below, do not invent numbers or places. "
        "At most two short sentences: what is happening, and where people should move.\n\n"
        "Facts from the network:\n%s\n\nA correct but robotic version: %s\n\nStatus line:"
        % (facts(nodes), fallback))
    body = json.dumps({"model": MODEL, "prompt": prompt, "stream": False,
                       "options": {"temperature": 0.2, "num_predict": 70}}).encode()
    req = urllib.request.Request(OLLAMA + "/api/generate", body,
                                 {"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = json.loads(r.read()).get("response", "").strip().strip('"')
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
                who = "Template"
                if not NO_GEMMA:
                    t0 = time.time()
                    try:
                        g = gemma(nodes, text)
                        if g:
                            text, who = g, "Gemma"
                    except Exception as e:      # no Ollama, timeout, bad answer: template
                        print("   (Gemma unavailable: %s)" % e, flush=True)
                    print("   (%.1fs)" % (time.time() - t0), flush=True)
                line = "%s: %s" % (who, text)
                print(time.strftime("%H:%M:%S"), env_id, line, flush=True)
                send(env_id, line)


if __name__ == "__main__":
    main()
