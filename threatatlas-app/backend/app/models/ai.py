from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, LargeBinary, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class AIConfig(Base):
    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False)          # openai | anthropic | openai_compatible
    model_name = Column(String(100), nullable=False)       # e.g. gpt-4o
    api_key_encrypted = Column(LargeBinary, nullable=False)
    base_url = Column(String(500), nullable=True)          # for openai_compatible providers
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4096)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.id")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)       # user | assistant
    content = Column(Text, nullable=False)
    proposals = Column(JSON, nullable=True)          # list of proposal dicts
    token_count = Column(Integer, nullable=True)     # legacy total; prefer input_tokens + output_tokens
    input_tokens = Column(Integer, nullable=True)    # request tokens (prompt + history)
    output_tokens = Column(Integer, nullable=True)   # completion tokens
    ai_model_name = Column(String(100), nullable=True)   # model used for this message
    ai_provider = Column(String(50), nullable=True)      # provider used for this message
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("AIConversation", back_populates="messages")
