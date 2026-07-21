"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Brand from "../components/Brand";

export default function TenantAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint =
      mode === "signin" ? "/api/tenant/login" : "/api/tenant/signup";
    const body =
      mode === "signin" ? { name, pin } : { name, email, pin };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/tenant/documents");
    router.refresh();
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
  }

  return (
    <div className="card stack" style={{ width: "100%", maxWidth: 400 }}>
      <div>
        <h1>
          <Brand size={28} />
        </h1>
        <p className="muted">
          {mode === "signin"
            ? "Sign in with your name and 4-digit PIN."
            : "Create your account to upload your application documents."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stack">
        <div>
          <label htmlFor="tenant-name">Your name</label>
          <input
            id="tenant-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="e.g. Maria Souza"
          />
          {mode === "signup" && (
            <p className="muted" style={{ marginTop: 4 }}>
              This is the name you&apos;ll use to sign in later.
            </p>
          )}
        </div>

        {mode === "signup" && (
          <div>
            <label htmlFor="tenant-email">Email</label>
            <input
              id="tenant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        )}

        <div>
          <label htmlFor="tenant-pin">
            {mode === "signin" ? "4-digit PIN" : "Choose a 4-digit PIN"}
          </label>
          <input
            id="tenant-pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
            placeholder="••••"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
          />
          {mode === "signup" && (
            <p className="muted" style={{ marginTop: 4 }}>
              You&apos;ll sign back in with your name + this PIN.
            </p>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="muted">
        {mode === "signin" ? (
          <>
            First time here?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                switchMode("signup");
              }}
            >
              Create your account
            </a>
          </>
        ) : (
          <>
            Already registered?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                switchMode("signin");
              }}
            >
              Sign in with your PIN
            </a>
          </>
        )}
      </p>

      <p className="muted">
        Are you the landlord? <a href="/dashboard">View the applications</a>.
      </p>
    </div>
  );
}
