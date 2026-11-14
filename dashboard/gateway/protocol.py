from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MAX_DATAGRAM_SIZE = 4096


@dataclass(frozen=True)
class UdpNodePacket:
    node_id: int
    anomaly: float
    dist: int
    via: int | None
    alert: bool
    escape_to: int | None
    temperature: float | None
    humidity: float | None
    simulated: bool | None
    ts: float
    mu: float | None = None
    sigma: float | None = None
    n: int | None = None
    bytes_sent: int | None = None
    bytes_if_raw_data: int | None = None


@dataclass(frozen=True)
class ManifestNode:
    physical_id: int
    sensor_id: str
    environment_id: str
    name: str
    position: tuple[float, float, float]
    neighbours: tuple[int, ...]


@dataclass(frozen=True)
class NodeManifest:
    nodes: dict[int, ManifestNode]

    def sensor_id(self, physical_id: int | None) -> str | None:
        if physical_id is None:
            return None
        node = self.nodes.get(physical_id)
        return node.sensor_id if node else None


def _number(value: Any, field: str, *, nullable: bool = False) -> float | None:
    if value is None and nullable:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{field} must be a finite number")
    return float(value)


def _integer(value: Any, field: str, *, nullable: bool = False) -> int | None:
    if value is None and nullable:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field} must be an integer")
    return value


def _optional_nonnegative_integer(payload: dict[str, Any], field: str) -> int | None:
    value = _integer(payload.get(field), field, nullable=True)
    if value is not None and value < 0:
        raise ValueError(f"{field} must be non-negative")
    return value


def _optional_model_parameters(payload: dict[str, Any]) -> tuple[float | None, float | None, int | None]:
    fields = ("mu", "sigma", "n")
    if not all(field in payload for field in fields) or any(payload[field] is None for field in fields):
        return None, None, None
    mu = _number(payload["mu"], "mu")
    sigma = _number(payload["sigma"], "sigma")
    n = _integer(payload["n"], "n")
    if n is None or n < 0:
        raise ValueError("n must be non-negative")
    return mu, sigma, n


def parse_udp_packet(data: bytes) -> UdpNodePacket:
    if len(data) > MAX_DATAGRAM_SIZE:
        raise ValueError("UDP datagram exceeds receive limit")
    try:
        payload = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("invalid JSON datagram") from error
    if not isinstance(payload, dict):
        raise ValueError("UDP payload must be an object")

    required = ("id", "anomaly", "dist", "alert", "temperature", "humidity", "ts")
    missing = [field for field in required if field not in payload]
    if missing:
        raise ValueError(f"missing required fields: {', '.join(missing)}")

    node_id = _integer(payload["id"], "id")
    anomaly = _number(payload["anomaly"], "anomaly")
    dist = _integer(payload["dist"], "dist")
    if node_id is None or node_id < 0 or dist is None or dist < 0:
        raise ValueError("id and dist must be non-negative")
    if anomaly is None or not 0 <= anomaly <= 1:
        raise ValueError("anomaly must be between 0 and 1")
    if not isinstance(payload["alert"], bool) or (payload.get("simulated") is not None and not isinstance(payload.get("simulated"), bool)):
        raise ValueError("alert and simulated must be booleans")

    mu, sigma, n = _optional_model_parameters(payload)
    return UdpNodePacket(
        node_id=node_id,
        anomaly=anomaly,
        dist=dist,
        via=_integer(payload.get("via"), "via", nullable=True),
        alert=payload["alert"],
        escape_to=_integer(payload.get("escape_to"), "escape_to", nullable=True),
        temperature=_number(payload["temperature"], "temperature", nullable=True),
        humidity=_number(payload["humidity"], "humidity", nullable=True),
        simulated=payload.get("simulated"),
        ts=_number(payload["ts"], "ts") or 0.0,
        mu=mu,
        sigma=sigma,
        n=n,
        bytes_sent=_optional_nonnegative_integer(payload, "bytes_sent"),
        bytes_if_raw_data=_optional_nonnegative_integer(payload, "bytes_if_raw_data"),
    )


def load_node_manifest(path: str | Path) -> NodeManifest:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("nodes"), dict):
        raise ValueError("manifest must contain a nodes object")
    nodes: dict[int, ManifestNode] = {}
    sensor_ids: set[str] = set()
    for raw_id, raw_node in raw["nodes"].items():
        if not isinstance(raw_node, dict):
            raise ValueError("manifest node must be an object")
        physical_id = int(raw_id)
        sensor_id = raw_node.get("sensor_id")
        position = raw_node.get("position")
        neighbours = raw_node.get("neighbours", [])
        if not isinstance(sensor_id, str) or sensor_id in sensor_ids:
            raise ValueError("sensor ids must be unique strings")
        if not isinstance(position, list) or len(position) != 3:
            raise ValueError("position must have three coordinates")
        parsed_position = tuple(_number(value, "position") for value in position)
        if not isinstance(neighbours, list) or any(isinstance(value, bool) or not isinstance(value, int) for value in neighbours):
            raise ValueError("neighbours must be integer ids")
        environment_id = raw_node.get("environment_id")
        name = raw_node.get("name")
        if not isinstance(environment_id, str) or not isinstance(name, str):
            raise ValueError("environment_id and name must be strings")
        sensor_ids.add(sensor_id)
        nodes[physical_id] = ManifestNode(physical_id, sensor_id, environment_id, name, parsed_position, tuple(neighbours))
    if any(neighbour not in nodes for node in nodes.values() for neighbour in node.neighbours):
        raise ValueError("manifest references an unknown neighbour")
    return NodeManifest(nodes)
