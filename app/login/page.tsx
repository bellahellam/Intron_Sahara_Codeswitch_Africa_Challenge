"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

type Role = "user" | "admin";

const roleCopy: Record<Role, { title: string; body: string; button: string }> = {
  user: {
    title: "Community health worker",
    body: "Run screenings and see only the information needed for your work.",
    button: "Sign in to screening",
  },
  admin: {
    title: "Administrator",
    body: "Review operations, system controls and benchmark comparisons.",
    button: "Sign in to administration",
  },
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<Role>("user");
  const [chpCode, setChpCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : role === "admin" ? "/admin" : "/";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password, ...(role === "user" ? { chpCode } : {}) }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string; chpCode?: string } | null;
      if (!response.ok) {
        setError(body?.message ?? "We could not sign you in. Try again.");
        setSubmitting(false);
        return;
      }
      if (body?.chpCode) localStorage.setItem("chp_code", body.chpCode);
      else localStorage.removeItem("chp_code");
      window.location.assign(destination);
    } catch {
      setError("Network unavailable. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-mark" aria-hidden>
        <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 11h2M4 7v8M7 4v14M10 8v6M13 5v12M16 8v6M19 7v8M22 11h-1" />
        </svg>
      </div>
      <p className="login-eyebrow">MAMA-SAUTI</p>
      <h1>Welcome back.</h1>
      <p className="login-description">Choose the workspace that matches your responsibilities.</p>

      <div className="login-role-picker" aria-label="Choose your profile">
        {(Object.keys(roleCopy) as Role[]).map((option) => {
          const selected = role === option;
          return (
            <button
              key={option}
              type="button"
              className={`login-role ${selected ? "login-role-selected" : ""}`}
              onClick={() => { setRole(option); setError(null); }}
              aria-pressed={selected}
            >
              <span className="login-role-title">{roleCopy[option].title}</span>
              <span className="login-role-description">{roleCopy[option].body}</span>
            </button>
          );
        })}
      </div>

      <form className="login-form" onSubmit={submit}>
        {role === "user" && (
          <div>
            <label htmlFor="chp-code">CHP code</label>
            <input
              id="chp-code"
              autoCapitalize="characters"
              autoComplete="username"
              value={chpCode}
              onChange={(event) => setChpCode(event.target.value.toUpperCase())}
              placeholder="e.g. KWG-012"
              required
            />
          </div>
        )}
        <div>
          <label htmlFor="password">{role === "admin" ? "Administrator password" : "Access password"}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : roleCopy[role].button}
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <p className="login-demo-note">
          Local demo passwords: <code>demo-user</code> and <code>demo-admin</code>.
        </p>
      )}
      <p className="login-privacy-note">Your role controls what information and system details are available in this workspace.</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
