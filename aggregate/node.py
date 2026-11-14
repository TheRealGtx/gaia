import socket, json, time, threading, os

NODE_ID   = int(os.environ.get("NODE_ID", 1))
NEIGHBORS = set(int(x) for x in os.environ.get("NEIGHBORS", "2").split(","))
PORT, TIMEOUT = 5005, 4
ALERT_ON, ALERT_OFF = 0.7, 0.4

state = {"anomaly": 0.0, "dist": 99, "alert": False}
params = {"mu": 0.0, "sigma": 1.0}        # filled by Chuqi's model
table = {}                                  # neighbour id -> (message, last_seen)
lock = threading.Lock()

def send_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    while True:
        with lock:
            msg = {"id": NODE_ID, **state, **params, "ts": time.time()}
        s.sendto(json.dumps(msg).encode(), ("255.255.255.255", PORT))
        time.sleep(1)

def recv_loop():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("", PORT))
    while True:
        data, _ = s.recvfrom(2048)
        try:
            m = json.loads(data)
        except ValueError:
            continue
        if m.get("id") in NEIGHBORS:
            with lock:
                table[m["id"]] = (m, time.time())

def alive():
    now = time.time()
    with lock:
        return [m for m, t in table.values() if now - t < TIMEOUT]

def update():
    nb = alive()
    # gradient
    if state["anomaly"] > ALERT_ON:
        state["dist"] = 0
    else:
        state["dist"] = min([m["dist"] for m in nb], default=98) + 1
        state["dist"] = min(state["dist"], 99)
    # consensus with hysteresis
    agreeing = sum(1 for m in nb if m["anomaly"] > ALERT_ON)
    if state["anomaly"] > ALERT_ON and agreeing >= 1:
        state["alert"] = True
    elif state["anomaly"] < ALERT_OFF and agreeing == 0:
        state["alert"] = False

if __name__ == "__main__":
    threading.Thread(target=send_loop, daemon=True).start()
    threading.Thread(target=recv_loop, daemon=True).start()
    while True:
        # TODO: state["anomaly"] = anomaly_score(read_sensor())   (Chuqi)
        update()
        time.sleep(0.5)