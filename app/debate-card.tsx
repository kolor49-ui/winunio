import Link from "next/link";
import { DebateStatusPill } from "./debate-status-pill";
import type { DebateListItem } from "@/server/services/debate-service";

type Props = {
  debate: DebateListItem;
  variant?: "live" | "open";
  isLoggedIn?: boolean;
};

function DebateCardBody({
  debate,
  variant,
  ctaLabel,
}: {
  debate: DebateListItem;
  variant: "live" | "open";
  ctaLabel: string;
}) {
  return (
    <>
      <div className="debate-card-head">
        {variant === "live" ? (
          <span className="debate-card-sides" aria-hidden="true">
            <span className="side-badge side-a">A</span>
            <span className="side-badge side-b">B</span>
          </span>
        ) : null}
        <DebateStatusPill status={debate.status} />
        <span className="meta">{debate.category}</span>
      </div>
      <h3 className="debate-card-title">{debate.question}</h3>
      {variant === "open" ? (
        <p className="hint debate-card-hint">
          A vitaindító még partnert keres (B oldal). Olvasás ingyenes; jelentkezéshez
          kell fiók.
        </p>
      ) : null}
      {debate.continuation_count_7d !== undefined &&
        debate.continuation_count_7d > 0 && (
          <p className="hint">
            {debate.continuation_count_7d} folytatáskérés (7 nap)
          </p>
        )}
      <p className="debate-card-cta">{ctaLabel}</p>
    </>
  );
}

export function DebateCard({
  debate,
  variant = "live",
  isLoggedIn = false,
}: Props) {
  const debateHref = `/debates/${debate.id}`;
  const loginHref = `/login?next=${encodeURIComponent(debateHref)}`;

  if (variant === "open" && !isLoggedIn) {
    return (
      <article className="debate-card debate-card-open">
        <DebateCardBody
          debate={debate}
          variant={variant}
          ctaLabel="Vita megnyitása"
        />
        <div className="debate-card-actions">
          <Link href={debateHref} className="btn btn-secondary btn-sm">
            Vita megnyitása
          </Link>
          <Link href={loginHref} className="btn btn-secondary btn-sm">
            Bejelentkezés jelentkezéshez
          </Link>
        </div>
      </article>
    );
  }

  const ctaLabel =
    variant === "open" ? "Vita megnyitása →" : "Vitát olvasom →";

  return (
    <Link href={debateHref} className="debate-link">
      <article
        className={`debate-card${variant === "open" ? " debate-card-open" : ""}`}
      >
        <DebateCardBody debate={debate} variant={variant} ctaLabel={ctaLabel} />
      </article>
    </Link>
  );
}

export type { DebateListItem };
