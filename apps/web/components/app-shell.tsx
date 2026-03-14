"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import clsx from "clsx";

import { LogoMark } from "@/components/logo-mark";
import { useAuth } from "@/components/providers";

const navigation = [
  { href: "/app", label: "Home" },
  { href: "/app/library", label: "Library" },
  { href: "/app/search", label: "Search" },
  { href: "/app/imports", label: "Imports" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#020704] text-[#5faa73]">Loading workspace...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020704] px-6 text-center text-[#7df2a6]">
        <h1 className="text-3xl font-semibold">Authentication required</h1>
        <p className="mt-3 max-w-md text-sm text-[#5faa73]">Sign in to access conversations, documents, and admin controls.</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 rounded-full bg-[#4d8dff] px-5 py-3 font-medium text-[#020704] transition hover:bg-[#7aaaff]"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020704] text-[#7df2a6]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[240px_1fr] lg:px-6">
        <aside className="border border-[#12311d] bg-[#050b08] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <LogoMark size={72} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#00a126]">United Intelligence</div>
              <div className="mt-2 text-sm text-[#5faa73]">Offline-first knowledge reader for sources, pages, search, and cited answers.</div>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "block border px-4 py-3 text-sm transition",
                  pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`))
                    ? "border-[#1a4029] bg-[#08110d] text-[#7df2a6]"
                    : "border-transparent text-[#4d8dff] hover:border-[#12311d] hover:bg-[#08110d] hover:text-[#7aaaff]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border border-[#12311d] bg-[#08110d] p-4 text-sm">
            <div className="font-medium text-[#7df2a6]">{user.display_name}</div>
            <div className="mt-1 text-[#5faa73]">{user.email}</div>
            <button
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="mt-4 rounded-full border border-[#12311d] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
            >
              Sign out
            </button>
          </div>
        </aside>
        <div className="min-h-[calc(100vh-2rem)] border border-[#12311d] bg-[#050b08] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:p-6">{children}</div>
      </div>
    </div>
  );
}
