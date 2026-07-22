import Link from "next/link";
import { listDebates } from "@/server/services/debate-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const debates = await listDebates("new");

  return (
    <>
      <h1>Páros viták</h1>
      <p className="hint">
        Két fél, közös jutalom — a közönség csak folytatást kérhet.
      </p>

      {debates.length === 0 ? (
        <div className="card">
          <p>Még nincs vita. </p>
          <Link href="/debates/new">Indítsd az elsőt →</Link>
        </div>
      ) : (
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
      )}
    </>
  );
}
