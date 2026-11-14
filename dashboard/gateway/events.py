from __future__ import annotations

from datetime import datetime
from typing import Any

from .protocol import UdpNodePacket
from .store import GatewayStore


def apply_udp_packet(
    store: GatewayStore,
    packet: UdpNodePacket,
    received_at: datetime,
) -> dict[str, Any] | None:
    sensor = store.update_udp_packet(packet, received_at)
    return store.snapshot() if sensor is not None else None
