"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ContinuationPanel,
  type ContinuationStatusView,
} from "./continuation-panel";

type NotifyProps = {
  mode: "notify";
  roundId: string;
  viewerUserId: string | null;
};

type ContinuationProps = {
  mode: "continuation";
  initialStatus: ContinuationStatusView;
  viewerUserId: string | null;
};

type Props = NotifyProps | ContinuationProps;

export function AudienceActionBar(props: Props) {
  if (props.mode === "continuation") {
    return (
      <aside
        className="audience-action-bar"
        role="region"
        aria-label="Folytatáskérés"
      >
        <div className="audience-action-bar-inner">
          <p className="audience-action-bar-title">Közönségi művelet</p>
          <ContinuationPanel
            initialStatus={props.initialStatus}
            viewerUserId={props.viewerUserId}
            variant="bar"
          />
        </div>
      </aside>
    );
  }

  return (
    <NotifyBar roundId={props.roundId} viewerUserId={props.viewerUserId} />
  );
}

function NotifyBar({
  roundId,
  viewerUserId,
}: {
  roundId: string;
  viewerUserId: string | null;
}) {
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyInfo, setNotifyInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestBNotification() {
    if (!viewerUserId) return;
    setNotifyLoading(true);
    setNotifyInfo(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/rounds/${roundId}/response-notifications`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Értesítés kérése sikertelen");
        return;
      }
      setNotifyInfo("Értesítünk, amikor B válasza megjelenik.");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setNotifyLoading(false);
    }
  }

  return (
    <aside
      className="audience-action-bar"
      role="region"
      aria-label="Értesítés kérése"
    >
      <div className="audience-action-bar-inner">
        <div className="audience-action-bar-copy">
          <p className="audience-action-bar-title">Közönségi művelet</p>
          <p className="audience-action-bar-text">
            A megszólalás megjelent — B válaszára várunk.
          </p>
          {notifyInfo && <p className="hint">{notifyInfo}</p>}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="audience-action-bar-actions">
          {viewerUserId ? (
            <button
              type="button"
              className="btn btn-secondary audience-action-btn"
              disabled={notifyLoading}
              onClick={() => void requestBNotification()}
            >
              {notifyLoading ? "Kérés…" : "Értesítést kérek B válaszáról"}
            </button>
          ) : (
            <Link href="/login" className="btn btn-secondary audience-action-btn">
              Jelentkezz be az értesítéshez
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
