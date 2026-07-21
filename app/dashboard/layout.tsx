import Link from "next/link";
import Brand from "../components/Brand";
import SignOutButton from "./SignOutButton";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <Link href="/dashboard" className="brand">
            <Brand />
          </Link>
          <div className="row">
            <Link href="/dashboard">Applicants</Link>
            <SignOutButton />
          </div>
        </div>
      </nav>
      <main className="container">{children}</main>
    </>
  );
}
