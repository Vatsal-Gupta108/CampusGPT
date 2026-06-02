"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutDashboard, LogOut, MessageCircle, Shield, Upload } from "lucide-react";

import { clearToken, getToken } from "@/lib/auth";
import { logout, me } from "@/lib/api";
import type { AppUser } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/chat", label: "Assistant", icon: MessageCircle },
  { href: "/documents", label: "Knowledge Vault", icon: Upload },
  { href: "/admin", label: "Control Room", icon: Shield, adminOnly: true },
];

interface ProtectedShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  requireAdmin?: boolean;
}

export function ProtectedShell({
  title,
  subtitle,
  requireAdmin,
  children,
}: ProtectedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const boot = async () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const current = await me(token);
        if (requireAdmin && current.role !== "admin") {
          toast.error("Admin access required for this area.");
          router.replace("/chat");
          return;
        }
        setUser(current);
      } catch {
        clearToken();
        router.replace("/login");
      } finally {
        setIsCheckingAuth(false);
      }
    };
    boot();
  }, [requireAdmin, router]);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => !item.adminOnly || user?.role === "admin");
  }, [user?.role]);

  const handleLogout = async () => {
    const token = getToken();
    try {
      if (token) await logout(token);
    } catch {
      // We still clear local state because JWT auth is stateless on server.
    } finally {
      clearToken();
      router.replace("/login");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-10 animate-pulse">
          <div className="h-5 w-56 rounded bg-white/15" />
          <div className="mt-3 h-4 w-80 rounded bg-white/10" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="h-24 rounded-2xl bg-white/10" />
            <div className="h-24 rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex max-w-[1400px] gap-4 px-3 py-3 md:gap-6 md:px-6">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[var(--card)] p-5 shadow-2xl transition-transform md:static md:translate-x-0 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <Image src="/campusgpt-mark.svg" alt="CampusGPT" width={40} height={40} className="h-10 w-10" />
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">CampusGPT</p>
              <h1 className="text-lg font-semibold">Knowledge OS</h1>
            </div>
          </div>
          <nav className="mt-6 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    active ? "bg-cyan-500/20 text-cyan-100" : "text-slate-200 hover:bg-white/10"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
            <p className="uppercase tracking-[0.2em] text-slate-400">Signed in as</p>
            <p className="mt-1 break-all text-sm text-slate-100">{user?.email}</p>
            <p className="mt-1 text-cyan-200">Role: {user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <div className="flex-1 flex flex-col min-h-[calc(100vh-2rem)]">
          <header className="mb-4 rounded-2xl border border-white/10 bg-[var(--card)] p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Workspace</p>
                <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
              </div>
              <button
                className="rounded-lg border border-white/20 px-3 py-2 text-sm md:hidden"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className="flex-grow">{children}</main>
          <footer className="mt-auto pt-8 pb-4 text-center text-xs text-slate-400">
            Developed by Vatsal Gupta
          </footer>
        </div>
      </div>
    </div>
  );
}
