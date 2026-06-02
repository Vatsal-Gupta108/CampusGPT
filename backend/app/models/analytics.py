from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.db.database import Base


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True, index=True)
    query_text = Column(Text, nullable=False)
    response_time_ms = Column(Float, nullable=False, default=0.0)
    retrieved_chunks = Column(Integer, nullable=False, default=0)
    top_score = Column(Float, nullable=True)
    low_confidence = Column(Boolean, nullable=False, default=False)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
