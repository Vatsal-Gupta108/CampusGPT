export type UserRole = "user" | "admin";

export interface AppUser {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  user_id: number;
  created_at: string;
}

export interface Citation {
  content: string;
  filename: string;
  document_id?: number;
  score?: number;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  feedback?: "thumbs_up" | "thumbs_down" | null;
  citations?: Citation[];
  reasoning?: string;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  filename: string;
  file_type?: string;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  uploaded_at: string;
  owner_id: number;
}

export interface DocumentSearchResult {
  document_id?: number;
  filename: string;
  score: number;
  snippet: string;
  file_type?: string;
  tags: string[];
  category?: string;
}

export interface AdminAnalytics {
  total_users: number;
  total_documents: number;
  total_chat_sessions: number;
  total_messages: number;
  total_queries: number;
  failed_queries: number;
  low_confidence_responses: number;
  average_latency_ms: number;
  popular_documents: { filename: string; mentions: number }[];
  most_common_queries: { query: string; count: number }[];
  failed_query_examples: { query: string; error?: string; at: string; user_id: number }[];
  feedback_analytics: { thumbs_up: number; thumbs_down: number };
  system_activity: {
    query: string;
    latency_ms: number;
    low_confidence: boolean;
    success: boolean;
    at: string;
  }[];
}
