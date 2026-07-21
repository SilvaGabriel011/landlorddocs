import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LandlordDocs",
  description: "Share your rental application documents with landlords securely.",
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
