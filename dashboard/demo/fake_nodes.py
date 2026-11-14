#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import socket
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

PARAM_EVERY_HEARTBEATS = 15
SCENARIOS_PATH = Path(__file__).with_name("scenarios.json")


@lru_cache(maxsize=1)
def load_scenarios() -> dict[str, Any]:
    scenarios = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    if not isinstance(scenarios, dict):
        raise ValueError("scenarios.json must contain an object")
    return scenarios


def build_packets(scenario: str, heartbeat: int, timestamp: float) -> list[dict[str, Any]]:
    if heartbeat < 0:
        raise ValueError("heartbeat must be non-negative")
    scenarios = load_scenarios()
    if scenario not in scenarios:
        raise ValueError(f"unknown scenario: {scenario}")
    definition = scenarios[scenario]
    silent = set(definition.get("silent", []))
    include_parameters = heartbeat % PARAM_EVERY_HEARTBEATS == 0
    bytes_sent = ((heartbeat + PARAM_EVERY_HEARTBEATS - 1) // PARAM_EVERY_HEARTBEATS) * 34
    packets: list[dict[str, Any]] = []
    for raw_node_id, state in sorted(definition["nodes"].items(), key=lambda item: int(item[0])):
        node_id = int(raw_node_id)
        if node_id in silent:
            continue
        packet = {
            "id": node_id,
            **state,
            "simulated": True,
            "bytes_sent": bytes_sent,
            "bytes_if_raw_data": (heartbeat + 1) * 41,
            "ts": timestamp,
        }
        if include_parameters:
            packet.update({
                "mu": round(20.0 + node_id * 0.4, 1),
                "sigma": 1.0,
                "n": min(300, heartbeat + 1),
            })
        packets.append(packet)
    return packets


def main() -> None:
    parser = argparse.ArgumentParser(description="Send deterministic Gaia UDP demo heartbeats")
    parser.add_argument("--scenario", choices=sorted(load_scenarios()), default="nominal")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument("--interval", type=float, default=1.0)
    parser.add_argument("--count", type=int, default=0, help="heartbeats to send; 0 runs until interrupted")
    args = parser.parse_args()
    if args.interval <= 0 or args.count < 0:
        parser.error("interval must be positive and count must be non-negative")

    sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sender.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    next_send = time.monotonic()
    heartbeat = 0
    try:
        while args.count == 0 or heartbeat < args.count:
            timestamp = time.time()
            for packet in build_packets(args.scenario, heartbeat, timestamp):
                sender.sendto(json.dumps(packet, separators=(",", ":")).encode(), (args.host, args.port))
            heartbeat += 1
            next_send += args.interval
            time.sleep(max(0.0, next_send - time.monotonic()))
    except KeyboardInterrupt:
        pass
    finally:
        sender.close()


if __name__ == "__main__":
    main()
