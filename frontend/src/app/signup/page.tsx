"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { login, signup } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/chat");
  }, [router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signup(email, password);
      const token = await login(email, password);
      setToken(token.access_token);
      toast.success("Account created. You are now inside CampusGPT.");
      router.replace("/chat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <Image src="/campusgpt-mark.svg" alt="CampusGPT" width={48} height={48} className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-3xl font-semibold">Create your workspace</h1>
          <p className="mt-2 text-sm text-slate-300">
            Build a searchable, cited, AI-ready knowledge hub for your campus team.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 outline-none transition focus:border-cyan-300"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Password</span>
            <input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 outline-none transition focus:border-cyan-300"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-300 px-4 py-3 font-semibold text-slate-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-200 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
      <p className="mt-8 text-center text-xs text-slate-400">
        Developed by Vatsal Gupta
      </p>
    </div>
  );
}
