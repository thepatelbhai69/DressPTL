"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name") ?? undefined,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }

    router.push(mode === "signup" ? "/onboarding" : "/profile");
    router.refresh();
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <form onSubmit={onSubmit}>
        {error ? <div className="alert alert--error">{error}</div> : null}

        {mode === "signup" ? (
          <>
            <label htmlFor="name">Name (optional)</label>
            <input id="name" name="name" type="text" autoComplete="name" />
          </>
        ) : null}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 10 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" ? (
          <p className="muted" style={{ marginTop: -8 }}>
            At least 10 characters.
          </p>
        ) : null}

        <button type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="muted" style={{ marginBottom: 0, marginTop: 16 }}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/signup">Create one</Link>
          </>
        )}
      </p>
    </div>
  );
}
