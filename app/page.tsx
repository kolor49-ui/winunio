import Link from "next/link";
import { DebateFeed } from "./debate-feed";
import { MyDebatesPreview } from "./my-debates-list";
import { PlatformOverview } from "./platform-overview";
import { SiteQuickNav } from "./site-quick-nav";
import { getSession } from "@/server/api/http";
import {
  isDatabaseConfigError,
  isTransientDbError,
  withDbRetry,
} from "@/server/db";
import { listDebates, listUserDebates } from "@/server/services/debate-service";
import { getUserById } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ account_deleted?: string; sort?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const sort = params.sort === "popular" ? "popular" : "new";

  let debates: Awaited<ReturnType<typeof listDebates>> = [];
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
    debates = await withDbRetry(() => listDebates(sort));
  } catch (error) {
    console.error("HomePage DB error:", error);
    dbConfigError = isDatabaseConfigError(error);
    dbTransientError = isTransientDbError(error);
    dbLoadFailed = true;
  }

  return (
    <div className="page-layout">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Páros vitaplatform</p>
          <h1 className="page-title">
            Két ember. Egy kérdés. Egy vita. Nincs győztes. Mindenki nyer!
          </h1>
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
              <Link href="/login">Jelentkezz be</Link>, ha partnernek szeretnél
              jelentkezni vagy vitát indítani.
            </p>
          )}
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

      <SiteQuickNav user={user} />

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
          <DebateFeed debates={debates} sort={sort} />
        </div>
      </div>

      <PlatformOverview />
    </div>
  );
}
