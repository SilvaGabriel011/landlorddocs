import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentFolio",
  description:
    "Rental application documents, in one place: applicants upload, the landlord reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
