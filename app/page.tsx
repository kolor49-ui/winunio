import Link from "next/link";
import { DebateFeedSections } from "./debate-feed-sections";
import { MyDebatesPreview } from "./my-debates-list";
import { getSession } from "@/server/api/http";
import {
  isDatabaseConfigError,
  isTransientDbError,
  withDbRetry,
} from "@/server/db";
import {
  listDebatesByBucket,
  listUserDebates,
} from "@/server/services/debate-service";
import { getUserById } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ account_deleted?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  let liveDebates: Awaited<ReturnType<typeof listDebatesByBucket>> = [];
  let openDebates: Awaited<ReturnType<typeof listDebatesByBucket>> = [];
  let dbConfigError = false;
  let dbTransientError = false;
  let dbLoadFailed = false;
  const session = await getSession();
  let user: Awaited<ReturnType<typeof getUserById>> = null;

  if (session) {
    try {
      user = await withDbRetry(() => getUserById(session.userId));
    } catch (error) {
      console.error("HomePage user load failed:", error);
    }
  }

  let myDebates: Awaited<ReturnType<typeof listUserDebates>> = [];
  if (session) {
    try {
      myDebates = await withDbRetry(() => listUserDebates(session.userId));
    } catch (error) {
      console.error("HomePage my debates load failed:", error);
    }
  }

  try {
    [liveDebates, openDebates] = await withDbRetry(async () => {
      const [live, open] = await Promise.all([
        listDebatesByBucket("live", "new"),
        listDebatesByBucket("open", "new"),
      ]);
      return [live, open] as const;
    });
  } catch (error) {
    console.error("HomePage DB error:", error);
    dbConfigError = isDatabaseConfigError(error);
    dbTransientError = isTransientDbError(error);
    dbLoadFailed = true;
  }

  const isLoggedIn = Boolean(user);

  return (
    <div className="page-layout">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Páros vitaplatform</p>
          <h1 className="page-title">Mindenki nyer!</h1>
          <p className="page-lead">
            A közönség nem szavaz vitázóra — csak folytatást kérhet. A viták
            aszinkron fordulókban futnak: A megszólal, majd B válaszol.
          </p>
          {user ? (
            <p className="hint">
              Bejelentkezve: <strong>{user.email}</strong>
            </p>
          ) : (
            <p className="hint">
              Böngéssz nyilvánosan.{" "}
              <Link href="/login">Jelentkezz be</Link>, ha partnernek szeretnél
              jelentkezni vagy vitát indítani.
            </p>
          )}
          <p className="home-hero-jumps hint">
            <a href="#folyamatban">↓ Folyamatban</a>
            {" · "}
            <a href="#partnerre-var">↓ Partnerre vár</a>
          </p>
        </div>
        <div className="page-hero-badges">
          <span className="side-badge side-a">A</span>
          <span className="page-hero-badge-text">bal</span>
          <span className="side-badge side-b">B</span>
          <span className="page-hero-badge-text">jobb</span>
        </div>
      </header>

      {params.account_deleted === "1" && (
        <div className="layout-panel layout-panel-alert">
          <p>
            A fiókod véglegesen törölve lett. Ugyanazzal az e-mail címmel újra
            regisztrálhatsz.
          </p>
        </div>
      )}

      {dbConfigError && (
        <div className="layout-panel layout-panel-alert">
          <p className="error">Szerver hiba: adatbázis nincs beállítva.</p>
          <p className="hint">
            Vercel: állítsd be a <code>DATABASE_URL</code> és{" "}
            <code>AUTH_SECRET</code> env változókat, futtasd a migrációkat, majd
            redeploy.
          </p>
        </div>
      )}

      {(dbTransientError || (dbLoadFailed && !dbConfigError)) && (
        <div className="layout-panel layout-panel-alert">
          <p className="error">
            Átmeneti hiba: a viták listája most nem tölthető be.
          </p>
          <p className="hint">
            <Link href="/">Frissítsd az oldalt</Link> — ha gyakran jelentkezik,
            ellenőrizd, hogy a <code>DATABASE_URL</code> Supabase-nél a
            transaction pooler (:6543), ne a session pooler.
          </p>
        </div>
      )}

      <div className={`layout-main ${user ? "layout-main-with-sidebar" : ""}`}>
        {user && (
          <aside className="layout-sidebar">
            <MyDebatesPreview debates={myDebates} />
          </aside>
        )}
        <div className="layout-content">
          {!dbLoadFailed && !dbConfigError && (
            <DebateFeedSections
              liveDebates={liveDebates}
              openDebates={openDebates}
              isLoggedIn={isLoggedIn}
            />
          )}
        </div>
      </div>
    </div>
  );
}
