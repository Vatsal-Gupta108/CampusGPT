import os
from typing import Dict, List, Optional
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def process_uploaded_file(
    file_path: str,
    filename: str,
    document_id: int,
    extra_metadata: Optional[Dict] = None
) -> List[Document]:
    """
    Load a file, extract text, and split it into chunks suitable for RAG.
    """
    loader = None
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
    elif ext in [".docx", ".doc"]:
        loader = Docx2txtLoader(file_path)
    elif ext == ".txt":
        loader = TextLoader(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")
    
    # Load the raw documents
    raw_docs = loader.load()
    
    # Split long documents into overlapping chunks so retrieval keeps local context
    # Overlap helps preserve context across chunk boundaries, ensuring the LLM
    # has complete sentences and paragraphs to work with.
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )
    
    chunks = text_splitter.split_documents(raw_docs)
    
    # Add metadata to each chunk
    for chunk in chunks:
        chunk.metadata["document_id"] = document_id
        chunk.metadata["filename"] = filename
        if extra_metadata:
            chunk.metadata.update(extra_metadata)
        
    return chunks
