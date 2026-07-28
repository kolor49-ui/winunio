import type { Metadata, Viewport } from "next";
import { SiteHeader } from "./site-header";
import { AdminTopBar } from "./admin-top-bar";
import { PwaSetup } from "./install-app-button";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Winunio",
  description: "Páros vitaplatform",
  applicationName: "Winunio",
  appleWebApp: {
    capable: true,
    title: "Winunio",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6f8f72",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu" style={{ background: "#ffffff" }}>
      <body style={{ background: "#ffffff" }}>
        <PwaSetup />
        <SiteHeader />
        <AdminTopBar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
