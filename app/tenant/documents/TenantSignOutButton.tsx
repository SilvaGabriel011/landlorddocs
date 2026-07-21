"use client";

import { useRouter } from "next/navigation";

export default function TenantSignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/tenant/logout", { method: "POST" });
    router.push("/tenant");
    router.refresh();
  }

  return (
    <button className="btn btn-secondary btn-small" onClick={signOut}>
      Sign out
    </button>
  );
}
