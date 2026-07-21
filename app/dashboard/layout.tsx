import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <Link href="/dashboard" className="brand">
            LandlordDocs
          </Link>
          <div className="row">
            <Link href="/dashboard">Documents</Link>
            <Link href="/dashboard/links">Share links</Link>
            <SignOutButton />
          </div>
        </div>
      </nav>
      <main className="container">{children}</main>
    </>
  );
}
