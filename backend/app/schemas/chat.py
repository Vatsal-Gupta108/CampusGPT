from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any

class ChatMessageBase(BaseModel):
    role: str
    content: str
    citations: Optional[List[Any]] = None
    reasoning: Optional[str] = None

class ChatMessageCreate(BaseModel):
    content: str # Only user creates a message via endpoint


class ChatMessageFeedback(BaseModel):
    feedback: Optional[str] = None

class ChatMessageResponse(ChatMessageBase):
    id: int
    session_id: int
    feedback: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionResponse(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True
