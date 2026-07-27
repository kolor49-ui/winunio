import { redirect } from "next/navigation";
import { MyDebatesGrouped } from "../my-debates-list";
import { PlatformOverview } from "../platform-overview";
import { getSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";
import { listUserDebates } from "@/server/services/debate-service";

export const dynamic = "force-dynamic";

export default async function VitaimPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  let user: Awaited<ReturnType<typeof getUserById>> = null;
  try {
    user = await getUserById(session.userId);
  } catch (error) {
    console.error("[vitaim] user load failed:", error);
  }
  if (!user) {
    redirect("/login");
  }

  let myDebates: Awaited<ReturnType<typeof listUserDebates>> = [];
  try {
    myDebates = await listUserDebates(session.userId);
  } catch (error) {
    console.error("[vitaim] debates load failed:", error);
  }

  const actionCount = myDebates.filter(
    (d) =>
      d.application_status === "invited" ||
      (d.involvement === "participant" && d.status === "active") ||
      (d.involvement === "initiator" && d.status === "invitation_pending"),
  ).length;

  return (
    <div className="page-layout">
      <header className="page-hero page-hero-compact">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Saját viták</p>
          <h1 className="page-title">Vitáim</h1>
          <p className="page-lead">
            Viták, amelyeket indítottál, amelyekben részt veszel, vagy amelyekre
            jelentkeztél.
          </p>
          <p className="hint">
            {myDebates.length} vita
            {actionCount > 0 ? ` · ${actionCount} teendő` : ""}
          </p>
        </div>
      </header>

      <MyDebatesGrouped debates={myDebates} />

      <PlatformOverview />
    </div>
  );
}
