import { redirect } from "next/navigation";
import { AccountDeleteForm } from "./account-delete-form";
import { InstallAppButton } from "../install-app-button";
import { PlatformOverview } from "../platform-overview";
import { getSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  let user: Awaited<ReturnType<typeof getUserById>> = null;
  try {
    user = await getUserById(session.userId);
  } catch (error) {
    console.error("[account] user load failed:", error);
  }
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="page-layout">
      <header className="page-hero page-hero-compact">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Beállítások</p>
          <h1 className="page-title">Fiók</h1>
          <p className="page-lead">
            Bejelentkezve: <strong>{user.email}</strong>
          </p>
        </div>
      </header>

      <div className="layout-main">
        <section className="layout-panel">
          <h2 className="layout-panel-title">Telepítés</h2>
          <p className="hint">
            A Winunio logóját hozzáadhatod a telefon kezdőképernyőjéhez vagy a
            számítógép asztalához.
          </p>
          <InstallAppButton />
        </section>

        <section className="layout-panel">
          <h2 className="layout-panel-title">Fiók törlése</h2>
          <AccountDeleteForm />
        </section>
      </div>

      <PlatformOverview />
    </div>
  );
}
