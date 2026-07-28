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

type Props = {
  searchParams: Promise<{ sort?: string }>;
};

export default async function FolyamatbanVitakPage({ searchParams }: Props) {
  const params = await searchParams;
  const sort = params.sort === "popular" ? "popular" : "new";
  const session = await getSession();

  let debates: Awaited<ReturnType<typeof listDebatesByBucket>> = [];
  let dbConfigError = false;
  let dbTransientError = false;

  try {
    debates = await withDbRetry(() => listDebatesByBucket("live", sort));
  } catch (error) {
    console.error("FolyamatbanVitakPage DB error:", error);
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
      title="Folyamatban zajlik"
      description="Viták, ahol már van vitázó pár vagy indulás előtt áll a vita — olvasás, értesítés, folytatáskérés."
      debates={debates}
      variant="live"
      isLoggedIn={Boolean(session?.userId)}
      sort={sort}
      showSortTabs
      listBasePath="/vitak/folyamatban"
      emptyTitle="Most nincs folyamatban lévő vita."
      emptyHint="Nézd meg a partnerre váró vitákat a főoldalon."
    />
  );
}
