"use client";

import { useEffect } from "react";

// Landlord-side toolbar: a download button (logged server-side via the
// ?download=1 parameter) and a listener that reports browser printing.
export default function ViewerTools({
  token,
  docId,
  fileUrl,
}: {
  token: string;
  docId: string;
  fileUrl: string;
}) {
  useEffect(() => {
    function onBeforePrint() {
      navigator.sendBeacon(
        `/share/${token}/track`,
        JSON.stringify({ docId, action: "printed" })
      );
    }
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [token, docId]);

  return (
    <a href={`${fileUrl}?download=1`} className="btn btn-secondary btn-small">
      Download
    </a>
  );
}
