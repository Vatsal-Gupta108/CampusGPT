from time import perf_counter
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.chat_engine import generate_rag_response
from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.analytics import QueryLog
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageFeedback,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
)

router = APIRouter()


def _persist_query_log(
    db: Session,
    *,
    user_id: int,
    session_id: Optional[int],
    query_text: str,
    elapsed_ms: float,
    retrieved_chunks: int,
    top_score: Optional[float],
    low_confidence: bool,
    success: bool,
    error_message: Optional[str] = None,
):
    log = QueryLog(
        user_id=user_id,
        session_id=session_id,
        query_text=query_text,
        response_time_ms=elapsed_ms,
        retrieved_chunks=retrieved_chunks,
        top_score=top_score,
        low_confidence=low_confidence,
        success=success,
        error_message=error_message,
    )
    db.add(log)
    db.commit()


@router.post("/sessions", response_model=ChatSessionResponse)
def create_chat_session(
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_session = ChatSession(title=session_in.title, user_id=current_user.id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/sessions", response_model=List[ChatSessionResponse])
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def send_message(
    session_id: int,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    user_msg = ChatMessage(session_id=session_id, role="user", content=message_in.content)
    db.add(user_msg)
    db.commit()

    # Fetch recent conversation history for context-aware responses
    recent_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    # Reverse so oldest is first, and exclude the message we just added
    chat_history = [
        {"role": msg.role, "content": msg.content}
        for msg in reversed(recent_messages)
        if msg.id != user_msg.id
    ]

    start = perf_counter()
    success = True
    error_message: Optional[str] = None

    try:
        rag_result = generate_rag_response(
            query=message_in.content,
            user_id=current_user.id,
            chat_history=chat_history,
        )
        ai_content = rag_result["answer"]
        ai_reasoning = rag_result.get("reasoning")
        citations = rag_result["citations"]
        top_score = rag_result.get("confidence")
        low_confidence = bool(rag_result.get("low_confidence"))
        retrieved_chunks = int(rag_result.get("retrieved_chunks", 0))
    except Exception as exc:
        success = False
        error_message = str(exc)
        ai_content = (
            "I hit an issue while processing that question. "
            "Please retry, or upload additional documents if context is missing."
        )
        ai_reasoning = None
        citations = []
        top_score = 0.0
        low_confidence = True
        retrieved_chunks = 0

    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=ai_content,
        citations=citations,
        reasoning=ai_reasoning,
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    elapsed_ms = (perf_counter() - start) * 1000
    _persist_query_log(
        db,
        user_id=current_user.id,
        session_id=session_id,
        query_text=message_in.content,
        elapsed_ms=elapsed_ms,
        retrieved_chunks=retrieved_chunks,
        top_score=top_score,
        low_confidence=low_confidence,
        success=success,
        error_message=error_message,
    )

    return ai_msg


@router.post("/sessions/{session_id}/regenerate", response_model=ChatMessageResponse)
def regenerate_last_answer(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    latest_user_msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.role == "user")
        .order_by(ChatMessage.created_at.desc())
        .first()
    )
    if not latest_user_msg:
        raise HTTPException(status_code=400, detail="No user message available to regenerate.")

    rag_result = generate_rag_response(query=latest_user_msg.content, user_id=current_user.id)
    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=rag_result["answer"],
        citations=rag_result["citations"],
        reasoning=rag_result.get("reasoning"),
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)
    return ai_msg


@router.post("/messages/{message_id}/feedback", response_model=ChatMessageResponse)
def submit_message_feedback(
    message_id: int,
    feedback_in: ChatMessageFeedback,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_msg = (
        db.query(ChatMessage)
        .join(ChatSession)
        .filter(ChatMessage.id == message_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not db_msg:
        raise HTTPException(status_code=404, detail="Message not found")

    feedback_val = feedback_in.feedback
    if feedback_val not in ["thumbs_up", "thumbs_down", None]:
        raise HTTPException(status_code=400, detail="Invalid feedback value")

    db_msg.feedback = feedback_val
    db.commit()
    db.refresh(db_msg)
    return db_msg
