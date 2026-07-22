import Link from "next/link";
import { listDebates } from "@/server/services/debate-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let debates: Awaited<ReturnType<typeof listDebates>> = [];
  let dbError: string | null = null;

  try {
    debates = await listDebates("new");
  } catch (error) {
    console.error("HomePage DB error:", error);
    dbError =
      error instanceof Error ? error.message : "Adatbázis kapcsolat sikertelen";
  }

  return (
    <>
      <h1>Páros viták</h1>
      <p className="hint">
        Két fél, közös jutalom — a közönség csak folytatást kérhet.
      </p>

      {dbError && (
        <div className="card">
          <p className="error">Szerver hiba: adatbázis nem elérhető.</p>
          <p className="hint">
            Vercel: állítsd be a <code>DATABASE_URL</code> és{" "}
            <code>AUTH_SECRET</code> env változókat, futtasd a migrációkat, majd
            redeploy.
          </p>
        </div>
      )}

      {!dbError && debates.length === 0 ? (
        <div className="card">
          <p>Még nincs vita. </p>
          <Link href="/debates/new">Indítsd az elsőt →</Link>
        </div>
      ) : !dbError ? (
        debates.map((d) => (
          <Link
            key={d.id}
            href={`/debates/${d.id}`}
            style={{ textDecoration: "none" }}
          >
            <article className="card">
              <h2>{d.question}</h2>
              <p className="meta">
                {d.category} · {d.status}
              </p>
            </article>
          </Link>
        ))
      ) : null}
    </>
  );
}
