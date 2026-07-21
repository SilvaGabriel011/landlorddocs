"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Brand from "../components/Brand";

export default function LandlordCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/landlord/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card stack" style={{ width: "100%", maxWidth: 400 }}>
      <div>
        <h1>
          <Brand size={28} />
        </h1>
        <p className="muted">
          Enter the landlord access code to view the applications.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stack">
        <div>
          <label htmlFor="landlord-code">Access code</label>
          <input
            id="landlord-code"
            type="password"
            inputMode="numeric"
            pattern="\d*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            placeholder="••••••"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Please wait…" : "View applications"}
        </button>
      </form>

      <p className="muted">
        Applying to rent? <a href="/tenant">Sign in here</a>.
      </p>
    </div>
  );
}
