"""Unit tests for the real-time collaboration ConnectionManager
(app/routers/collaboration.py).

The WebSocket endpoint authenticates via its own SessionLocal, which is awkward
to wire to the test transaction; the fan-out logic that actually matters for
real-time correctness lives in ConnectionManager, so we test that directly with
fake async sockets. The manager methods are coroutines, driven here with
asyncio.run() to avoid a pytest-asyncio dependency.
"""

import asyncio

import pytest

from app.routers.collaboration import ConnectionManager, _color_for


class FakeWS:
    """Minimal async stand-in for a Starlette WebSocket."""
    def __init__(self):
        self.sent: list[dict] = []

    async def send_json(self, message: dict) -> None:
        self.sent.append(message)


class DeadWS(FakeWS):
    async def send_json(self, message: dict) -> None:
        raise RuntimeError("connection closed")


def run(coro):
    return asyncio.run(coro)


async def _populate(manager, entries):
    """entries: list of (diagram_id, ws, user_id, name)."""
    for diagram_id, ws, uid, name in entries:
        await manager.connect(diagram_id, ws, uid, name, _color_for(uid))


def test_connect_and_get_users():
    manager = ConnectionManager()
    a, b = FakeWS(), FakeWS()
    run(_populate(manager, [(1, a, 10, "alice"), (1, b, 20, "bob")]))
    users = manager.get_users(1)
    assert {u["user_id"] for u in users} == {10, 20}
    assert {u["user_name"] for u in users} == {"alice", "bob"}


def test_broadcast_reaches_all():
    manager = ConnectionManager()
    a, b = FakeWS(), FakeWS()
    run(_populate(manager, [(1, a, 10, "a"), (1, b, 20, "b")]))
    run(manager.broadcast(1, {"type": "ping"}))
    assert a.sent == [{"type": "ping"}]
    assert b.sent == [{"type": "ping"}]


def test_broadcast_excludes_sender():
    manager = ConnectionManager()
    a, b = FakeWS(), FakeWS()
    run(_populate(manager, [(1, a, 10, "a"), (1, b, 20, "b")]))
    run(manager.broadcast(1, {"type": "node_op", "op": "move"}, exclude_ws=a))
    assert a.sent == []  # sender does not receive its own op
    assert b.sent == [{"type": "node_op", "op": "move"}]


def test_rooms_are_isolated():
    manager = ConnectionManager()
    a, b = FakeWS(), FakeWS()
    run(_populate(manager, [(1, a, 10, "a"), (2, b, 20, "b")]))
    run(manager.broadcast(1, {"type": "x"}))
    assert a.sent == [{"type": "x"}]
    assert b.sent == []  # different diagram room


def test_disconnect_removes_and_cleans_empty_room():
    manager = ConnectionManager()
    a = FakeWS()
    run(_populate(manager, [(1, a, 10, "alice")]))
    entry = run(manager.disconnect(1, a))
    assert entry["user_id"] == 10
    assert manager.get_users(1) == []
    assert 1 not in manager.rooms  # empty room pruned


def test_disconnect_keeps_room_with_remaining_users():
    manager = ConnectionManager()
    a, b = FakeWS(), FakeWS()
    run(_populate(manager, [(1, a, 10, "a"), (1, b, 20, "b")]))
    run(manager.disconnect(1, a))
    assert [u["user_id"] for u in manager.get_users(1)] == [20]


def test_broadcast_survives_a_dead_socket():
    """A failing socket must not stop delivery to healthy peers."""
    manager = ConnectionManager()
    dead, alive = DeadWS(), FakeWS()
    run(_populate(manager, [(1, dead, 10, "a"), (1, alive, 20, "b")]))
    run(manager.broadcast(1, {"type": "node_op"}))  # must not raise
    assert alive.sent == [{"type": "node_op"}]
