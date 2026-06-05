import type {
  AdminAnalytics,
  AppUser,
  ChatMessage,
  ChatSession,
  DocumentItem,
  DocumentSearchResult,
} from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  window.location.hostname !== "[::1]"
    ? "https://campusgpt-vjde.onrender.com/api/v1"
    : "http://localhost:8000/api/v1");


async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    let detail = payload;
    try {
      detail = JSON.parse(payload)?.detail || payload;
    } catch {
      // Keep raw payload for debugging when backend doesn't return JSON.
    }
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function signup(email: string, password: string): Promise<AppUser> {
  return apiRequest<AppUser>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const formData = new URLSearchParams();
  formData.set("username", email);
  formData.set("password", password);
  return apiRequest("/auth/login", {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export async function me(token: string): Promise<AppUser> {
  return apiRequest<AppUser>("/auth/me", {}, token);
}

export async function logout(token: string): Promise<{ status: string; message: string }> {
  return apiRequest("/auth/logout", { method: "POST" }, token);
}

export async function listDocuments(token: string): Promise<DocumentItem[]> {
  return apiRequest<DocumentItem[]>("/documents", {}, token);
}

export async function deleteDocument(token: string, documentId: number): Promise<{ status: string; message: string }> {
  return apiRequest(`/documents/${documentId}`, { method: "DELETE" }, token);
}

export async function searchDocuments(
  token: string,
  params: {
    query: string;
    file_type?: string;
    document_id?: number;
    tag?: string;
    uploaded_after?: string;
    uploaded_before?: string;
    k?: number;
  },
): Promise<DocumentSearchResult[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("query", params.query);
  if (params.file_type) queryParams.set("file_type", params.file_type);
  if (params.document_id) queryParams.set("document_id", String(params.document_id));
  if (params.tag) queryParams.set("tag", params.tag);
  if (params.uploaded_after) queryParams.set("uploaded_after", params.uploaded_after);
  if (params.uploaded_before) queryParams.set("uploaded_before", params.uploaded_before);
  if (params.k) queryParams.set("k", String(params.k));
  return apiRequest<DocumentSearchResult[]>(`/documents/search?${queryParams.toString()}`, {}, token);
}

export async function listChatSessions(token: string): Promise<ChatSession[]> {
  return apiRequest<ChatSession[]>("/chat/sessions", {}, token);
}

export async function createChatSession(token: string, title: string): Promise<ChatSession> {
  return apiRequest<ChatSession>(
    "/chat/sessions",
    { method: "POST", body: JSON.stringify({ title }) },
    token,
  );
}

export async function getSessionMessages(token: string, sessionId: number): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`, {}, token);
}

export async function sendMessage(
  token: string,
  sessionId: number,
  content: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(
    `/chat/sessions/${sessionId}/messages`,
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
}

export async function regenerateLastMessage(token: string, sessionId: number): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/chat/sessions/${sessionId}/regenerate`, { method: "POST" }, token);
}

export async function submitFeedback(
  token: string,
  messageId: number,
  feedback: "thumbs_up" | "thumbs_down" | null,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(
    `/chat/messages/${messageId}/feedback`,
    { method: "POST", body: JSON.stringify({ feedback }) },
    token,
  );
}

export async function getAdminAnalytics(token: string): Promise<AdminAnalytics> {
  return apiRequest<AdminAnalytics>("/admin/analytics", {}, token);
}

export async function listUsers(token: string): Promise<AppUser[]> {
  return apiRequest<AppUser[]>("/admin/users", {}, token);
}

export async function toggleUserRole(token: string, userId: number): Promise<{ role: string; status: string; message: string }> {
  return apiRequest(`/admin/users/${userId}/role`, { method: "PATCH" }, token);
}

export async function deleteUser(token: string, userId: number): Promise<{ status: string; message: string }> {
  return apiRequest(`/admin/users/${userId}`, { method: "DELETE" }, token);
}
