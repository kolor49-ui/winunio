import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo">
              Winunio
            </Link>
            <nav className="nav-links">
              <Link href="/debates/new">Vitát indítok</Link>
              <Link href="/login">Bejelentkezés</Link>
              <Link href="/register">Regisztráció</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
