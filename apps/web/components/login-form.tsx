"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LogoMark } from "@/components/logo-mark";
import { useAuth } from "@/components/providers";

export function LoginForm() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6 py-12 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-line bg-panel p-8 shadow-panel">
        <div className="flex items-center gap-4">
          <div className="brandLockup__logoShell shrink-0">
            <LogoMark size={64} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-accent">United Intelligence</div>
            <div className="mt-1 text-xs uppercase tracking-[0.28em] text-muted">Secure workspace access</div>
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create an account"}</h1>
        <p className="mt-2 text-sm text-muted">Session cookies stay server-issued. The app does not ship seeded credentials in the UI.</p>

        <div className="mt-8 space-y-4">
          {mode === "register" ? (
            <label className="block">
              <span className="mb-2 block text-sm text-muted">Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 outline-none ring-0 transition focus:border-accent"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 outline-none ring-0 transition focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 outline-none ring-0 transition focus:border-accent"
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <button
          disabled={submitting}
          className="mt-6 w-full rounded-2xl bg-accent px-4 py-3 font-medium text-ink transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-sm text-muted transition hover:text-white"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
