import { redirect } from "next/navigation";
import { getSession } from "@/server/api/http";

export default async function DebateNewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) {
    redirect("/vitat-inditok");
  }

  return children;
}
