import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  return {
    metadataBase: new URL(base),
    title: "AssetFlow — Company Asset Management",
    description:
      "Track company IT and non-IT assets, employee assignments, returns, QR history, repairs and department requirements.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "AssetFlow",
      description: "Every asset. One clear record.",
    },
    twitter: {
      card: "summary",
      title: "AssetFlow",
      description: "Every asset. One clear record.",
    },
  };
}

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
