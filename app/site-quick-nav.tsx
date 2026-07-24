import Link from "next/link";

type User = {
  email: string;
  is_admin: boolean;
};

type Props = {
  user: User | null;
};

const NAV_ITEMS = [
  {
    href: "/vitaim",
    label: "Vitáim",
    hint: "Saját viták, meghívások",
    show: "auth",
  },
  {
    href: "/debates/new",
    label: "Vitát indítok",
    hint: "Új vita indítása",
    show: "always",
  },
  {
    href: "/account",
    label: "Fiók",
    hint: "Telepítés, beállítások",
    show: "auth",
  },
  {
    href: "/",
    label: "Főoldal",
    hint: "Nyitott viták, áttekintés",
    show: "auth",
  },
  {
    href: "/login",
    label: "Bejelentkezés",
    hint: "Belépés meglévő fiókkal",
    show: "guest",
  },
  {
    href: "/register",
    label: "Regisztráció",
    hint: "Új fiók létrehozása",
    show: "guest",
  },
] as const;

export function SiteQuickNav({ user }: Props) {
  const items = NAV_ITEMS.filter((item) => {
    if (item.show === "always") return true;
    if (item.show === "auth") return Boolean(user);
    return !user;
  });

  return (
    <nav className="quick-nav" aria-label="Gyors navigáció">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="quick-nav-card">
          <span className="quick-nav-label">{item.label}</span>
          <span className="quick-nav-hint">{item.hint}</span>
        </Link>
      ))}
      {user?.is_admin && (
        <>
          <Link href="/admin" className="quick-nav-card quick-nav-admin">
            <span className="quick-nav-label">Admin</span>
            <span className="quick-nav-hint">Jelentések, értesítések</span>
          </Link>
          <Link href="/admin/moderation" className="quick-nav-card quick-nav-admin">
            <span className="quick-nav-label">Moderáció</span>
            <span className="quick-nav-hint">Emberi felülvizsgálat</span>
          </Link>
        </>
      )}
    </nav>
  );
}
