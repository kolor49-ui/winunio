import Link from "next/link";
import { DebateBucketList } from "../../debate-bucket-list";
import { getSession } from "@/server/api/http";
import {
  isDatabaseConfigError,
  isTransientDbError,
  withDbRetry,
} from "@/server/db";
import { listDebatesByBucket } from "@/server/services/debate-service";

export const dynamic = "force-dynamic";

export default async function PartnerreVarVitakPage() {
  const session = await getSession();

  let debates: Awaited<ReturnType<typeof listDebatesByBucket>> = [];
  let dbConfigError = false;
  let dbTransientError = false;

  try {
    debates = await withDbRetry(() => listDebatesByBucket("open", "new"));
  } catch (error) {
    console.error("PartnerreVarVitakPage DB error:", error);
    dbConfigError = isDatabaseConfigError(error);
    dbTransientError = isTransientDbError(error);
  }

  if (dbConfigError || dbTransientError) {
    return (
      <div className="page-layout">
        <div className="layout-panel layout-panel-alert">
          <p className="error">
            {dbConfigError
              ? "Szerver hiba: adatbázis nincs beállítva."
              : "Átmeneti hiba: a viták listája most nem tölthető be."}
          </p>
          <p className="hint">
            <Link href="/">Vissza a főoldalra</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <DebateBucketList
      title="Partnerre vár"
      description="Viták, ahol még nincs B oldali partner — jelentkezni lehet (bejelentkezés után)."
      debates={debates}
      variant="open"
      isLoggedIn={Boolean(session?.userId)}
      listBasePath="/vitak/partnerre-var"
      emptyTitle="Most nincs partnerre váró vita."
      emptyHint={
        session?.userId
          ? "Indíts új vitát, ha szeretnél vitaindító lenni."
          : "Jelentkezz be vagy regisztrálj, ha vitát indítanál vagy partnernek jelentkeznél."
      }
    />
  );
}
