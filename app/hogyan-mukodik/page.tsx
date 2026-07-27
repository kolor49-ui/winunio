import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hogyan működik — Winunio",
  description:
    "Két ember, egy kérdés — a közönség folytatást kérhet, nem szavaz. Rövid útmutató a viták menetéről és a jutalomról.",
};

const STEPS = [
  {
    title: "Vitát indítasz",
    text: "Megfogalmazod a kérdést és a kiinduló álláspontodat, majd közzéteszed.",
  },
  {
    title: "Partnert választasz",
    text: "A jelentkezők közül te döntesz — a platform nem rangsorol senkit.",
  },
  {
    title: "A és B fordulókban",
    text: "Előbb A megszólal, utána B válaszol. Aszinkron, fordulónként 72 óra.",
  },
  {
    title: "Zárógondolatok",
    text: "A vita végén mindkét fél rövid zárást ír — egyidejűleg jelennek meg.",
  },
] as const;

const REWARD_PHASES = [
  {
    label: "Küszöb előtt",
    text: "Nincs összeg a képernyőn — nem mutatunk nullát sem.",
  },
  {
    label: "Küszöb elérve",
    text: "Megjelenik a függő jutalom (pl. 4 000 Ft / résztvevő).",
  },
  {
    label: "Vita lezárva",
    text: "Mindkét résztvevő azonos, kifizethető (tesztüzem) összeget kap.",
  },
] as const;

const THRESHOLDS = [
  { round: "2. forduló", requests: "25 kérés", reward: "1 000 Ft" },
  { round: "3. forduló", requests: "50 kérés", reward: "2 000 Ft" },
  { round: "4. forduló", requests: "100 kérés", reward: "4 000 Ft" },
  { round: "5. forduló", requests: "250 kérés", reward: "8 000 Ft" },
  { round: "6. forduló", requests: "500 kérés", reward: "12 000 Ft" },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="page-layout how-it-works">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Útmutató</p>
          <h1 className="page-title">Hogyan működik a Winunio?</h1>
          <p className="page-lead">
            Két ember vitázik egy kérdés körül. Nincs győztes és nincs vesztes —
            a közönség nem szavaz senkire, csak folytatást kérhet. Mindkét
            vitázó <strong>azonos</strong> jutalmat kap, ha a vita szabályosan
            lezárul.
          </p>
        </div>
      </header>

      <section className="layout-panel hiw-steps" aria-labelledby="hiw-steps-title">
        <h2 id="hiw-steps-title" className="layout-panel-title">
          Négy lépés
        </h2>
        <ol className="hiw-step-list">
          {STEPS.map((step, index) => (
            <li key={step.title} className="hiw-step-item">
              <span className="hiw-step-num" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="hiw-step-title">{step.title}</h3>
                <p className="hiw-step-text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="hint hiw-step-note">
          Az 1. forduló a partner elfogadása után automatikusan indul — hozzá
          folytatáskérés nem kell.
        </p>
      </section>

      <section className="hiw-ab-grid" aria-labelledby="hiw-ab-title">
        <h2 id="hiw-ab-title" className="hiw-section-title">
          A mindig bal, B mindig jobb
        </h2>
        <p className="hiw-section-lead">
          A színek azonosítanak, de nem minősítenek. Egy fordulóban először A
          szövege látszik, majd B válasza — nem jelennek meg egyszerre.
        </p>
        <div className="hiw-ab-cards">
          <article className="hiw-ab-card hiw-ab-card-a">
            <p className="hiw-ab-label">A — bal oldal</p>
            <p className="hiw-ab-sample">
              „Szerintem a döntés helytelen volt, mert…”
            </p>
          </article>
          <div className="hiw-ab-arrow" aria-hidden="true">
            →
          </div>
          <article className="hiw-ab-card hiw-ab-card-b">
            <p className="hiw-ab-label">B — jobb oldal</p>
            <p className="hiw-ab-sample">
              „Ezzel nem értek egyet, mert…”
            </p>
          </article>
        </div>
      </section>

      <section
        className="layout-panel hiw-continuation"
        aria-labelledby="hiw-continuation-title"
      >
        <h2 id="hiw-continuation-title" className="layout-panel-title">
          Folytatáskérés — nem szavazás
        </h2>
        <p className="hiw-section-lead">
          Egy lezárt, kétoldalú forduló után a közönség kérheti a folytatást.
          Egy fiók <strong>egyszer</strong> kérhet folytatást egy adott fordulóra
          — ez nem A vagy B támogatása.
        </p>
        <div className="hiw-continuation-demo">
          <button type="button" className="btn hiw-continuation-btn" disabled>
            KÉREM A FOLYTATÁST
          </button>
          <p className="hiw-continuation-counter">
            38 ember kéri a folytatást. Még 12 kérés szükséges.
          </p>
        </div>
      </section>

      <section className="layout-panel hiw-reward" aria-labelledby="hiw-reward-title">
        <h2 id="hiw-reward-title" className="layout-panel-title">
          Jutalom — közösen teljesített vitáért
        </h2>
        <p className="hiw-section-lead">
          A pénz nem „nyeremény”: mindkét résztvevő ugyanannyit kap, ha a vita
          szabályosan lezárul. A jutalmi szint és a következő forduló küszöbe
          együtt jár.
        </p>

        <ol className="hiw-reward-phases">
          {REWARD_PHASES.map((phase, index) => (
            <li key={phase.label} className="hiw-reward-phase">
              {index > 0 && (
                <span className="hiw-reward-connector" aria-hidden="true">
                  →
                </span>
              )}
              <div className="hiw-reward-phase-card">
                <h3 className="hiw-reward-phase-label">{phase.label}</h3>
                <p className="hiw-reward-phase-text">{phase.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="hiw-threshold-table-wrap">
          <table className="hiw-threshold-table">
            <caption className="hiw-table-caption">
              Példa küszöbök és jutalmak (konfigurálható, csak új vitákra)
            </caption>
            <thead>
              <tr>
                <th scope="col">Következő forduló</th>
                <th scope="col">Szükséges folytatáskérés</th>
                <th scope="col">Jutalom / résztvevő</th>
              </tr>
            </thead>
            <tbody>
              {THRESHOLDS.map((row) => (
                <tr key={row.round}>
                  <td>{row.round}</td>
                  <td>{row.requests}</td>
                  <td>{row.reward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="hint hiw-reward-disclaimer">
          Tesztüzem — a megjelenített összeg szimuláció, nem kerül
          kifizetésre.
        </p>
      </section>

      <section className="layout-panel layout-panel-muted hiw-not" aria-labelledby="hiw-not-title">
        <h2 id="hiw-not-title" className="layout-panel-title">
          Amit nem csinál a Winunio
        </h2>
        <ul className="hiw-not-list">
          <li>Nem jelöl ki győztest vagy veszest.</li>
          <li>Nem szavazhatsz A-ra vagy B-re — csak folytatást kérhetsz.</li>
          <li>Nem rangsorol vitázókat közönség-szám alapján.</li>
          <li>Nem mutat jutalmat a küszöb elérése előtt.</li>
        </ul>
      </section>

      <footer className="hiw-cta">
        <Link href="/" className="btn">
          Viták böngészése
        </Link>
        <Link href="/debates/new" className="btn btn-secondary">
          Vitát indítok
        </Link>
      </footer>
    </div>
  );
}
