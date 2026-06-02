import os
import shutil
import tempfile
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.ai.document_processor import process_uploaded_file
from app.ai.vector_store import add_documents_to_store, delete_document_from_store, search_chunks
from app.api.deps import get_current_user
from app.core.config import settings
from app.db.database import SessionLocal, get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentSearchResult

router = APIRouter()


def _normalize_tags(raw_tags: str) -> List[str]:
    if not raw_tags:
        return []
    return [tag.strip().lower() for tag in raw_tags.split(",") if tag.strip()]


def process_document_background(
    file_path: str,
    document_id: int,
    filename: str,
    tags: List[str],
    category: str,
):
    """
    Parse and embed documents outside the request/response lifecycle.
    We open a fresh DB session here to avoid leaking request-scoped sessions
    into background workers.
    """
    db = SessionLocal()
    try:
        db_doc = db.query(Document).filter(Document.id == document_id).first()
        if not db_doc:
            return

        extra_metadata = {
            "owner_id": db_doc.owner_id,
            "file_type": db_doc.file_type,
            "tags": tags,
            "category": category,
            "uploaded_at": db_doc.uploaded_at.isoformat() if db_doc.uploaded_at else "",
        }

        chunks = process_uploaded_file(
            file_path=file_path,
            filename=filename,
            document_id=document_id,
            extra_metadata=extra_metadata,
        )

        add_documents_to_store(chunks)

        db_doc.status = "ready"
        db_doc.chunk_count = len(chunks)
        db.commit()
    except Exception as exc:
        db_doc = db.query(Document).filter(Document.id == document_id).first()
        if db_doc:
            db_doc.status = "failed"
            db.commit()
        print(f"Error processing document {document_id}: {exc}")
    finally:
        db.close()
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tags: str = Form(default=""),
    category: str = Form(default="General"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".txt", ".docx"]:
        raise HTTPException(status_code=400, detail="Unsupported file format.")

    # Validate file size before expensive parsing/embedding work.
    file.file.seek(0, os.SEEK_END)
    size_bytes = file.file.tell()
    file.file.seek(0)

    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if size_bytes > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB upload limit.",
        )

    db_doc = Document(
        filename=file.filename,
        file_type=ext.lstrip("."),
        owner_id=current_user.id,
        status="processing",
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{db_doc.id}_{file.filename}")
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    parsed_tags = _normalize_tags(tags)
    background_tasks.add_task(
        process_document_background,
        file_path=temp_file_path,
        document_id=db_doc.id,
        filename=file.filename,
        tags=parsed_tags,
        category=category.strip() or "General",
    )

    return db_doc


@router.get("", response_model=List[DocumentResponse])
def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


@router.get("/search", response_model=List[DocumentSearchResult])
def semantic_search(
    query: str,
    file_type: Optional[str] = None,
    document_id: Optional[int] = None,
    tag: Optional[str] = None,
    uploaded_after: Optional[str] = None,
    uploaded_before: Optional[str] = None,
    k: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    docs_query = db.query(Document).filter(Document.owner_id == current_user.id)
    if file_type:
        docs_query = docs_query.filter(Document.file_type == file_type.lower())
    if document_id:
        docs_query = docs_query.filter(Document.id == document_id)

    # Date filtering stays at SQL level to avoid scanning irrelevant doc ids in memory.
    try:
        if uploaded_after:
            docs_query = docs_query.filter(Document.uploaded_at >= datetime.fromisoformat(uploaded_after))
        if uploaded_before:
            docs_query = docs_query.filter(Document.uploaded_at <= datetime.fromisoformat(uploaded_before))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid uploaded_after/uploaded_before date format. Use ISO date.")

    allowed_ids = {doc.id for doc in docs_query.all()}
    if not allowed_ids:
        return []

    search_results = search_chunks(
        query=query,
        owner_id=current_user.id,
        k=min(max(k, 1), 25),
        min_score=0.2,
    )

    tag_norm = tag.strip().lower() if tag else None
    filtered: List[DocumentSearchResult] = []
    for result in search_results:
        metadata = result.get("metadata", {})
        result_doc_id = metadata.get("document_id")
        if result_doc_id not in allowed_ids:
            continue

        tags_list = metadata.get("tags") or []
        if isinstance(tags_list, str):
            tags_list = [tags_list]

        if tag_norm and tag_norm not in [t.lower() for t in tags_list]:
            continue

        filtered.append(
            DocumentSearchResult(
                document_id=result_doc_id,
                filename=metadata.get("filename", "Unknown"),
                score=result.get("score", 0.0),
                snippet=result.get("content", "")[:280],
                file_type=metadata.get("file_type"),
                tags=tags_list,
                category=metadata.get("category"),
            )
        )

    return filtered


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_document_from_store(document_id)
    db.delete(db_doc)
    db.commit()
    return {"status": "success", "message": "Document deleted"}
