from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Role = Literal["admin", "standard", "read_only"]


class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)
    role: Role


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)
    role: Role | None = None


class GroupMember(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    username: str
    full_name: str | None = None


class GroupRead(GroupBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scim_external_id: str | None = None
    created_at: datetime


class GroupDetail(GroupRead):
    members: list[GroupMember] = []


class GroupMemberUpdate(BaseModel):
    user_ids: list[int]
