"use client";

import { useRouter } from "next/navigation";

export default function LandlordSignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/landlord/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="btn btn-secondary btn-small" onClick={signOut}>
      Sign out
    </button>
  );
}
