import re
from typing import Any, Dict, List, Optional
import urllib.request

from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from app.ai.vector_store import search_chunks
from app.core.config import settings

RAG_PROMPT_TEMPLATE = """
You are CampusGPT, an intelligent academic knowledge assistant.
Answer ONLY from the provided context.

Rules:
1) If context is weak or missing, say you are not fully confident and ask the user to upload or refine sources.
2) Do not invent facts, citations, dates, numbers, or policies.
3) Keep the answer practical, clear, and directly relevant to the question.

Formatting (CRITICAL — follow these strictly):
- Always structure your response using Markdown.
- Use **bold** for key terms and important facts.
- Use bullet points (- or *) for lists of items.
- Use numbered lists (1. 2. 3.) for steps or ordered items.
- Use ### headings to separate major sections in longer answers.
- Use > blockquotes for direct quotes from documents.
- If the user explicitly requests a specific format (e.g. "bullet points", "table", "steps"), follow that format exactly.
- Keep paragraphs short (2-3 sentences max).
- For summaries, always use bullet points unless told otherwise.

Conversation History (use for context on follow-up questions):
{history}

Product Identity & Moat:
If the user asks about your purpose, compared to general AI tools (like ChatGPT or Gemini), or what your "moat" is, answer proudly and highlight these key competitive advantages:
- **Private & Local Security**: CampusGPT processes and indexes files locally; your university's proprietary data and sensitive documents never go to public servers and are never used to train public models.
- **Strict Grounding (No Hallucinations)**: Unlike general LLMs that browse the open web, CampusGPT answers strictly from the official campus files you upload.
- **Direct Citations**: Every answer is tied to a specific document and page relevance block, which can be expanded to verify the exact source.
- **Cost & Infrastructure**: It scales at zero user cost by using open-source models (via local Ollama) or customized APIs.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:
"""


def is_ollama_running() -> bool:
    try:
        with urllib.request.urlopen("http://localhost:11434/", timeout=0.5) as response:
            return response.status == 200
    except Exception:
        return False


def get_llm():
    if settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        return ChatOpenAI(
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY,
            model="gpt-4o-mini",
        )

    if settings.LLM_PROVIDER == "gemini" and settings.GOOGLE_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:
            raise ImportError(
                "Gemini selected but langchain_google_genai is missing. "
                "Install langchain-google-genai or switch LLM_PROVIDER."
            ) from exc

        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0,
            google_api_key=settings.GOOGLE_API_KEY,
        )

    if settings.LLM_PROVIDER == "grok" and settings.XAI_API_KEY:
        return ChatOpenAI(
            temperature=0,
            openai_api_key=settings.XAI_API_KEY,
            base_url="https://api.x.ai/v1",
            model=settings.GROK_MODEL,
        )

    if settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY:
        return ChatOpenAI(
            temperature=0,
            openai_api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
            model=settings.OPENROUTER_MODEL,
            default_headers={
                "HTTP-Referer": "https://github.com/vatsal/campusgpt",
                "X-Title": "CampusGPT",
            },
            model_kwargs={
                "reasoning": {"enabled": True}
            }
        )

    # Local default: OpenAI-compatible endpoint (Ollama)
    return ChatOpenAI(
        temperature=0,
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model="llama3",
        timeout=5.0,
    )


