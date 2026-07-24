"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card">
      <h1>Hiba történt</h1>
      <p className="error">Az oldal betöltése nem sikerült.</p>
      {error.digest && <p className="meta">Azonosító: {error.digest}</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={reset}>
          Újrapróbálás
        </button>
        <Link href="/" className="btn btn-secondary">
          Főoldal
        </Link>
      </div>
    </div>
  );
}
