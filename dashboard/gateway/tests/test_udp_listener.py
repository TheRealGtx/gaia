import json
import unittest
from datetime import datetime, timezone

from gateway.udp_listener import UdpListener


def payload(node_id=1):
    return json.dumps({
        "id": node_id, "anomaly": 0.2, "dist": 2, "via": 2, "alert": False,
        "escape_to": 3, "temperature": 23.5, "humidity": 45.0,
        "simulated": False, "ts": 100.0,
    }).encode()


class UdpListenerTests(unittest.TestCase):
    def test_processes_a_valid_datagram_without_a_network_bind(self):
        received = []
        listener = UdpListener("127.0.0.1", 0, lambda packet, _: received.append(packet))
        accepted = listener.process_datagram(payload(), datetime.now(timezone.utc))
        self.assertTrue(accepted)
        self.assertEqual(received[0].node_id, 1)

    def test_malformed_datagram_does_not_block_the_next_valid_datagram(self):
        received = []
        listener = UdpListener("127.0.0.1", 0, lambda packet, _: received.append(packet))
        self.assertFalse(listener.process_datagram(b"not-json", datetime.now(timezone.utc)))
        self.assertTrue(listener.process_datagram(payload(2), datetime.now(timezone.utc)))
        self.assertEqual(received[0].node_id, 2)

    def test_closes_socket_when_bind_is_rejected(self):
        class RejectedSocket:
            closed = False

            def setsockopt(self, *_):
                pass

            def bind(self, *_):
                raise PermissionError("bind rejected")

            def close(self):
                self.closed = True

        rejected = RejectedSocket()
        listener = UdpListener("127.0.0.1", 0, lambda *_: None, socket_factory=lambda *_: rejected)
        with self.assertRaises(PermissionError):
            listener.start()
        self.assertTrue(rejected.closed)


if __name__ == "__main__":
    unittest.main()
