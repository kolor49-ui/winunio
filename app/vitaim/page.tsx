import { redirect } from "next/navigation";
import { MyDebatesList } from "../my-debates-list";
import { getSession } from "@/server/api/http";
import { listUserDebates } from "@/server/services/debate-service";

export const dynamic = "force-dynamic";

export default async function VitaimPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  let myDebates: Awaited<ReturnType<typeof listUserDebates>> = [];
  try {
    myDebates = await listUserDebates(session.userId);
  } catch (error) {
    console.error("[vitaim] debates load failed:", error);
  }

  return (
    <>
      <h1>Vitáim</h1>
      <p className="hint">
        Viták, amelyeket indítottál, amelyekben részt veszel, vagy amelyekre
        jelentkeztél.
      </p>
      <MyDebatesList debates={myDebates} showEmpty standalone />
    </>
  );
}
