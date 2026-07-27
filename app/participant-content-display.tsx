import { parseFormattedParticipantContent } from "@/server/content-editor";

function isExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Props = {
  content: string;
  className?: string;
};

export function ParticipantContentDisplay({ content, className }: Props) {
  const parsed = parseFormattedParticipantContent(content);

  return (
    <div className={className ? `participant-content ${className}` : "participant-content"}>
      <p className="participant-content-reasoning">{parsed.reasoning}</p>
      {parsed.quote && (
        <blockquote className="participant-content-quote">
          <p className="participant-content-quote-label">Idézet</p>
          <p className="participant-content-quote-text">{parsed.quote}</p>
        </blockquote>
      )}
      {parsed.source && (
        <p className="participant-content-source">
          <span className="participant-content-source-label">Forrás:</span>{" "}
          {isExternalUrl(parsed.source) ? (
            <a
              href={parsed.source}
              target="_blank"
              rel="noopener noreferrer"
              className="participant-content-source-link"
            >
              {parsed.source}
            </a>
          ) : (
            parsed.source
          )}
        </p>
      )}
    </div>
  );
}
