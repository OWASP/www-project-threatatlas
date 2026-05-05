from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


ProductStatus = Literal["design", "development", "testing", "deployment", "production"]


def _empty_to_none(v):
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


class ProductBase(BaseModel):
    """Base schema for Product."""
    name: str
    description: str | None = None
    is_public: bool = False
    status: ProductStatus | None = None
    repository_url: str | None = Field(default=None, max_length=500)
    confluence_url: str | None = Field(default=None, max_length=500)
    application_url: str | None = Field(default=None, max_length=500)
    business_area: str | None = Field(default=None, max_length=200)
    owner_name: str | None = Field(default=None, max_length=200)
    owner_email: EmailStr | None = None

    @field_validator("repository_url", "confluence_url", "application_url", "owner_email", mode="before")
    @classmethod
    def _coerce_empty(cls, v):
        return _empty_to_none(v)


class ProductCreate(ProductBase):
    """Schema for creating a Product."""
    pass


class ProductUpdate(ProductBase):
    """Schema for updating a Product."""
    name: str | None = None
    is_public: bool | None = None


class Product(ProductBase):
    """Schema for Product response."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
