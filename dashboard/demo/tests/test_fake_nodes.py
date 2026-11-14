import unittest

from demo.fake_nodes import PARAM_EVERY_HEARTBEATS, build_packets
from gateway.protocol import parse_udp_packet


class FakeNodeTests(unittest.TestCase):
    def test_model_parameters_are_sent_on_the_first_then_every_fifteenth_heartbeat(self):
        parameter_heartbeats = []
        for heartbeat in range(31):
            node = next(packet for packet in build_packets("nominal", heartbeat, 1000.0 + heartbeat) if packet["id"] == 1)
            model_keys = {key for key in ("mu", "sigma", "n") if key in node}
            if model_keys:
                self.assertEqual(model_keys, {"mu", "sigma", "n"})
                parameter_heartbeats.append(heartbeat)

        self.assertEqual(PARAM_EVERY_HEARTBEATS, 15)
        self.assertEqual(parameter_heartbeats, [0, 15, 30])

    def test_payloads_are_deterministic_and_match_the_gateway_contract(self):
        first = build_packets("nominal", 0, 1000.0)
        self.assertEqual(first, build_packets("nominal", 0, 1000.0))
        self.assertEqual(first[0]["bytes_sent"], 0)
        self.assertGreater(first[0]["bytes_if_raw_data"], 0)
        for payload in first:
            import json
            parse_udp_packet(json.dumps(payload).encode())

    def test_alert_matches_two_adjacent_hot_nodes_reaching_consensus(self):
        alert = {packet["id"]: packet for packet in build_packets("alert", 1, 1001.0)}
        self.assertEqual(list(alert), [1, 2, 3])
        for node_id in (1, 2):
            node = alert[node_id]
            self.assertGreater(node["anomaly"], 0.7)
            self.assertEqual(node["dist"], 0)
            self.assertIsNone(node["via"])
            self.assertTrue(node["alert"])
        # the third board is one hop away from the pair and must not alert
        self.assertEqual(alert[3]["dist"], 1)
        self.assertEqual(alert[3]["via"], 2)
        self.assertFalse(alert[3]["alert"])

    def test_failure_silences_only_one_node_and_rejoin_restores_it(self):
        self.assertEqual([packet["id"] for packet in build_packets("failure", 2, 1002.0)], [1, 3])
        self.assertEqual([packet["id"] for packet in build_packets("rejoin", 3, 1003.0)], [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
