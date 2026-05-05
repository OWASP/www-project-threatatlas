"""SCIM 2.0 endpoints (RFC 7643 / 7644) for inbound user/group provisioning.

Implements the subset required by EntraID, Okta, and the
`scim-for-keycloak` extension: discovery endpoints, Users and Groups CRUD,
PATCH (replace/add/remove operations, including member mutations via
`members[value eq "..."]` path filters), and a minimal filter parser for
`GET` lists (`userName eq "..."`, `displayName eq "..."`, `externalId eq "..."`).
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, ScimToken, User as UserModel
from app.auth.scim_auth import verify_scim_token


class ScimError(Exception):
    def __init__(self, detail: str, status_code: int, scim_type: str | None = None):
        self.detail = detail
        self.status_code = status_code
        self.scim_type = scim_type

    def body(self) -> dict:
        payload: dict = {"schemas": [ERROR_SCHEMA], "detail": self.detail, "status": str(self.status_code)}
        if self.scim_type:
            payload["scimType"] = self.scim_type
        return payload

router = APIRouter(prefix="/scim/v2", tags=["scim"])


USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User"
GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group"
PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp"
LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error"


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def _location(request: Request, path: str) -> str:
    return str(request.url_for(path)) if False else f"{request.base_url}scim/v2{path}".rstrip("/")


def user_to_scim(user: UserModel, request: Request) -> dict[str, Any]:
    emails = [{"value": user.email, "primary": True, "type": "work"}] if user.email else []
    return {
        "schemas": [USER_SCHEMA],
        "id": str(user.id),
        "externalId": user.scim_external_id,
        "userName": user.username,
        "name": {"formatted": user.full_name or user.username},
        "displayName": user.full_name or user.username,
        "emails": emails,
        "active": bool(user.is_active),
        "groups": [
            {"value": str(g.id), "display": g.name, "$ref": f"{request.base_url}scim/v2/Groups/{g.id}"}
            for g in (user.groups or [])
        ],
        "meta": {
            "resourceType": "User",
            "location": f"{request.base_url}scim/v2/Users/{user.id}",
            "created": user.created_at.isoformat() if user.created_at else None,
            "lastModified": user.updated_at.isoformat() if user.updated_at else None,
        },
    }


def group_to_scim(group: Group, request: Request) -> dict[str, Any]:
    return {
        "schemas": [GROUP_SCHEMA],
        "id": str(group.id),
        "externalId": group.scim_external_id,
        "displayName": group.name,
        "members": [
            {"value": str(m.id), "display": m.username, "$ref": f"{request.base_url}scim/v2/Users/{m.id}"}
            for m in (group.members or [])
        ],
        "meta": {
            "resourceType": "Group",
            "location": f"{request.base_url}scim/v2/Groups/{group.id}",
            "created": group.created_at.isoformat() if group.created_at else None,
            "lastModified": group.updated_at.isoformat() if group.updated_at else None,
        },
    }


def scim_error(detail: str, code: int, scim_type: str | None = None) -> ScimError:
    return ScimError(detail, code, scim_type)


# ---------------------------------------------------------------------------
# Tiny filter parser for list endpoints — covers `<attr> eq "<value>"`.
# ---------------------------------------------------------------------------

_FILTER_RE = re.compile(r'^\s*(\w+)\s+eq\s+"(.*)"\s*$')


def apply_filter(query, model, attr_map: dict[str, Any], filter_str: str | None):
    if not filter_str:
        return query
    m = _FILTER_RE.match(filter_str)
    if not m:
        raise scim_error(f"Unsupported filter expression: {filter_str}", 400, "invalidFilter")
    attr, value = m.group(1), m.group(2)
    column = attr_map.get(attr)
    if column is None:
        raise scim_error(f"Unknown filter attribute: {attr}", 400, "invalidFilter")
    return query.filter(column == value)


# ---------------------------------------------------------------------------
# Discovery endpoints
# ---------------------------------------------------------------------------


@router.get("/ServiceProviderConfig", dependencies=[Depends(verify_scim_token)])
def service_provider_config():
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 200},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [
            {
                "name": "OAuth Bearer Token",
                "description": "Authentication via OAuth 2.0 bearer token",
                "specUri": "https://www.rfc-editor.org/info/rfc6750",
                "type": "oauthbearertoken",
                "primary": True,
            }
        ],
    }


@router.get("/ResourceTypes", dependencies=[Depends(verify_scim_token)])
def resource_types(request: Request):
    base = f"{request.base_url}scim/v2"
    return {
        "schemas": [LIST_SCHEMA],
        "totalResults": 2,
        "Resources": [
            {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                "id": "User",
                "name": "User",
                "endpoint": "/Users",
                "schema": USER_SCHEMA,
                "meta": {"location": f"{base}/ResourceTypes/User", "resourceType": "ResourceType"},
            },
            {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                "id": "Group",
                "name": "Group",
                "endpoint": "/Groups",
                "schema": GROUP_SCHEMA,
                "meta": {"location": f"{base}/ResourceTypes/Group", "resourceType": "ResourceType"},
            },
        ],
    }


@router.get("/Schemas", dependencies=[Depends(verify_scim_token)])
def schemas():
    # Minimal schemas list — IdPs fetch this to learn what attributes exist.
    user_attrs = [
        {"name": "userName", "type": "string", "required": True, "uniqueness": "server"},
        {"name": "displayName", "type": "string"},
        {"name": "active", "type": "boolean"},
        {"name": "emails", "type": "complex", "multiValued": True},
        {"name": "name", "type": "complex"},
        {"name": "externalId", "type": "string"},
        {"name": "groups", "type": "complex", "multiValued": True, "mutability": "readOnly"},
    ]
    group_attrs = [
        {"name": "displayName", "type": "string", "required": True},
        {"name": "members", "type": "complex", "multiValued": True},
        {"name": "externalId", "type": "string"},
    ]
    return {
        "schemas": [LIST_SCHEMA],
        "totalResults": 2,
        "Resources": [
            {"id": USER_SCHEMA, "name": "User", "description": "User account", "attributes": user_attrs},
            {"id": GROUP_SCHEMA, "name": "Group", "description": "Group of users", "attributes": group_attrs},
        ],
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/Users", dependencies=[Depends(verify_scim_token)])
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    startIndex: int = 1,
    count: int = 100,
    filter: str | None = None,
):
    q = db.query(UserModel)
    q = apply_filter(q, UserModel, {"userName": UserModel.username, "externalId": UserModel.scim_external_id, "email": UserModel.email}, filter)
    total = q.count()
    items = q.offset(max(startIndex - 1, 0)).limit(min(count, 200)).all()
    return {
        "schemas": [LIST_SCHEMA],
        "totalResults": total,
        "startIndex": startIndex,
        "itemsPerPage": len(items),
        "Resources": [user_to_scim(u, request) for u in items],
    }


def _apply_user_payload(user: UserModel, payload: dict[str, Any]) -> None:
    if "userName" in payload:
        user.username = payload["userName"]
    if "externalId" in payload:
        user.scim_external_id = payload["externalId"]
    if "active" in payload:
        user.is_active = bool(payload["active"])
    emails = payload.get("emails") or []
    if emails:
        primary = next((e for e in emails if e.get("primary")), emails[0])
        user.email = primary.get("value") or user.email
    name = payload.get("name") or {}
    if "formatted" in name:
        user.full_name = name["formatted"]
    elif "givenName" in name or "familyName" in name:
        user.full_name = " ".join(filter(None, [name.get("givenName"), name.get("familyName")])) or user.full_name
    elif "displayName" in payload:
        user.full_name = payload["displayName"]


@router.post("/Users", dependencies=[Depends(verify_scim_token)], status_code=status.HTTP_201_CREATED)
def create_user(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    username = payload.get("userName")
    if not username:
        raise scim_error("userName is required", 400, "invalidValue")

    # De-dupe by externalId first, then by userName/email.
    existing = None
    ext = payload.get("externalId")
    if ext:
        existing = db.query(UserModel).filter(UserModel.scim_external_id == ext).first()
    if not existing:
        existing = db.query(UserModel).filter(UserModel.username == username).first()
    if existing:
        raise scim_error("User already exists", 409, "uniqueness")

    user = UserModel(username=username, email=username, role="standard", is_active=True, hashed_password=None)
    _apply_user_payload(user, payload)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_scim(user, request)


@router.get("/Users/{user_id}", dependencies=[Depends(verify_scim_token)])
def get_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise scim_error("User not found", 404)
    return user_to_scim(user, request)


@router.put("/Users/{user_id}", dependencies=[Depends(verify_scim_token)])
def replace_user(user_id: int, payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise scim_error("User not found", 404)
    _apply_user_payload(user, payload)
    db.commit()
    db.refresh(user)
    return user_to_scim(user, request)


@router.patch("/Users/{user_id}", dependencies=[Depends(verify_scim_token)])
def patch_user(user_id: int, payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise scim_error("User not found", 404)

    for op in payload.get("Operations", []):
        verb = (op.get("op") or "").lower()
        path = op.get("path")
        value = op.get("value")

        if verb in ("replace", "add") and path is None and isinstance(value, dict):
            _apply_user_payload(user, value)
            continue
        if verb in ("replace", "add") and path == "active":
            user.is_active = bool(value)
        elif verb in ("replace", "add") and path == "userName":
            user.username = value
        elif verb in ("replace", "add") and path == "displayName":
            user.full_name = value
        elif verb in ("replace", "add") and path == "externalId":
            user.scim_external_id = value
        else:
            # Ignore unsupported paths silently — most IdPs send extras the server doesn't model.
            continue

    db.commit()
    db.refresh(user)
    return user_to_scim(user, request)


@router.delete("/Users/{user_id}", dependencies=[Depends(verify_scim_token)], status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise scim_error("User not found", 404)
    db.delete(user)
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------


_MEMBER_FILTER_RE = re.compile(r'members\[\s*value\s+eq\s+"(.*)"\s*\]')


def _resolve_members(db: Session, values: list[dict[str, Any]]) -> list[UserModel]:
    ids: list[int] = []
    for v in values or []:
        raw = v.get("value")
        if raw is None:
            continue
        try:
            ids.append(int(raw))
        except (TypeError, ValueError):
            raise scim_error(f"Invalid member id '{raw}' — user IDs must be integers", 400, "invalidValue")
    if not ids:
        return []
    users = db.query(UserModel).filter(UserModel.id.in_(ids)).all()
    missing = set(ids) - {u.id for u in users}
    if missing:
        raise scim_error(f"Unknown member IDs: {sorted(missing)}", 400, "invalidValue")
    return users


@router.get("/Groups", dependencies=[Depends(verify_scim_token)])
def list_groups(
    request: Request,
    db: Session = Depends(get_db),
    startIndex: int = 1,
    count: int = 100,
    filter: str | None = None,
):
    q = db.query(Group)
    q = apply_filter(q, Group, {"displayName": Group.name, "externalId": Group.scim_external_id}, filter)
    total = q.count()
    items = q.offset(max(startIndex - 1, 0)).limit(min(count, 200)).all()
    return {
        "schemas": [LIST_SCHEMA],
        "totalResults": total,
        "startIndex": startIndex,
        "itemsPerPage": len(items),
        "Resources": [group_to_scim(g, request) for g in items],
    }


@router.post("/Groups", dependencies=[Depends(verify_scim_token)], status_code=status.HTTP_201_CREATED)
def create_group(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    display = payload.get("displayName")
    if not display:
        raise scim_error("displayName is required", 400, "invalidValue")

    ext = payload.get("externalId")
    if ext and db.query(Group).filter(Group.scim_external_id == ext).first():
        raise scim_error("Group already exists", 409, "uniqueness")
    if db.query(Group).filter(Group.name == display).first():
        raise scim_error("Group already exists", 409, "uniqueness")

    group = Group(name=display, scim_external_id=ext, role="read_only")
    group.members = _resolve_members(db, payload.get("members") or [])
    db.add(group)
    db.commit()
    db.refresh(group)
    return group_to_scim(group, request)


@router.get("/Groups/{group_id}", dependencies=[Depends(verify_scim_token)])
def get_group(group_id: int, request: Request, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise scim_error("Group not found", 404)
    return group_to_scim(group, request)


@router.put("/Groups/{group_id}", dependencies=[Depends(verify_scim_token)])
def replace_group(group_id: int, payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise scim_error("Group not found", 404)
    if "displayName" in payload:
        group.name = payload["displayName"]
    if "externalId" in payload:
        group.scim_external_id = payload["externalId"]
    if "members" in payload:
        group.members = _resolve_members(db, payload.get("members") or [])
    db.commit()
    db.refresh(group)
    return group_to_scim(group, request)


@router.patch("/Groups/{group_id}", dependencies=[Depends(verify_scim_token)])
def patch_group(group_id: int, payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise scim_error("Group not found", 404)

    for op in payload.get("Operations", []):
        verb = (op.get("op") or "").lower()
        path = op.get("path")
        value = op.get("value")

        if verb in ("replace", "add") and path is None and isinstance(value, dict):
            if "displayName" in value:
                group.name = value["displayName"]
            if "externalId" in value:
                group.scim_external_id = value["externalId"]
            if "members" in value:
                if verb == "replace":
                    group.members = _resolve_members(db, value["members"])
                else:
                    for m in _resolve_members(db, value["members"]):
                        if m not in group.members:
                            group.members.append(m)
            continue

        if path == "displayName" and verb in ("replace", "add"):
            group.name = value
        elif path == "externalId" and verb in ("replace", "add"):
            group.scim_external_id = value
        elif path == "members":
            if verb == "replace":
                group.members = _resolve_members(db, value or [])
            elif verb == "add":
                for m in _resolve_members(db, value or []):
                    if m not in group.members:
                        group.members.append(m)
            elif verb == "remove":
                ids_to_remove = {int(v.get("value")) for v in (value or []) if v.get("value")}
                group.members = [u for u in group.members if u.id not in ids_to_remove]
        else:
            # Path can be an expression like `members[value eq "123"]` (Okta/Azure style).
            m = _MEMBER_FILTER_RE.match(path or "")
            if m and verb == "remove":
                uid = int(m.group(1))
                group.members = [u for u in group.members if u.id != uid]
            # Else: ignore unknown path — tolerant behavior to avoid breaking sync.

    db.commit()
    db.refresh(group)
    return group_to_scim(group, request)


@router.delete("/Groups/{group_id}", dependencies=[Depends(verify_scim_token)], status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise scim_error("Group not found", 404)
    db.delete(group)
    db.commit()
    return Response(status_code=204)
