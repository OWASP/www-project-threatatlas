from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Product(Base):
    """Product to be threat modeled."""

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, server_default="false")
    # Optional project metadata — surfaced in the New Product form and details page.
    status = Column(
        ENUM("design", "development", "testing", "deployment", "production", name="productstatus", create_type=False),
        nullable=True,
    )
    repository_url = Column(String(500), nullable=True)
    confluence_url = Column(String(500), nullable=True)
    application_url = Column(String(500), nullable=True)
    business_area = Column(String(200), nullable=True)
    owner_name = Column(String(200), nullable=True)
    owner_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="products")
    diagrams = relationship("Diagram", back_populates="product", cascade="all, delete-orphan")
    collaborators = relationship("ProductCollaborator", back_populates="product", cascade="all, delete-orphan")
