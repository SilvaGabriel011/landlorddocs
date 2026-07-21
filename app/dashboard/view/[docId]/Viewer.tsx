"use client";

import { useRef } from "react";

export default function Viewer({
  fileUrl,
  downloadUrl,
  mimeType,
  name,
}: {
  fileUrl: string;
  downloadUrl: string;
  mimeType: string;
  name: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const isPdf = mimeType === "application/pdf";

  function handlePrint() {
    if (isPdf) {
      // The file is streamed same-origin, so the embedded PDF viewer
      // can be printed directly.
      const win = frameRef.current?.contentWindow;
      if (win) {
        win.focus();
        win.print();
        return;
      }
    }
    // Images: print the page; print CSS hides everything but the image.
    window.print();
  }

  return (
    <div className="stack">
      <div className="row no-print">
        <button className="btn btn-small" onClick={handlePrint}>
          Print
        </button>
        <a className="btn btn-secondary btn-small" href={downloadUrl}>
          {isPdf ? "Download PDF" : "Download"}
        </a>
      </div>
      {isPdf ? (
        <iframe
          ref={frameRef}
          src={fileUrl}
          className="viewer-frame"
          title={name}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt={name} className="viewer-image" />
      )}
    </div>
  );
}
