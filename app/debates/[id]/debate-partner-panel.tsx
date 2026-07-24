"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ContentReviewFeedback,
  extractContentReviewIssues,
  extractContentReviewStatus,
  type ContentReviewIssue,
  type ContentReviewStatus,
} from "../../content-review-feedback";

type Application = {
  id: string;
  stance: string;
  status: string;
  applicant_label: string;
  invitation_expires_at: string | null;
};

type MyApplication = {
  id: string;
  stance: string;
  status: string;
  invitation_expires_at: string | null;
};

type Props = {
  debateId: string;
  debateStatus: string;
  initiatorId: string;
  viewerUserId: string | null;
  isInitiator: boolean;
  pendingInvitation: {
    id: string;
    invitation_expires_at: string | null;
    invitee_user_id: string;
  } | null;
  initialApplications: Application[];
  myApplication: MyApplication | null;
};

export function DebatePartnerPanel({
  debateId,
  debateStatus,
  initiatorId,
  viewerUserId,
  isInitiator,
  pendingInvitation,
  initialApplications,
  myApplication,
}: Props) {
  const router = useRouter();
  const [mine, setMine] = useState(myApplication);
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<ContentReviewStatus | null>(
    null,
  );
  const [loading, setLoading] = useState<string | null>(null);

  const isInvitee =
    pendingInvitation &&
    viewerUserId &&
    pendingInvitation.invitee_user_id === viewerUserId;

  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewerUserId) {
      setError("Előbb jelentkezz be.");
      return;
    }
    setError(null);
    setReviewIssues(null);
    setReviewStatus(null);
    setLoading("apply");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/debates/${debateId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stance: form.get("stance") }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = extractContentReviewIssues(data);
        if (issues) {
          setReviewIssues(issues);
          setReviewStatus(
            extractContentReviewStatus(data) ?? "revision_required",
          );
        }
        setError(data.error?.message ?? "Jelentkezés sikertelen");
        return;
      }
      setMine(data.application);
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function selectPartner(applicationId: string) {
    setError(null);
    setLoading(`select-${applicationId}`);
    try {
      const res = await fetch(`/api/v1/debates/${debateId}/select-partner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Meghívás sikertelen");
        return;
      }
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function acceptInvitation() {
    if (!mine) return;
    setError(null);
    setLoading("accept");
    try {
      const res = await fetch(`/api/v1/invitations/${mine.id}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Elfogadás sikertelen");
        return;
      }
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function rejectInvitation() {
    if (!mine) return;
    setError(null);
    setLoading("reject");
    try {
      const res = await fetch(`/api/v1/invitations/${mine.id}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Elutasítás sikertelen");
        return;
      }
      setMine({ ...mine, status: "rejected" });
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function withdraw() {
    if (!mine) return;
    setError(null);
    setLoading("withdraw");
    try {
      const res = await fetch(`/api/v1/applications/${mine.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Visszavonás sikertelen");
        return;
      }
      setMine(null);
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  if (debateStatus === "waiting_for_partner") {
    if (isInitiator) {
      return (
        <div className="card">
          <h2>Jelentkezők</h2>
          {initialApplications.length === 0 ? (
            <p className="hint">Még nincs jelentkező — várakozás partnerre.</p>
          ) : (
            <ul className="application-list">
              {initialApplications.map((app) => (
                <li key={app.id} className="application-item">
                  <p className="meta">{app.applicant_label}</p>
                  <p>{app.stance}</p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={loading === `select-${app.id}`}
                    onClick={() => selectPartner(app.id)}
                  >
                    {loading === `select-${app.id}`
                      ? "Meghívás…"
                      : "Meghívás partnernek"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      );
    }

    if (viewerUserId === initiatorId) return null;

    if (mine?.status === "pending") {
      return (
        <div className="card">
          <h2>Jelentkezésed</h2>
          <p>{mine.stance}</p>
          <p className="hint">Várakozás a vitaindító döntésére.</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading === "withdraw"}
            onClick={withdraw}
          >
            {loading === "withdraw" ? "…" : "Jelentkezés visszavonása"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      );
    }

    if (!viewerUserId) {
      return (
        <div className="card">
          <p className="hint">
            <a href="/login">Jelentkezz be</a>, ha partnernek szeretnél jelentkezni.
          </p>
        </div>
      );
    }

    return (
      <div className="card">
        <h2>Partnernek jelentkezem</h2>
        <form className="form" onSubmit={apply}>
          <label>
            Rövid álláspontod (B oldal)
            <textarea name="stance" required maxLength={2000} />
          </label>
          {reviewIssues && reviewStatus && (
            <ContentReviewFeedback issues={reviewIssues} status={reviewStatus} />
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={loading === "apply"}>
            {loading === "apply" ? "Küldés…" : "Jelentkezés"}
          </button>
        </form>
      </div>
    );
  }

  if (debateStatus === "invitation_pending" && isInvitee && mine?.status === "invited") {
    return (
      <div className="card">
        <h2>Meghívás partnernek</h2>
        <p>A vitaindító téged választott partnernek.</p>
        {mine.invitation_expires_at && (
          <p className="hint">
            Lejárat:{" "}
            {new Date(mine.invitation_expires_at).toLocaleString("hu-HU")}
          </p>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={loading === "accept"}
            onClick={acceptInvitation}
          >
            {loading === "accept" ? "…" : "Elfogadom"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading === "reject"}
            onClick={rejectInvitation}
          >
            {loading === "reject" ? "…" : "Elutasítom"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (debateStatus === "invitation_pending" && isInitiator) {
    return (
      <div className="card">
        <h2>Meghívás elküldve</h2>
        <p className="hint">
          Várakozás a jelentkező válaszára (max. 48 óra).
        </p>
        {pendingInvitation?.invitation_expires_at && (
          <p className="hint">
            Lejárat:{" "}
            {new Date(pendingInvitation.invitation_expires_at).toLocaleString(
              "hu-HU",
            )}
          </p>
        )}
      </div>
    );
  }

  return null;
}
