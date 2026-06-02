# CampusGPT

CampusGPT is a production-oriented AI campus knowledge platform for uploading institutional documents, running grounded RAG conversations, and monitoring retrieval quality through an admin control room.

This repo includes:
- `frontend/`: Next.js 16 + TypeScript SaaS interface
- `backend/`: FastAPI + SQLAlchemy + Chroma RAG APIs

## Why This Project Stands Out

- Full multi-user authentication with role-aware admin routes
- Document ingestion pipeline with background indexing
- Semantic chunk retrieval with confidence scoring and fallback behavior
- Citation-rich chat UX with feedback and regeneration
- Admin analytics for failed queries, low-confidence answers, and usage trends

## Product Features

- Auth: signup, login, token-based session, logout flow
- Knowledge ingest: drag-and-drop file uploads (`pdf`, `docx`, `txt`)
- RAG chat: grounded answers with source snippets and relevance scores
- Conversation memory: multi-session history with timestamped messages
- Semantic search filters: document type, document id, tags, upload date range
- Admin controls: user management, analytics, vector cleanup on user deletion

## Architecture Overview

### Frontend (Next.js App Router)

- `src/app/login`, `src/app/signup`: auth entrypoints
- `src/app/chat`: conversational assistant experience
- `src/app/documents`: upload, indexing status, semantic search
- `src/app/admin`: analytics + user operations (admin-only)
- `src/components/protected-shell.tsx`: shared authenticated layout and nav
- `src/lib/api.ts`: typed API client layer

### Backend (FastAPI)

- `app/api/routes/auth.py`: authentication and profile endpoints
- `app/api/routes/documents.py`: upload, list, delete, semantic search
- `app/api/routes/chat.py`: sessions, messages, regenerate, feedback, logging
- `app/api/routes/admin.py`: analytics and admin management
- `app/models/*`: users, documents, chat, query logs
- `app/ai/*`: chunking, retrieval, vector operations, grounded generation

### RAG Pipeline

1. File upload accepted, validated, and queued in a background task.
2. Parser loads content (`PyPDF`, `Docx2txt`, `TextLoader`).
3. `RecursiveCharacterTextSplitter` creates overlapping chunks (`1000/200`).
4. Chunks are enriched with metadata (`owner_id`, `file_type`, `tags`, `category`).
5. Chunks are embedded into Chroma.
6. Query path retrieves top semantic chunks + relevance scores.
7. Prompt template enforces grounded output and explicit uncertainty.
8. Answer + citations + confidence flags are returned and logged.

## Retrieval Guardrails

- Owner-scoped retrieval filter to enforce multi-tenancy boundaries
- Low-confidence detection when relevance is weak
- Explicit fallback answer when context is insufficient
- Query logs for operational visibility and quality tuning

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, Sonner, Lucide
- Backend: FastAPI, SQLAlchemy, Pydantic v2, Python-JOSE, bcrypt
- AI/RAG: LangChain, ChromaDB, HuggingFace embeddings, OpenAI/Gemini/Ollama options
- Storage: SQLite (local default), Chroma persistent store

## Setup

### 1) Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App URLs:
- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`

## Environment Variables

### Backend (`backend/.env`)

```env
PROJECT_NAME=CampusGPT
API_V1_STR=/api/v1
SECRET_KEY=change_this_for_production
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./sql_app.db
LLM_PROVIDER=local
OPENAI_API_KEY=
GOOGLE_API_KEY=
CHROMA_PERSIST_DIRECTORY=./chroma_db
FRONTEND_URL=http://localhost:3000
MAX_UPLOAD_SIZE_MB=25
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Deployment Notes

- Replace SQLite with Postgres in production
- Move background ingestion to a worker queue (Celery/Redis or Dramatiq)
- Add object storage (S3/GCS) for durable source files and reindexing
- Run behind reverse proxy (Nginx/Caddy) with TLS
- Rotate secrets and use managed key vaults

## Screenshots

Add screenshots here after running locally:
- Login and signup experience
- Chat workspace with citations
- Document vault + semantic search
- Admin control room analytics

## Roadmap

- Streaming token responses in chat
- Hybrid retrieval (semantic + BM25)
- Source preview panel with anchor navigation
- Team workspaces and document sharing policies
- Feedback-driven answer reranking loop
