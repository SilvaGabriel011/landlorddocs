"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (very old browser): select-and-copy manually.
      prompt("Copy the number:", text);
    }
  }

  return (
    <button
      className="btn btn-secondary btn-small"
      onClick={copy}
      aria-label={`Copy ${text}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
