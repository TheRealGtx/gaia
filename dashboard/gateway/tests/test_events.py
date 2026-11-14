import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from gateway.events import apply_udp_packet
from gateway.protocol import load_node_manifest, parse_udp_packet
from gateway.store import GatewayStore


MANIFEST = load_node_manifest(Path(__file__).parents[1] / "node_manifest.json")


def packet(node_id, dist):
    return parse_udp_packet(json.dumps({
        "id": node_id, "anomaly": 0.1, "dist": dist, "alert": False,
        "temperature": 22.0, "humidity": 50.0, "ts": 1.0,
    }).encode())


class GatewayEventTests(unittest.TestCase):
    def test_each_udp_update_produces_snapshot_with_current_topology(self):
        store = GatewayStore(manifest=MANIFEST)
        now = datetime(2026, 11, 14, tzinfo=timezone.utc)
        first = apply_udp_packet(store, packet(1, 1), now)
        self.assertEqual(first["type"], "snapshot")
        self.assertFalse(first["environments"]["building-a"]["connections"][0]["active"])

        second = apply_udp_packet(store, packet(2, 2), now)
        link = next(connection for connection in second["environments"]["building-a"]["connections"] if {connection["sourceId"], connection["targetId"]} == {"A-01", "A-02"})
        self.assertTrue(link["active"])


if __name__ == "__main__":
    unittest.main()
