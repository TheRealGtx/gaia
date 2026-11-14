from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from typing import Any

from .protocol import NodeManifest, UdpNodePacket


class GatewayStore:
    def __init__(self, offline_after_seconds: int = 4, manifest: NodeManifest | None = None) -> None:
        self.offline_after_seconds = offline_after_seconds
        self.manifest = manifest
        self._environments: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def update_sensor(
        self,
        environment_id: str,
        node_id: str,
        payload: dict[str, Any],
        received_at: datetime | None = None,
    ) -> dict[str, Any]:
        received_at = received_at or datetime.now(timezone.utc)
        reading = {
            **payload,
            "id": node_id,
            "environmentId": environment_id,
            "lastUpdate": received_at.isoformat().replace("+00:00", "Z"),
            "connectivity": payload.get("connectivity", "connected"),
        }
        with self._lock:
            environment = self._environments.setdefault(environment_id, {"sensors": {}})
            environment["sensors"][node_id] = reading
        return deepcopy(reading)

    def update_udp_packet(
        self,
        packet: UdpNodePacket,
        received_at: datetime | None = None,
    ) -> dict[str, Any] | None:
        if self.manifest is None:
            raise ValueError("a node manifest is required for UDP packets")
        manifest_node = self.manifest.nodes.get(packet.node_id)
        if manifest_node is None:
            return None
        received_at = received_at or datetime.now(timezone.utc)
        received_at_iso = received_at.isoformat().replace("+00:00", "Z")
        status = "critical" if packet.alert or packet.dist == 0 else "warning" if packet.dist == 1 else "unknown" if packet.dist >= 99 else "normal"
        connectivity = "unknown" if packet.dist >= 99 else "connected"
        with self._lock:
            environment = self._environments.setdefault(manifest_node.environment_id, {"sensors": {}})
            previous = environment["sensors"].get(manifest_node.sensor_id, {})
            has_model_update = packet.mu is not None and packet.sigma is not None and packet.n is not None
            sticky = {
                "mu": packet.mu if has_model_update else previous.get("mu"),
                "sigma": packet.sigma if has_model_update else previous.get("sigma"),
                "n": packet.n if has_model_update else previous.get("n"),
                "modelUpdatedAt": received_at_iso if has_model_update else previous.get("modelUpdatedAt"),
                "bytesSent": packet.bytes_sent if packet.bytes_sent is not None else previous.get("bytesSent"),
                "bytesIfRawData": packet.bytes_if_raw_data if packet.bytes_if_raw_data is not None else previous.get("bytesIfRawData"),
            }
            reading = {
                "id": manifest_node.sensor_id,
                "physicalId": packet.node_id,
                "environmentId": manifest_node.environment_id,
                "name": manifest_node.name,
                "position": list(manifest_node.position),
                "neighbourIds": [self.manifest.nodes[node_id].sensor_id for node_id in manifest_node.neighbours],
                "temperature": packet.temperature,
                "humidity": packet.humidity,
                "anomalyScore": packet.anomaly,
                "gradientDistance": packet.dist,
                "via": self.manifest.sensor_id(packet.via),
                "escapeTo": self.manifest.sensor_id(packet.escape_to),
                "networkAlert": packet.alert,
                "simulated": packet.simulated,
                "sourceTimestamp": packet.ts,
                "status": status,
                "connectivity": connectivity,
                "lastUpdate": received_at_iso,
                **sticky,
            }
            environment["sensors"][manifest_node.sensor_id] = reading
        return deepcopy(reading)

    def mark_timeouts(self, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or datetime.now(timezone.utc)
        changed: list[dict[str, Any]] = []
        with self._lock:
            for environment in self._environments.values():
                for sensor in environment["sensors"].values():
                    timestamp = datetime.fromisoformat(sensor["lastUpdate"].replace("Z", "+00:00"))
                    if (now - timestamp).total_seconds() >= self.offline_after_seconds and sensor.get("status") != "offline":
                        sensor["status"] = "offline"
                        sensor["connectivity"] = "offline"
                        changed.append(deepcopy(sensor))
        return changed

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            environments = deepcopy(self._environments)
            if self.manifest:
                for environment_id, environment in environments.items():
                    connections: list[dict[str, Any]] = []
                    seen: set[tuple[int, int]] = set()
                    for node in self.manifest.nodes.values():
                        if node.environment_id != environment_id:
                            continue
                        for neighbour_id in node.neighbours:
                            pair = tuple(sorted((node.physical_id, neighbour_id)))
                            if pair in seen:
                                continue
                            seen.add(pair)
                            neighbour = self.manifest.nodes[neighbour_id]
                            connections.append({
                                "sourceId": node.sensor_id,
                                "targetId": neighbour.sensor_id,
                                "active": node.sensor_id in environment["sensors"] and neighbour.sensor_id in environment["sensors"]
                                    and environment["sensors"][node.sensor_id].get("status") != "offline"
                                    and environment["sensors"][neighbour.sensor_id].get("status") != "offline",
                                "strength": 1.0,
                            })
                    environment["connections"] = connections
            return {"type": "snapshot", "environments": environments}
