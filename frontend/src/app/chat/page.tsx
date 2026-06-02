"use client";

import { Copy, RefreshCw, Send, ThumbsDown, ThumbsUp, Sparkles, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { MarkdownMessage } from "@/components/markdown-message";
import { ProtectedShell } from "@/components/protected-shell";
import {
  createChatSession,
  getSessionMessages,
  listChatSessions,
  regenerateLastMessage,
  sendMessage,
  submitFeedback,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ChatMessage, ChatSession } from "@/lib/types";

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

const SUGGESTED_PROMPTS = [
  "📄 Summarise my uploaded documents",
  "🔍 What are the key findings?",
  "📝 List the main topics covered",
  "💡 What recommendations are mentioned?",
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const boot = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const existing = await listChatSessions(token);
      if (existing.length === 0) {
        const created = await createChatSession(token, `Research Chat ${new Date().toLocaleDateString()}`);
        setSessions([created]);
        setActiveSessionId(created.id);
        setMessages([]);
      } else {
        setSessions(existing);
        setActiveSessionId(existing[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load chat sessions.");
    } finally {
      setIsBooting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void boot();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      const token = getToken();
      if (!token || !activeSessionId) return;
      try {
        const rows = await getSessionMessages(token, activeSessionId);
        setMessages(rows);
      } catch {
        toast.error("Could not load this conversation.");
      }
    };
    loadMessages();
  }, [activeSessionId]);

  const handleCreateSession = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const created = await createChatSession(token, `New Chat ${sessions.length + 1}`);
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setMessages([]);
    } catch {
      toast.error("Unable to create a new chat right now.");
    }
  };

  const handleSend = async (content?: string) => {
    const msgContent = content || input.trim();
    if (!msgContent || !activeSessionId) return;
    const token = getToken();
    if (!token) return;

    setInput("");
    setIsSending(true);

    const optimisticUserMessage: ChatMessage = {
      id: Date.now(),
      session_id: activeSessionId,
      role: "user",
      content: msgContent,
      created_at: new Date().toISOString(),
      citations: [],
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const assistantMessage = await sendMessage(token, activeSessionId, msgContent);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant could not respond.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeSessionId) return;
    const token = getToken();
    if (!token) return;
    setIsSending(true);
    try {
      const regenerated = await regenerateLastMessage(token, activeSessionId);
      setMessages((prev) => [...prev, regenerated]);
      toast.success("Regenerated response added.");
    } catch {
      toast.error("Could not regenerate response.");
    } finally {
      setIsSending(false);
    }
  };

  const handleFeedback = async (messageId: number, feedback: "thumbs_up" | "thumbs_down") => {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await submitFeedback(token, messageId, feedback);
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? updated : msg)));
      toast.success("Feedback captured.");
    } catch {
      toast.error("Feedback failed.");
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Response copied.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ProtectedShell
      title="Campus Assistant"
      subtitle="Grounded RAG chat with citations, confidence hints, and conversation memory."
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="glass-card rounded-2xl p-4">
          <button
            onClick={handleCreateSession}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-400/30 px-3 py-2.5 text-sm font-medium hover:from-cyan-500/30 hover:to-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-cyan-300" />
            New Conversation
          </button>
          <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200 ${
                  session.id === activeSessionId
                    ? "border-cyan-300/50 bg-cyan-500/20 shadow-lg shadow-cyan-500/5"
                    : "border-white/10 bg-black/20 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <p className="truncate font-medium">{session.title}</p>
                <p className="mt-1 text-xs text-slate-300">{new Date(session.created_at).toLocaleDateString()}</p>
              </button>
            ))}
            {!isBooting && sessions.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/20 p-3 text-sm text-slate-300">
                Start your first conversation.
              </p>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="glass-card flex min-h-[72vh] flex-col rounded-2xl p-4">
          <div className="mb-3 border-b border-white/10 pb-3">
            <h3 className="text-lg font-semibold">{activeSession?.title || "Conversation"}</h3>
            <p className="text-sm text-slate-300">Ask questions over your uploaded documents.</p>
          </div>

          <div className="flex-1 space-y-4 overflow-auto pr-1">
            {/* Welcome screen when no messages */}
            {messages.length === 0 && !isSending && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-400/20">
                  <MessageCircle className="h-8 w-8 text-cyan-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">Welcome to CampusGPT</h3>
                <p className="mt-2 max-w-md text-sm text-slate-300">
                  Ask me anything about your uploaded documents. I&apos;ll provide answers grounded in your files with direct citations.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2 w-full max-w-lg">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSend(prompt.replace(/^[^\s]+\s/, ""))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10 hover:border-cyan-400/30 transition-all duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message, index) => (
              <div
                key={`${message.id}-${index}`}
                className={`stagger-enter rounded-2xl border p-4 ${
                  message.role === "assistant"
                    ? "border-cyan-400/20 bg-gradient-to-br from-cyan-500/8 to-transparent"
                    : "ml-auto max-w-[85%] border-white/15 bg-white/5"
                }`}
              >
                {/* Message header with avatar */}
                <div className="mb-2.5 flex items-center gap-2 text-xs text-slate-300">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    message.role === "assistant"
                      ? "bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 border border-cyan-400/30"
                      : "bg-white/10 border border-white/15"
                  }`}>
                    {message.role === "assistant" ? "🤖" : "👤"}
                  </span>
                  <span className="font-medium">{message.role === "assistant" ? "CampusGPT" : "You"}</span>
                  <span className="ml-auto text-slate-400">{formatTimestamp(message.created_at)}</span>
                </div>

                {/* Reasoning/Thinking process */}
                {message.role === "assistant" && message.reasoning && (
                  <details className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                    <summary className="cursor-pointer font-medium select-none text-slate-200 hover:text-cyan-300 flex items-center gap-2">
                      <span className="inline-block text-cyan-400">🧠</span> Thinking Process
                    </summary>
                    <div className="mt-2 pl-4 border-l border-white/15 whitespace-pre-wrap text-slate-300 italic leading-relaxed">
                      {message.reasoning}
                    </div>
                  </details>
                )}

                {/* Message content */}
                {message.role === "assistant" ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-slate-100">{message.content}</p>
                )}

                {/* Citations */}
                {message.role === "assistant" && message.citations && message.citations.length > 0 && (
                  <details className="mt-4 border-t border-white/5 pt-3">
                    <summary className="cursor-pointer select-none text-xs font-medium text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 w-fit transition-colors">
                      <span>📄</span> Sources ({message.citations.length})
                    </summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {message.citations.map((citation, citationIndex) => (
                        <div
                          key={`${message.id}-citation-${citationIndex}`}
                          className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs"
                        >
                          <p className="font-semibold text-cyan-200">{citation.filename}</p>
                          <p className="mt-1 text-slate-300 line-clamp-3">{citation.content}</p>
                          {citation.score !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
                                  style={{ width: `${Math.min(citation.score * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-emerald-200 whitespace-nowrap">
                                {(citation.score * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Action buttons */}
                {message.role === "assistant" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCopy(message.content)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-150"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, "thumbs_up")}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-150 ${
                        message.feedback === "thumbs_up"
                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                          : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Helpful
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, "thumbs_down")}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-150 ${
                        message.feedback === "thumbs_down"
                          ? "border-red-400/40 bg-red-500/15 text-red-300"
                          : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Needs work
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isSending && (
              <div className="stagger-enter rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/8 to-transparent p-4">
                <div className="flex items-center gap-2 text-xs text-slate-300 mb-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 border border-cyan-400/30 text-xs">🤖</span>
                  <span className="font-medium">CampusGPT</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400 [animation-delay:0.15s]" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400 [animation-delay:0.3s]" />
                  </div>
                  <span className="text-sm text-slate-300">Thinking and grounding against your sources...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="mt-4 grid gap-2">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask about schedules, policies, lectures, or uploaded PDFs..."
                className="flex-1 rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm outline-none focus:border-cyan-300 transition-colors duration-200 resize-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={isSending || !input.trim()}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-4 py-3 text-slate-900 font-medium transition-all duration-200 hover:from-cyan-300 hover:to-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegenerate}
                disabled={isSending || messages.length === 0}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <span className="text-xs text-slate-500">Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}
