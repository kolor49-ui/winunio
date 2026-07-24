import type { ReactNode } from "react";

type Side = "A" | "B";

export function DebatePair({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `debate-pair ${className}` : "debate-pair"}>
      {children}
    </div>
  );
}

export function DebatePairSide({
  side,
  label,
  children,
  placeholder,
}: {
  side: Side;
  label: string;
  children?: ReactNode;
  placeholder?: string;
}) {
  const badgeClass = side === "A" ? "side-a" : "side-b";
  const colClass = side === "A" ? "debate-pair-a" : "debate-pair-b";

  return (
    <div className={`debate-pair-col ${colClass}`}>
      <p className="debate-pair-label">
        <span className={`side-badge ${badgeClass}`}>{side}</span> {label}
      </p>
      <div className="debate-pair-body">
        {children ??
          (placeholder ? <p className="hint">{placeholder}</p> : null)}
      </div>
    </div>
  );
}
