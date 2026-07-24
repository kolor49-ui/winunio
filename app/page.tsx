import Link from "next/link";
import { getSession } from "@/server/api/http";
import { listDebates } from "@/server/services/debate-service";
import { getUserById } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  waiting_for_partner: "Partnerre vár",
  invitation_pending: "Meghívás folyamatban",
  active: "Aktív vita",
  waiting_for_continuation: "Folytatásra vár",
  awaiting_closure: "Zárásra vár",
  completed: "Lezárva",
  cancelled: "Visszavonva",
  under_review: "Felülvizsgálat alatt",
};

type Props = { searchParams: Promise<{ account_deleted?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  let debates: Awaited<ReturnType<typeof listDebates>> = [];
  let dbError: string | null = null;
  const session = await getSession();
  let user: Awaited<ReturnType<typeof getUserById>> = null;
  if (session) {
    try {
      user = await getUserById(session.userId);
    } catch (error) {
      console.error("HomePage user load failed:", error);
    }
  }

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

      {params.account_deleted === "1" && (
        <div className="card">
          <p>A fiókod véglegesen törölve lett. Ugyanazzal az e-mail címmel újra regisztrálhatsz.</p>
        </div>
      )}

      {user ? (
        <p className="hint">
          <Link href="/vitaim">Vitáim</Link>
          {" · "}
          Bejelentkezve: <strong>{user.email}</strong>
        </p>
      ) : (
        <p className="hint">
          <Link href="/login">Jelentkezz be</Link>, ha partnernek szeretnél
          jelentkezni.
        </p>
      )}

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
        <>
          {user && debates.length > 0 && <h2 className="section-title">Nyitott viták</h2>}
          {debates.map((d) => (
          <Link
            key={d.id}
            href={`/debates/${d.id}`}
            className="debate-link"
          >
            <article className="card debate-card">
              <h2>{d.question}</h2>
              <p className="meta">
                {d.category} · {STATUS_LABELS[d.status] ?? d.status}
              </p>
              <p className="hint">Megnyitás →</p>
            </article>
          </Link>
          ))}
        </>
      ) : null}
    </>
  );
}
