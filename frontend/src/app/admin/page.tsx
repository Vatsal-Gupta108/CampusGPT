"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";

import { ProtectedShell } from "@/components/protected-shell";
import { deleteUser, getAdminAnalytics, listUsers, toggleUserRole } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { AdminAnalytics, AppUser } from "@/lib/types";

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [a, u] = await Promise.all([getAdminAnalytics(token), listUsers(token)]);
      setAnalytics(a);
      setUsers(u);
    } catch {
      toast.error("Failed to load admin data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const onToggleRole = async (userId: number) => {
    const token = getToken();
    if (!token) return;
    try {
      await toggleUserRole(token, userId);
      await refresh();
      toast.success("User role updated.");
    } catch {
      toast.error("Role update failed.");
    }
  };

  const onDeleteUser = async (userId: number) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteUser(token, userId);
      await refresh();
      toast.success("User removed.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  return (
    <ProtectedShell
      requireAdmin
      title="Admin Control Room"
      subtitle="Observe platform health, retrieval quality, and user operations in one place."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Users" value={analytics?.total_users ?? 0} />
        <MetricCard label="Total Chats" value={analytics?.total_chat_sessions ?? 0} />
        <MetricCard label="Uploaded Docs" value={analytics?.total_documents ?? 0} />
        <MetricCard label="Failed Queries" value={analytics?.failed_queries ?? 0} danger />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-lg font-semibold">Most Common Queries</h3>
          <div className="mt-3 space-y-2">
            {analytics?.most_common_queries?.map((row, index) => (
              <div key={`${row.query}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-medium text-cyan-200">{row.query}</p>
                <p className="text-slate-300">Asked {row.count} times</p>
              </div>
            ))}
            {!analytics?.most_common_queries?.length && (
              <p className="text-sm text-slate-400">Query data will appear as users interact.</p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-lg font-semibold">Popular Documents</h3>
          <div className="mt-3 space-y-2">
            {analytics?.popular_documents?.map((row, index) => (
              <div key={`${row.filename}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-medium">{row.filename}</p>
                <p className="text-slate-300">Cited {row.mentions} times</p>
              </div>
            ))}
            {!analytics?.popular_documents?.length && (
              <p className="text-sm text-slate-400">No citation volume yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            <h3 className="text-lg font-semibold">Low Confidence + Failed Samples</h3>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            Low confidence responses: {analytics?.low_confidence_responses ?? 0}
          </p>
          <div className="mt-3 space-y-2">
            {analytics?.failed_query_examples?.map((row, index) => (
              <div key={`${row.query}-${index}`} className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
                <p className="font-medium text-red-200">{row.query}</p>
                <p className="text-xs text-red-100/90">{row.error || "Unknown backend error."}</p>
                <p className="mt-1 text-[11px] text-slate-300">{new Date(row.at).toLocaleString()}</p>
              </div>
            ))}
            {!analytics?.failed_query_examples?.length && (
              <p className="text-sm text-slate-400">No failed queries recorded.</p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <h3 className="text-lg font-semibold">User Management</h3>
          </div>
          <div className="mt-3 space-y-2">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-medium">{user.email}</p>
                <p className="text-xs text-slate-300">Role: {user.role}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => onToggleRole(user.id)}
                    className="rounded-lg border border-cyan-300/30 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                  >
                    Toggle Role
                  </button>
                  <button
                    onClick={() => onDeleteUser(user.id)}
                    className="rounded-lg border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && users.length === 0 && (
              <p className="text-sm text-slate-400">No users found.</p>
            )}
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}

function MetricCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${danger ? "text-red-200" : "text-cyan-100"}`}>{value}</p>
    </div>
  );
}
