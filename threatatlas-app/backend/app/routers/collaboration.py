"""Real-time collaboration presence via WebSocket.

Each diagram room tracks connected users. Messages:
  server → client:
    {type: "room_state", users: [...]}
    {type: "user_joined", user: {...}}
    {type: "user_left",   user: {...}}
    {type: "diagram_updated", user_name: str, user_id: int}
    {type: "error", message: str}
  client → server:
    {type: "diagram_saved"}   → broadcast diagram_updated to other users
    (all other types silently ignored)
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token
from app.database import SessionLocal
from app.models import User
from app.models.api_token import ApiToken

logger = logging.getLogger(__name__)

router = APIRouter(tags=["collaboration"])

# ── colour palette ────────────────────────────────────────────────────────────

PALETTE = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ef4444",
    "#14b8a6",
]


def _color_for(user_id: int) -> str:
    return PALETTE[user_id % len(PALETTE)]


# ── connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        # diagram_id → list of {ws, user_id, user_name, color}
        self.rooms: dict[int, list[dict]] = {}

    async def connect(
        self,
        diagram_id: int,
        ws: WebSocket,
        user_id: int,
        user_name: str,
        color: str,
    ) -> None:
        if diagram_id not in self.rooms:
            self.rooms[diagram_id] = []
        self.rooms[diagram_id].append(
            {"ws": ws, "user_id": user_id, "user_name": user_name, "color": color}
        )

    async def disconnect(self, diagram_id: int, ws: WebSocket) -> dict | None:
        """Remove ws from room. Returns the removed user entry or None."""
        if diagram_id not in self.rooms:
            return None
        room = self.rooms[diagram_id]
        entry = next((e for e in room if e["ws"] is ws), None)
        if entry:
            room.remove(entry)
        if not room:
            del self.rooms[diagram_id]
        return entry

    def get_users(self, diagram_id: int) -> list[dict]:
        return [
            {"user_id": e["user_id"], "user_name": e["user_name"], "color": e["color"]}
            for e in self.rooms.get(diagram_id, [])
        ]

    async def broadcast(
        self,
        diagram_id: int,
        message: dict,
        exclude_ws: WebSocket | None = None,
    ) -> None:
        for entry in list(self.rooms.get(diagram_id, [])):
            if entry["ws"] is exclude_ws:
                continue
            try:
                await entry["ws"].send_json(message)
            except Exception as e:
                logger.debug("broadcast send error for user %s: %s", entry.get("user_id"), e)


manager = ConnectionManager()


# ── auth helper ───────────────────────────────────────────────────────────────

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _authenticate(token: str, db: Session) -> User | None:
    """Return User if token is valid JWT or API token, else None."""
    # Try JWT first
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is not None:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user and user.is_active:
                return user
    except (JWTError, ValueError):
        pass

    # Fall back to long-lived API token
    if token.startswith("ta_"):
        token_row = (
            db.query(ApiToken)
            .filter(ApiToken.token_hash == _hash_token(token))
            .first()
        )
        if token_row is None:
            return None
        if token_row.expires_at and token_row.expires_at < datetime.now(timezone.utc):
            return None
        user = db.query(User).filter(User.id == token_row.user_id).first()
        if user and user.is_active:
            # best-effort stamp
            try:
                token_row.last_used_at = datetime.now(timezone.utc)
                db.commit()
            except Exception:
                db.rollback()
            return user

    return None


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/diagrams/{diagram_id}")
async def diagram_presence(websocket: WebSocket, diagram_id: int) -> None:
    await websocket.accept()

    token = websocket.query_params.get("token", "")
    db = SessionLocal()
    try:
        user = _authenticate(token, db)
    finally:
        db.close()

    if user is None:
        await websocket.send_json({"type": "error", "message": "unauthorized"})
        await websocket.close(code=4401)
        return

    # Verify the user can actually access this diagram
    db2 = SessionLocal()
    try:
        from app.models import Diagram as DiagramModel
        from app.auth.permissions import can_access_product
        diagram = db2.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
        if diagram is None or not can_access_product(user, diagram.product):
            await websocket.send_json({"type": "error", "message": "forbidden"})
            await websocket.close(code=4403)
            return
    finally:
        db2.close()

    user_id: int = user.id
    user_name: str = user.username or user.email
    color: str = _color_for(user_id)

    await manager.connect(diagram_id, websocket, user_id, user_name, color)

    # 1. Tell the new client who is already in the room (including themselves)
    await websocket.send_json(
        {"type": "room_state", "users": manager.get_users(diagram_id)}
    )

    # 2. Tell everyone else that this user joined
    await manager.broadcast(
        diagram_id,
        {"type": "user_joined", "user": {"user_id": user_id, "user_name": user_name, "color": color}},
        exclude_ws=websocket,
    )

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                # Client disconnected cleanly — exit the loop
                raise
            except Exception:
                # Non-JSON frame or protocol error — skip silently
                continue
            msg_type = data.get("type")

            if msg_type == "diagram_saved":
                await manager.broadcast(
                    diagram_id,
                    {"type": "diagram_updated", "user_name": user_name, "user_id": user_id},
                    exclude_ws=websocket,
                )
            elif msg_type == "cursor_move":
                await manager.broadcast(
                    diagram_id,
                    {
                        "type": "cursor_update",
                        "user_id": user_id,
                        "user_name": user_name,
                        "color": color,
                        "x": data.get("x", 0),
                        "y": data.get("y", 0),
                    },
                    exclude_ws=websocket,
                )
            elif msg_type == "diagram_sync":
                # Relay current diagram state to all other users in the room
                await manager.broadcast(
                    diagram_id,
                    {
                        "type": "diagram_sync",
                        "user_id": user_id,
                        "user_name": user_name,
                        "nodes": data.get("nodes", []),
                        "edges": data.get("edges", []),
                    },
                    exclude_ws=websocket,
                )
            elif msg_type == "node_op":
                # Granular live-edit op (add / move / update / delete a single
                # element) relayed to other clients so changes appear immediately,
                # without re-sending the whole canvas. The "op" and "element"
                # payload are passed through verbatim for the client to apply.
                op = data.get("op")
                if op in ("add", "move", "update", "delete"):
                    await manager.broadcast(
                        diagram_id,
                        {
                            "type": "node_op",
                            "user_id": user_id,
                            "user_name": user_name,
                            "op": op,
                            "element_type": data.get("element_type", "node"),
                            "element": data.get("element"),
                        },
                        exclude_ws=websocket,
                    )
            # All other message types are silently ignored

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket error for user %s on diagram %s: %s", user_id, diagram_id, exc)
    finally:
        entry = await manager.disconnect(diagram_id, websocket)
        if entry:
            await manager.broadcast(
                diagram_id,
                {"type": "user_left", "user": {"user_id": user_id, "user_name": user_name, "color": color}},
            )
