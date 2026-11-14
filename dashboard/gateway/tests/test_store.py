import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from gateway.protocol import load_node_manifest, parse_udp_packet
from gateway.store import GatewayStore

MANIFEST = load_node_manifest(Path(__file__).parents[1] / "node_manifest.json")


def packet(**overrides):
    import json
    payload = {
        "id": 1, "anomaly": 0.2, "dist": 2, "via": 2, "alert": False,
        "escape_to": 3, "mu": 22.0, "sigma": 1.0, "n": 24,
        "temperature": 23.5, "humidity": 45.0, "simulated": False,
        "bytes_sent": 100, "bytes_if_raw_data": 1000, "ts": 100.0,
    }
    payload.update(overrides)
    return parse_udp_packet(json.dumps(payload).encode())


class GatewayStoreTests(unittest.TestCase):
    def test_update_is_present_in_initial_snapshot(self):
        store = GatewayStore()
        store.update_sensor("building-a", "A-01", {"temperature": 24.5, "humidity": 42})
        snapshot = store.snapshot()

        self.assertEqual(snapshot["environments"]["building-a"]["sensors"]["A-01"]["temperature"], 24.5)
        self.assertIn("lastUpdate", snapshot["environments"]["building-a"]["sensors"]["A-01"])

    def test_old_node_is_marked_offline_not_safe(self):
        store = GatewayStore(offline_after_seconds=30)
        old = datetime.now(timezone.utc) - timedelta(seconds=45)
        store.update_sensor("forest-north", "N-02", {"status": "normal"}, received_at=old)

        store.mark_timeouts(now=datetime.now(timezone.utc))
        sensor = store.snapshot()["environments"]["forest-north"]["sensors"]["N-02"]
        self.assertEqual(sensor["status"], "offline")
        self.assertEqual(sensor["connectivity"], "offline")

    def test_udp_packet_is_enriched_from_manifest_and_uses_escape_to(self):
        store = GatewayStore(manifest=MANIFEST, offline_after_seconds=4)
        sensor = store.update_udp_packet(packet(), datetime(2026, 11, 14, tzinfo=timezone.utc))
        self.assertEqual(sensor["id"], "A-01")
        self.assertEqual(sensor["gradientDistance"], 2)
        self.assertEqual(sensor["via"], "A-02")
        self.assertEqual(sensor["escapeTo"], "A-03")
        self.assertEqual(sensor["status"], "normal")
        self.assertEqual(sensor["sourceTimestamp"], 100.0)

    def test_unknown_distance_is_grey_and_never_safe(self):
        store = GatewayStore(manifest=MANIFEST)
        sensor = store.update_udp_packet(packet(dist=99, escape_to=None))
        self.assertEqual(sensor["status"], "unknown")
        self.assertEqual(sensor["connectivity"], "unknown")

    def test_receipt_order_accepts_older_node_clock_after_reboot(self):
        store = GatewayStore(manifest=MANIFEST)
        first = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
        store.update_udp_packet(packet(ts=999999.0, temperature=40.0), first)
        sensor = store.update_udp_packet(packet(ts=1.0, temperature=21.0), first + timedelta(seconds=1))
        self.assertEqual(sensor["temperature"], 21.0)
        self.assertEqual(sensor["sourceTimestamp"], 1.0)

    def test_cadenced_model_values_remain_sticky_when_absent(self):
        store = GatewayStore(manifest=MANIFEST)
        store.update_udp_packet(packet(mu=22.0, sigma=1.0, n=24, bytes_sent=100, bytes_if_raw_data=1000))
        sensor = store.update_udp_packet(packet(mu=None, sigma=None, n=None, bytes_sent=None, bytes_if_raw_data=None, temperature=24.0))
        self.assertEqual(sensor["mu"], 22.0)
        self.assertEqual(sensor["n"], 24)
        self.assertEqual(sensor["bytesSent"], 100)
        self.assertEqual(sensor["temperature"], 24.0)

    def test_udp_node_becomes_offline_after_four_seconds_and_keeps_last_reading(self):
        store = GatewayStore(manifest=MANIFEST, offline_after_seconds=4)
        received = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
        store.update_udp_packet(packet(temperature=31.0), received)
        store.mark_timeouts(received + timedelta(seconds=4))
        sensor = store.snapshot()["environments"]["building-a"]["sensors"]["A-01"]
        self.assertEqual(sensor["status"], "offline")
        self.assertEqual(sensor["temperature"], 31.0)

    def test_unknown_physical_id_is_ignored(self):
        store = GatewayStore(manifest=MANIFEST)
        self.assertIsNone(store.update_udp_packet(packet(id=77)))


if __name__ == "__main__":
    unittest.main()
