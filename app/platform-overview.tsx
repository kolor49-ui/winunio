const READY = [
  "Regisztráció, bejelentkezés, e-mail megerősítés",
  "Vitaindítás, jelentkezés partnernek, meghívás (48h)",
  "Fordulók: A megszólal → B válaszol (72h határidő)",
  "Közönség: értesítés B válaszára, folytatáskérés",
  "Jutalom megjelenítés küszöb után (tesztüzem)",
  "Zárógondolatok, vita lezárása",
  "Jelentés, moderáció, admin panel",
  "AI tartalom-ellenőrzés beküldéskor",
  "Telepíthető webalkalmazás (PWA)",
] as const;

const PLANNED = [
  "Vitaszerkesztő teljes UI (idézet, forrás mezők)",
  "Opcionális helyesírás-ellenőrzés felület",
  "Piszkozat + beillesztésvédelem UI",
] as const;

export function PlatformOverview() {
  return (
    <section className="layout-panel layout-panel-muted">
      <div className="layout-panel-header">
        <h2 className="layout-panel-title">Mi működik most</h2>
        <p className="hint">
          Az alábbi funkciók élesben használhatók. A szürke sorok még csak
          tervezettek — nem hiányoznak a menüből, egyszerűen nincs külön gombjuk.
        </p>
      </div>
      <div className="feature-grid">
        <div className="feature-column">
          <h3 className="feature-column-title">Kész · éles</h3>
          <ul className="feature-list feature-list-ready">
            {READY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="feature-column">
          <h3 className="feature-column-title">Tervezett · UI még nincs</h3>
          <ul className="feature-list feature-list-planned">
            {PLANNED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
