import { redirect } from "next/navigation";
import { AccountDeleteForm } from "./account-delete-form";
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
      <AccountDeleteForm />
    </>
  );
}