def _build_citations(search_hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    citations: List[Dict[str, Any]] = []
    for hit in search_hits[:6]:
        metadata = hit.get("metadata", {})
        snippet = hit.get("content", "")[:240].strip()
        if len(hit.get("content", "")) > 240:
            snippet += "..."

        citations.append(
            {
                "content": snippet,
                "filename": metadata.get("filename", "Unknown document"),
                "document_id": metadata.get("document_id"),
                "score": hit.get("score", 0.0),
            }
        )
    return citations


def _parse_llm_response(content: Any) -> Dict[str, Optional[str]]:
    """
    Parses LLM response content and splits it into a clean answer string and reasoning trace.
    Returns: {"answer": str, "reasoning": Optional[str]}
    """
    if isinstance(content, str):
        return {"answer": content, "reasoning": None}

    if isinstance(content, list):
        text_parts = []
        reasoning_parts = []
        for item in content:
            if isinstance(item, dict):
                item_type = item.get("type")
                if item_type == "text":
                    val = item.get("text")
                    if val:
                        text_parts.append(val)
                elif item_type == "reasoning":
                    r_content = item.get("content")
                    if isinstance(r_content, list):
                        for rc in r_content:
                            if isinstance(rc, dict) and rc.get("text"):
                                reasoning_parts.append(rc.get("text"))
                    elif isinstance(r_content, str):
                        reasoning_parts.append(r_content)
                    elif item.get("text"):
                        reasoning_parts.append(item.get("text"))
            elif isinstance(item, str):
                text_parts.append(item)

        final_answer = "".join(text_parts)
        reasoning_str = "\n".join(reasoning_parts) if reasoning_parts else None
        return {"answer": final_answer, "reasoning": reasoning_str}

    return {"answer": str(content), "reasoning": None}


# ---------------------------------------------------------------------------
# Greeting detection — fuzzy matching for informal variants
# ---------------------------------------------------------------------------
_GREETING_ROOTS = ["hi", "hey", "hello", "hola", "greetings", "yo", "sup"]

def _is_greeting(query: str) -> bool:
    """
    Returns True for casual greetings including informal variants
    like "hii", "heyyy", "hellooo", "hi there", "hey!".
    """
    # Strip punctuation and extra whitespace, lowercase
    normalized = re.sub(r"[^\w\s]", "", query.lower()).strip()

    # Single-word greetings with possible letter repetitions
    # e.g. "hii", "hiiii", "heyyy", "hellooo", "yooo"
    if len(normalized.split()) <= 2:
        first_word = normalized.split()[0] if normalized.split() else ""
        for root in _GREETING_ROOTS:
            # Check if the word starts with the root and the rest is just
            # repeated last characters (e.g. "hiii" = "hi" + "ii")
            if first_word == root:
                return True
            if len(first_word) > len(root) and first_word.startswith(root):
                # The extra chars should all be the same as the last char of root
                extra = first_word[len(root):]
                if all(c == root[-1] for c in extra):
                    return True

        # Also catch "hi there", "hello there", "hey there"
        if len(normalized.split()) == 2:
            second_word = normalized.split()[1]
            if second_word in {"there", "bot", "assistant", "campusgpt", "buddy"}:
                # Re-check first word against roots
                for root in _GREETING_ROOTS:
                    if first_word == root:
                        return True
                    if len(first_word) > len(root) and first_word.startswith(root):
                        extra = first_word[len(root):]
                        if all(c == root[-1] for c in extra):
                            return True

    return False


def _is_about_app_or_moat(query: str) -> bool:
    q = query.lower()
    keywords = {"moat", "chatgpt", "gpt", "better than", "why use you", "what are you", "who are you", "what is this app", "campusgpt"}
    return any(kw in q for kw in keywords)


def _format_chat_history(chat_history: Optional[List[Dict[str, str]]]) -> str:
    """Format recent chat messages into a string for the prompt."""
    if not chat_history:
        return "(No previous messages in this conversation)"

    lines = []
    for msg in chat_history[-10:]:  # Last 10 messages max
        role = msg.get("role", "user").capitalize()
        content = msg.get("content", "")[:300]  # Truncate long messages
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def generate_rag_response(
    query: str,
    user_id: int,
    chat_history: Optional[List[Dict[str, str]]] = None,
    retrieval_filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Retrieve grounded context, run the LLM, and return answer + citations + confidence flags.
    """
    retrieval_filters = retrieval_filters or {}

    # Check for simple greetings
    if _is_greeting(query):
        return {
            "answer": (
                "Hey there! 👋 I'm **CampusGPT**, your personal academic knowledge assistant.\n\n"
                "Here's what I can help you with:\n\n"
                "- 📄 **Summarise your uploaded documents** — just ask!\n"
                "- 🔍 **Answer specific questions** from your files\n"
                "- 📝 **Extract key points, bullet points, or tables** from your PDFs\n"
                "- 💡 **Compare or analyse** content across multiple documents\n\n"
                "Just type your question, or head to the **Knowledge Vault** to upload files first!"
            ),
            "reasoning": None,
            "citations": [],
            "confidence": 1.0,
            "low_confidence": False,
            "retrieved_chunks": 0,
        }

    # Check if the query is specifically about the app/moat comparison
    is_app_query = _is_about_app_or_moat(query)

    if is_app_query:
        context_text = "Topic: CampusGPT product identity, privacy advantages, and competitive moat compared to general AI tools like ChatGPT."
        top_hits = [{"content": context_text}]
        citations = []
        top_score = 1.0
        low_confidence = False
    else:
        # Standard semantic retrieval from vector database
        hits = search_chunks(
            query=query,
            owner_id=user_id,
            k=8,
            min_score=0.25,  # Lowered from 0.30 to capture more relevant chunks
            metadata_filter=retrieval_filters,
        )

        top_hits = hits[:4]
        citations = _build_citations(top_hits)
        top_score = max((hit.get("score", 0.0) for hit in top_hits), default=0.0)
        low_confidence = top_score < 0.35

    if not top_hits:
        return {
            "answer": (
                "I could not find relevant context in your uploaded documents. "
                "Please make sure your files are uploaded and try asking a more specific question."
            ),
            "reasoning": None,
            "citations": [],
            "confidence": 0.0,
            "low_confidence": True,
            "retrieved_chunks": 0,
        }

    if not is_app_query:
        context_text = "\n\n---\n\n".join(hit["content"] for hit in top_hits)

    if settings.LLM_PROVIDER == "local" and not is_ollama_running() and not is_app_query:
        mock_response = (
            "Local mode is enabled, but Ollama is not reachable on `http://localhost:11434`.\n\n"
            "Showing retrieved context instead so you can verify retrieval quality:\n\n"
            f"```text\n{context_text}\n```"
        )
        return {
            "answer": mock_response,
            "reasoning": None,
            "citations": citations,
            "confidence": round(top_score, 4),
            "low_confidence": low_confidence,
            "retrieved_chunks": len(top_hits),
        }

    # Build the history string for conversation context
    history_text = _format_chat_history(chat_history)

    prompt = PromptTemplate(
        template=RAG_PROMPT_TEMPLATE,
        input_variables=["context", "question", "history"],
    )
    llm = get_llm()
    chain = prompt | llm

    response = chain.invoke({
        "context": context_text,
        "question": query,
        "history": history_text,
    })
    parsed = _parse_llm_response(response.content)
    answer = parsed["answer"]
    reasoning = parsed["reasoning"]

    if low_confidence and not is_app_query:
        answer += (
            "\n\n> ⚠️ **Note:** I found limited supporting context for this query. "
            "Please verify using the cited source snippets below."
        )

    return {
        "answer": answer,
        "reasoning": reasoning,
        "citations": citations,
        "confidence": round(top_score, 4),
        "low_confidence": low_confidence,
        "retrieved_chunks": len(top_hits),
    }
