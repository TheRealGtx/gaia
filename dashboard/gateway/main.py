from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .store import GatewayStore
from .protocol import load_node_manifest
from .udp_listener import UdpListener
from .events import apply_udp_packet


manifest_path = Path(os.getenv("GAIA_NODE_MANIFEST", Path(__file__).with_name("node_manifest.json")))
store = GatewayStore(
    offline_after_seconds=int(os.getenv("GAIA_OFFLINE_AFTER_SECONDS", "4")),
    manifest=load_node_manifest(manifest_path),
)
clients: set[WebSocket] = set()


async def broadcast(message: dict[str, Any]) -> None:
    disconnected: list[WebSocket] = []
    for client in clients:
        try:
            await client.send_json(message)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        clients.discard(client)


async def timeout_monitor() -> None:
    while True:
        await asyncio.sleep(1)
        if store.mark_timeouts():
            await broadcast(store.snapshot())


@asynccontextmanager
async def lifespan(_: FastAPI):
    loop = asyncio.get_running_loop()

    def accept_udp(packet, received_at) -> None:
        snapshot = apply_udp_packet(store, packet, received_at)
        if snapshot is not None:
            asyncio.run_coroutine_threadsafe(broadcast(snapshot), loop)

    listener = UdpListener(
        os.getenv("GAIA_UDP_HOST", "0.0.0.0"),
        int(os.getenv("GAIA_UDP_PORT", "5005")),
        accept_udp,
    )
    listener.start()
    task = asyncio.create_task(timeout_monitor())
    try:
        yield
    finally:
        task.cancel()
        listener.stop()


app = FastAPI(title="Gaia Local Gateway", version="0.1.0", lifespan=lifespan)
origins = [origin.strip() for origin in os.getenv("GAIA_ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/environments/{environment_id}/nodes/{node_id}")
async def node_update(environment_id: str, node_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    sensor = store.update_sensor(environment_id, node_id, payload)
    event = {"type": "sensor-reading", "environmentId": environment_id, "sensor": sensor}
    await broadcast(event)
    return event


@app.post("/v1/events")
async def network_event(event: dict[str, Any] = Body(...)) -> dict[str, bool]:
    await broadcast(event)
    return {"accepted": True}


@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.add(websocket)
    await websocket.send_json(store.snapshot())
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "heartbeat":
                await websocket.send_json({"type": "heartbeat", "at": message.get("at")})
    except WebSocketDisconnect:
        clients.discard(websocket)
