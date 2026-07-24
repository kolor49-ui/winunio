import { redirect } from "next/navigation";
import { AccountDeleteForm } from "./account-delete-form";
import { InstallAppButton } from "../install-app-button";
import { getSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await getUserById(session.userId);
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <h1>Fiók beállítások</h1>
      <p className="hint">
        Bejelentkezve: <strong>{user.email}</strong>
      </p>
      <section className="card">
        <h2>Telepítés</h2>
        <p className="hint">
          A Winunio logóját hozzáadhatod a telefon kezdőképernyőjéhez vagy a
          számítógép asztalához.
        </p>
        <InstallAppButton />
      </section>
      <AccountDeleteForm />
    </>
  );
}
