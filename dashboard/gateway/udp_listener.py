from __future__ import annotations

import socket
from datetime import datetime, timezone
from threading import Event, Thread
from typing import Callable, Any

from .protocol import MAX_DATAGRAM_SIZE, UdpNodePacket, parse_udp_packet

PacketCallback = Callable[[UdpNodePacket, datetime], object]


class UdpListener:
    def __init__(
        self,
        host: str,
        port: int,
        on_packet: PacketCallback,
        socket_factory: Callable[..., Any] = socket.socket,
    ) -> None:
        self.host = host
        self.port = port
        self.on_packet = on_packet
        self._socket_factory = socket_factory
        self._socket: socket.socket | None = None
        self._thread: Thread | None = None
        self._stopped = Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stopped.clear()
        receiver = self._socket_factory(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            receiver.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            receiver.bind((self.host, self.port))
        except Exception:
            receiver.close()
            raise
        receiver.settimeout(0.2)
        self.port = receiver.getsockname()[1]
        self._socket = receiver
        self._thread = Thread(target=self._receive_loop, name="gaia-udp-listener", daemon=True)
        self._thread.start()

    def process_datagram(self, data: bytes, received_at: datetime | None = None) -> bool:
        try:
            packet = parse_udp_packet(data)
        except (ValueError, UnicodeError):
            return False
        self.on_packet(packet, received_at or datetime.now(timezone.utc))
        return True

    def stop(self) -> None:
        self._stopped.set()
        if self._socket:
            self._socket.close()
        if self._thread:
            self._thread.join(timeout=1)
        self._socket = None
        self._thread = None

    def _receive_loop(self) -> None:
        while not self._stopped.is_set():
            try:
                if self._socket is None:
                    return
                data, _ = self._socket.recvfrom(MAX_DATAGRAM_SIZE + 1)
                self.process_datagram(data)
            except (OSError, socket.timeout):
                if self._stopped.is_set():
                    return
