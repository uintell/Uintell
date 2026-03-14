"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-white">
      <h1 className="text-3xl font-semibold">Something broke</h1>
      <p className="max-w-md text-sm text-muted">{error.message}</p>
      <button onClick={reset} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink">
        Retry
      </button>
    </div>
  );
}
