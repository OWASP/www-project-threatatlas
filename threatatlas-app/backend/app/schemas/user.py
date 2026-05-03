import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


_PASSWORD_RULES = (
    "Password must be at least 8 characters and include an uppercase letter, "
    "a lowercase letter, a number, and a special character."
)


def _validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError(_PASSWORD_RULES)
    if not re.search(r'[A-Z]', value):
        raise ValueError(_PASSWORD_RULES)
    if not re.search(r'[a-z]', value):
        raise ValueError(_PASSWORD_RULES)
    if not re.search(r'\d', value):
        raise ValueError(_PASSWORD_RULES)
    if not re.search(r'[^A-Za-z0-9]', value):
        raise ValueError(_PASSWORD_RULES)
    return value


class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    username: str
    full_name: str | None = None


class UserCreate(UserBase):
    """Schema for user registration."""
    password: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


class UserCreateByAdmin(UserBase):
    """Schema for admin creating a new user."""
    password: str
    role: Literal['admin', 'standard', 'read_only'] = 'standard'

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    email: EmailStr | None = None
    full_name: str | None = None
    password: str | None = None

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_password(v)
        return v


class AdminUserUpdate(BaseModel):
    """Schema for admin updating any user."""
    email: EmailStr | None = None
    username: str | None = None
    full_name: str | None = None
    password: str | None = None
    role: Literal['admin', 'standard', 'read_only'] | None = None
    is_active: bool | None = None

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_password(v)
        return v


class PasswordChange(BaseModel):
    """Schema for changing password."""
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


class User(UserBase):
    """Schema for user response."""
    id: int
    is_active: bool
    role: Literal['admin', 'standard', 'read_only']
    effective_role: Literal['admin', 'standard', 'read_only']
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserInDB(User):
    """Internal schema including hashed password."""
    hashed_password: str
