from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    """Base schema for Product."""
    name: str
    description: str | None = None
    is_public: bool = False


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
