from __future__ import annotations

from datetime import datetime
from typing import Any

from .protocol import UdpNodePacket
from .store import GatewayStore

_unknown_ids: set[int] = set()


def apply_udp_packet(
    store: GatewayStore,
    packet: UdpNodePacket,
    received_at: datetime,
) -> dict[str, Any] | None:
    sensor = store.update_udp_packet(packet, received_at)
    if sensor is None:
        # A board whose id is not in the manifest is simply not on the screen,
        # which looks exactly like a board that is not transmitting. Say it
        # once per id rather than dropping it in silence.
        if packet.node_id not in _unknown_ids:
            _unknown_ids.add(packet.node_id)
            print("gaia gateway: node %d is not in the manifest, ignoring it"
                  % packet.node_id, flush=True)
        return None
    return store.snapshot()
