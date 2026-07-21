// RentFolio logo: a house whose walls hold a stack of documents,
// on the app's blue. Used as the favicon too (app/icon.svg).
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="rf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1c46b3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rf-bg)" />
      <path
        d="M32 11 L53 28 H48 V50 a3 3 0 0 1 -3 3 H19 a3 3 0 0 1 -3 -3 V28 H11 Z"
        fill="#ffffff"
      />
      <rect x="22" y="33" width="20" height="3.5" rx="1.75" fill="#2456d6" />
      <rect x="22" y="40" width="20" height="3.5" rx="1.75" fill="#2456d6" />
      <rect x="22" y="47" width="13" height="3.5" rx="1.75" fill="#2456d6" />
    </svg>
  );
}

// Logo mark + two-tone wordmark, for navbars and auth cards.
export default function Brand({ size = 24 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <LogoMark size={size} />
      <span>
        Rent<span style={{ color: "var(--accent)" }}>Folio</span>
      </span>
    </span>
  );
}
