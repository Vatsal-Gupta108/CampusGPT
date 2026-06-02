from collections import Counter
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.vector_store import get_vector_store
from app.api.deps import get_current_active_admin
from app.db.database import get_db
from app.models.analytics import QueryLog
from app.models.chat import ChatMessage, ChatSession
from app.models.document import Document
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/analytics", dependencies=[Depends(get_current_active_admin)])
def get_analytics(db: Session = Depends(get_db)) -> Dict:
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_documents = db.query(func.count(Document.id)).scalar() or 0
    total_chat_sessions = db.query(func.count(ChatSession.id)).scalar() or 0
    total_messages = db.query(func.count(ChatMessage.id)).scalar() or 0

    total_queries = db.query(func.count(QueryLog.id)).scalar() or 0
    failed_queries = db.query(func.count(QueryLog.id)).filter(QueryLog.success.is_(False)).scalar() or 0
    low_confidence_responses = (
        db.query(func.count(QueryLog.id)).filter(QueryLog.low_confidence.is_(True)).scalar() or 0
    )

    avg_latency = db.query(func.avg(QueryLog.response_time_ms)).scalar()
    avg_latency = round(float(avg_latency or 0.0), 2)

    common_queries_rows = (
        db.query(QueryLog.query_text, func.count(QueryLog.id).label("count"))
        .group_by(QueryLog.query_text)
        .order_by(func.count(QueryLog.id).desc())
        .limit(5)
        .all()
    )
    most_common_queries = [{"query": row[0], "count": row[1]} for row in common_queries_rows]

    failed_rows = (
        db.query(QueryLog)
        .filter(QueryLog.success.is_(False))
        .order_by(QueryLog.created_at.desc())
        .limit(10)
        .all()
    )
    failed_query_examples = [
        {
            "query": row.query_text,
            "error": row.error_message,
            "at": row.created_at.isoformat(),
            "user_id": row.user_id,
        }
        for row in failed_rows
    ]

    # Count document mentions in assistant citations so admins can see what users rely on most.
    citation_counter: Counter[str] = Counter()
    cited_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.role == "assistant", ChatMessage.citations.is_not(None))
        .all()
    )
    for msg in cited_messages:
        if not msg.citations:
            continue
        for citation in msg.citations:
            filename = citation.get("filename") if isinstance(citation, dict) else None
            if filename:
                citation_counter[filename] += 1

    popular_documents = [
        {"filename": filename, "mentions": count}
        for filename, count in citation_counter.most_common(5)
    ]

    thumbs_up = db.query(func.count(ChatMessage.id)).filter(ChatMessage.feedback == "thumbs_up").scalar() or 0
    thumbs_down = db.query(func.count(ChatMessage.id)).filter(ChatMessage.feedback == "thumbs_down").scalar() or 0

    recent_activity_rows = (
        db.query(QueryLog)
        .order_by(QueryLog.created_at.desc())
        .limit(20)
        .all()
    )
    system_activity = [
        {
            "query": row.query_text,
            "latency_ms": round(row.response_time_ms, 2),
            "low_confidence": row.low_confidence,
            "success": row.success,
            "at": row.created_at.isoformat(),
        }
        for row in recent_activity_rows
    ]

    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_chat_sessions": total_chat_sessions,
        "total_messages": total_messages,
        "total_queries": total_queries,
        "failed_queries": failed_queries,
        "low_confidence_responses": low_confidence_responses,
        "average_latency_ms": avg_latency,
        "popular_documents": popular_documents,
        "most_common_queries": most_common_queries,
        "failed_query_examples": failed_query_examples,
        "feedback_analytics": {
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
        },
        "system_activity": system_activity,
    }


@router.get("/query-logs", dependencies=[Depends(get_current_active_admin)])
def list_query_logs(db: Session = Depends(get_db)):
    rows = db.query(QueryLog).order_by(QueryLog.created_at.desc()).limit(200).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "session_id": row.session_id,
            "query_text": row.query_text,
            "response_time_ms": row.response_time_ms,
            "retrieved_chunks": row.retrieved_chunks,
            "top_score": row.top_score,
            "low_confidence": row.low_confidence,
            "success": row.success,
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/users", response_model=List[UserResponse], dependencies=[Depends(get_current_active_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/role", dependencies=[Depends(get_current_active_admin)])
def toggle_user_role(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.role = "admin" if db_user.role == "user" else "user"
    db.commit()
    db.refresh(db_user)
    return {"status": "success", "message": f"User role updated to {db_user.role}", "role": db_user.role}


@router.delete("/users/{user_id}", dependencies=[Depends(get_current_active_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        vector_store = get_vector_store()
        collection = vector_store._collection
        results = collection.get(where={"owner_id": user_id})
        if results and results["ids"]:
            collection.delete(ids=results["ids"])
    except Exception as exc:
        print(f"Error removing user data from vector store: {exc}")

    db.delete(db_user)
    db.commit()
    return {"status": "success", "message": "User and all associated data deleted"}
