import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/api/http";

export const metadata: Metadata = {
  title: "Vitát indítok — Winunio",
  description:
    "Vitát indítani fiók kell. Ingyenes regisztráció — te fogalmazod a kérdést és választod ki a vitapartnert.",
};

const DEBATE_START_PATH = "/debates/new";

export default async function VitatInditokPage() {
  const session = await getSession();
  if (session) {
    redirect(DEBATE_START_PATH);
  }

  const next = encodeURIComponent(DEBATE_START_PATH);

  return (
    <div className="page-layout vitat-inditok">
      <header className="page-hero page-hero-compact">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Vitaindító</p>
          <h1 className="page-title">Regisztrálj vagy jelentkezz be</h1>
          <p className="page-lead">
            Vitát indítani fiók kell. Pár perc alatt létrehozhatod — utána
            azonnal megfogalmazhatod a kérdést és közzéteheted a vitát.
          </p>
        </div>
      </header>

      <section className="layout-panel" aria-labelledby="vitat-inditok-why">
        <h2 id="vitat-inditok-why" className="layout-panel-title">
          Miért érdemes?
        </h2>
        <p className="vitat-inditok-intro">
          Regisztráció nélkül olvashatod a vitákat.
        </p>
        <p className="vitat-inditok-body">
          Regisztrációval viszont alakíthatod is őket: kérheted a folytatást,
          saját vitát indíthatsz, vagy vitázóként csatlakozhatsz. Ha a közönség
          újabb fordulókat kér, a szabályosan befejezett vita mindkét
          résztvevőjének növekvő pénzbeli díjazást hozhat.
        </p>
        <p className="vitat-inditok-tagline">
          Ne csak nézd a vitát — légy részese: indíts vitát, csatlakozz
          vitázóként, vagy kérj folytatást!
        </p>
      </section>

      <section className="layout-panel layout-panel-accent">
        <p className="layout-panel-title">Következő lépés</p>
        <p className="hint">
          Új fiók vagy már van belépésed? Mindkét esetben a vitaindító űrlaphoz
          jutsz.
        </p>
        <div className="hiw-cta">
          <Link href={`/register?next=${next}`} className="btn">
            Regisztráció
          </Link>
          <Link href={`/login?next=${next}`} className="btn btn-secondary">
            Bejelentkezés
          </Link>
        </div>
        <p className="hint" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <Link href="/">← Vissza a főoldalra</Link>
          {" · "}
          <Link href="/hogyan-mukodik">Hogyan működik?</Link>
        </p>
      </section>
    </div>
  );
}
