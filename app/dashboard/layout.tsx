import Link from "next/link";
import Brand from "../components/Brand";
import { landlordCode } from "@/lib/landlord";
import LandlordSignOutButton from "./LandlordSignOutButton";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="topnav no-print">
        <div className="topnav-inner">
          <Link href="/dashboard" className="brand">
            <Brand />
          </Link>
          <div className="row">
            <Link href="/dashboard">Applications</Link>
            {landlordCode() && <LandlordSignOutButton />}
          </div>
        </div>
      </nav>
      <main className="container">{children}</main>
    </>
  );
}
