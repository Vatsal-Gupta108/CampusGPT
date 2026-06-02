"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { FileSearch, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { ProtectedShell } from "@/components/protected-shell";
import { deleteDocument, listDocuments, searchDocuments } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { DocumentItem, DocumentSearchResult } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTag, setSearchTag] = useState("");
  const [fileType, setFileType] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[]>([]);

  const readyCount = useMemo(() => documents.filter((item) => item.status === "ready").length, [documents]);

  const loadDocuments = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const rows = await listDocuments(token);
      setDocuments(rows);
    } catch {
      toast.error("Could not load document library.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDocuments();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const uploadFile = async (file: File) => {
    const token = getToken();
    if (!token) return;
    const validExtensions = [".pdf", ".txt", ".docx"];
    const isSupported = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isSupported) {
      toast.error("Only PDF, TXT, and DOCX files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tags", "general");
    formData.append("category", "Academic");

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/documents/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.responseText || "Upload failed."));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.send(formData);
    })
      .then(async () => {
        toast.success("Upload accepted. Indexing has started.");
        await loadDocuments();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Upload failed.");
      })
      .finally(() => {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(0), 400);
      });
  };

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDelete = async (documentId: number) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteDocument(token, documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast.success("Document removed.");
    } catch {
      toast.error("Document delete failed.");
    }
  };

  const runSearch = async () => {
    const token = getToken();
    if (!token || !searchQuery.trim()) return;
    try {
      const results = await searchDocuments(token, {
        query: searchQuery,
        file_type: fileType || undefined,
        tag: searchTag || undefined,
        k: 12,
      });
      setSearchResults(results);
    } catch {
      toast.error("Search failed.");
    }
  };

  return (
    <ProtectedShell
      title="Knowledge Vault"
      subtitle="Upload, index, and semantically search your campus knowledge corpus."
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass-card rounded-2xl p-4">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            className="rounded-2xl border-2 border-dashed border-cyan-300/30 bg-cyan-500/5 p-6 text-center"
          >
            <UploadCloud className="mx-auto h-10 w-10 text-cyan-200" />
            <p className="mt-3 text-lg font-semibold">Drop files to ingest into CampusGPT</p>
            <p className="mt-1 text-sm text-slate-300">PDF, DOCX, TXT | Max size controlled by backend policy</p>
            <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900">
              Choose File
              <input type="file" onChange={onFileInput} className="hidden" />
            </label>
          </div>

          {isUploading && (
            <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Upload + ingestion progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Sources</p>
              <p className="mt-1 text-2xl font-semibold">{documents.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ready for Retrieval</p>
              <p className="mt-1 text-2xl font-semibold">{readyCount}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-lg font-semibold">Semantic Search</h3>
          <p className="mt-1 text-sm text-slate-300">
            Search chunks by meaning and filter by type or tags for precise retrieval.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search query"
              className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            />
            <input
              value={searchTag}
              onChange={(event) => setSearchTag(event.target.value)}
              placeholder="Tag filter (optional)"
              className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            />
            <select
              value={fileType}
              onChange={(event) => setFileType(event.target.value)}
              className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            >
              <option value="">All types</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="txt">TXT</option>
            </select>
            <button
              onClick={runSearch}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              <FileSearch className="h-4 w-4" />
              Search
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {searchResults.map((result, index) => (
              <div key={`${result.filename}-${index}`} className="rounded-xl border border-white/15 bg-black/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-cyan-200">{result.filename}</p>
                  <span className="text-xs text-emerald-200">Score {(result.score * 100).toFixed(1)}%</span>
                </div>
                <p className="mt-2 text-slate-300">{result.snippet}</p>
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="text-sm text-slate-400">Search results will appear here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card mt-4 rounded-2xl p-4">
        <h3 className="text-lg font-semibold">Source Inventory</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-300">
              <tr>
                <th className="pb-2">File</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Chunks</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Uploaded</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading &&
                documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-white/10">
                    <td className="py-2 pr-4">{doc.filename}</td>
                    <td className="py-2 pr-4 uppercase">{doc.file_type || "-"}</td>
                    <td className="py-2 pr-4">{doc.chunk_count}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          doc.status === "ready"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : doc.status === "failed"
                              ? "bg-red-500/20 text-red-200"
                              : "bg-amber-500/20 text-amber-200"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{new Date(doc.uploaded_at).toLocaleString()}</td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!isLoading && documents.length === 0 && (
            <p className="mt-3 rounded-xl border border-dashed border-white/20 p-4 text-sm text-slate-300">
              No sources yet. Upload your first document to activate retrieval.
            </p>
          )}
        </div>
      </div>
    </ProtectedShell>
  );
}
