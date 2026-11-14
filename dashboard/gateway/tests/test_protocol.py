import json
import tempfile
import unittest
from pathlib import Path

from gateway.protocol import MAX_DATAGRAM_SIZE, load_node_manifest, parse_udp_packet


CANONICAL = {
    "id": 1, "anomaly": 1.0, "dist": 0, "via": None, "alert": False,
    "escape_to": 2, "mu": 20.0, "sigma": 0.0, "n": 7,
    "temperature": 47.0, "humidity": 22.5, "simulated": True,
    "bytes_sent": 204, "bytes_if_raw_data": 451, "ts": 1794648860.83,
}


class UdpProtocolTests(unittest.TestCase):
    def test_canonical_packet_preserves_nullable_readings_and_optional_metrics(self):
        packet = parse_udp_packet(json.dumps({**CANONICAL, "future_field": "ignored"}).encode())
        self.assertEqual(packet.node_id, 1)
        self.assertEqual(packet.temperature, 47.0)
        self.assertEqual(packet.humidity, 22.5)
        self.assertEqual(packet.escape_to, 2)
        self.assertEqual(packet.bytes_sent, 204)
        self.assertTrue(packet.simulated)

    def test_optional_routing_parameters_and_counters_may_be_absent(self):
        payload = {key: value for key, value in CANONICAL.items() if key not in {"via", "escape_to", "simulated", "mu", "sigma", "n", "bytes_sent", "bytes_if_raw_data"}}
        packet = parse_udp_packet(json.dumps(payload).encode())
        self.assertIsNone(packet.mu)
        self.assertIsNone(packet.bytes_sent)
        self.assertIsNone(packet.via)
        self.assertIsNone(packet.escape_to)
        self.assertIsNone(packet.simulated)

    def test_partial_model_parameters_are_ignored_without_rejecting_the_packet(self):
        payload = {key: value for key, value in CANONICAL.items() if key not in {"sigma", "n"}}
        packet = parse_udp_packet(json.dumps(payload).encode())

        self.assertIsNone(packet.mu)
        self.assertIsNone(packet.sigma)
        self.assertIsNone(packet.n)
        self.assertEqual(packet.temperature, 47.0)

    def test_null_sensor_values_are_valid(self):
        packet = parse_udp_packet(json.dumps({**CANONICAL, "temperature": None, "humidity": None}).encode())
        self.assertIsNone(packet.temperature)
        self.assertIsNone(packet.humidity)

    def test_rejects_missing_invalid_and_oversized_payloads(self):
        invalid_payloads = [
            {key: value for key, value in CANONICAL.items() if key != "id"},
            {**CANONICAL, "id": True}, {**CANONICAL, "anomaly": 1.1},
            {**CANONICAL, "dist": 1.5}, {**CANONICAL, "alert": 1},
            {**CANONICAL, "ts": float("nan")},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    parse_udp_packet(json.dumps(payload).encode())
        with self.assertRaises(ValueError):
            parse_udp_packet(b"{" + b" " * MAX_DATAGRAM_SIZE + b"}")

    def test_manifest_maps_exactly_the_two_running_physical_nodes(self):
        manifest = load_node_manifest(Path(__file__).parents[1] / "node_manifest.json")
        self.assertEqual(set(manifest.nodes), {1, 2})
        self.assertEqual([manifest.nodes[node_id].sensor_id for node_id in (1, 2)], ["A-01", "A-02"])

    def test_manifest_rejects_duplicate_sensor_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text(json.dumps({"nodes": {"1": {"sensor_id": "A-01", "environment_id": "building-a", "name": "one", "position": [0, 0, 0], "neighbours": []}, "2": {"sensor_id": "A-01", "environment_id": "building-a", "name": "two", "position": [1, 0, 0], "neighbours": []}}}))
            with self.assertRaises(ValueError):
                load_node_manifest(path)


if __name__ == "__main__":
    unittest.main()
