from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: Optional[str] = None
    chunk_count: int
    status: str
    uploaded_at: datetime
    owner_id: int

    class Config:
        from_attributes = True


class DocumentSearchResult(BaseModel):
    document_id: Optional[int] = None
    filename: str
    score: float
    snippet: str
    file_type: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    category: Optional[str] = None
