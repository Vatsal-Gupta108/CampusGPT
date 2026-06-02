import os
from typing import Any, Dict, List, Optional

from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings
from app.core.config import settings

def get_embedding_model():
    """
    Returns the appropriate embedding model based on configuration.
    Uses HuggingFace (local) by default.
    """
    if settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        return OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)
    
    # Default to local sentence-transformers
    return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def get_vector_store():
    """
    Initializes and returns the ChromaDB vector store.
    """
    embeddings = get_embedding_model()
    
    # Create the directory if it doesn't exist
    os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
    
    vector_store = Chroma(
        collection_name="knowledge_base",
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PERSIST_DIRECTORY
    )
    return vector_store

def add_documents_to_store(chunks):
    """
    Add document chunks to the vector store.
    """
    vector_store = get_vector_store()
    vector_store.add_documents(documents=chunks)

def delete_document_from_store(document_id: int):
    """
    Delete all chunks associated with a specific document ID.
    We filter by the metadata 'document_id'.
    """
    vector_store = get_vector_store()
    # Note: ChromaDB deletion by metadata can be tricky depending on version.
    # Usually we get the ids first, then delete.
    collection = vector_store._collection
    results = collection.get(where={"document_id": document_id})
    if results and results["ids"]:
        collection.delete(ids=results["ids"])


def search_chunks(
    query: str,
    owner_id: int,
    k: int = 8,
    min_score: Optional[float] = None,
    metadata_filter: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Run semantic search and return normalized payloads with score + metadata.

    Always uses similarity_search_with_score (raw L2 distances) and converts
    to [0, 1] relevance via  score = 1 / (1 + distance).  This avoids the
    negative-relevance bug in LangChain's Chroma relevance_score_fn when
    the default L2 distance metric is used.
    """
    vector_store = get_vector_store()
    combined_filter: Dict[str, Any] = {"owner_id": owner_id}
    if metadata_filter:
        combined_filter.update(metadata_filter)

    # Always use raw distance scores — they are non-negative for L2/cosine.
    raw_pairs = vector_store.similarity_search_with_score(
        query=query,
        k=k,
        filter=combined_filter,
    )

    # Convert L2 distances into [0, 1] relevance scores.
    pairs = []
    for doc, distance in raw_pairs:
        score = 1.0 / (1.0 + float(distance))
        pairs.append((doc, score))

    normalized = []
    for doc, score in pairs:
        if score < 0:
            score = 0.0
        if score > 1:
            score = 1.0

        if min_score is not None and score < min_score:
            continue

        normalized.append(
            {
                "content": doc.page_content,
                "score": round(score, 4),
                "metadata": doc.metadata or {},
            }
        )

    return normalized
