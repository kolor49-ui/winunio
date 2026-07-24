import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Winunio",
  description: "Páros vitaplatform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>
        <SiteHeader />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
