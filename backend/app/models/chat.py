from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True) # Store array of citations used
    feedback = Column(String, nullable=True) # Store 'thumbs_up', 'thumbs_down', or None
    reasoning = Column(Text, nullable=True) # Store thinking process separately
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")
