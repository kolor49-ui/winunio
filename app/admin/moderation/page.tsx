"use client";

import { useEffect, useState } from "react";

type ModerationCase = {
  id: string;
  source: string;
  status: string;
  requester_id: string;
  debate_id: string | null;
  reported_text: string;
  content_hash: string;
  policy_version: string;
  ai_issues: Array<{
    excerpt: string;
    category: string;
    rule_reference: string;
    explanation: string;
  }>;
  created_at: string;
};

type ReportRow = {
  id: string;
  reason: string;
  note: string | null;
  debate_id: string | null;
  argument_id: string | null;
  moderation_case_id: string | null;
  created_at: string;
};

export default function AdminModerationPage() {
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<{
    case: ModerationCase;
    content_review: { input_text: string; status: string; issues: unknown[] } | null;
    actions: Array<{ action: string; note: string; created_at: string }>;
  } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadQueues();
  }, []);

  async function loadQueues() {
    setLoading(true);
    setError(null);
    try {
      const [casesRes, reportsRes] = await Promise.all([
        fetch("/api/v1/admin/moderation-cases"),
        fetch("/api/v1/admin/reports"),
      ]);
      if (casesRes.status === 403 || reportsRes.status === 403) {
        setError("Admin jogosultság szükséges.");
        return;
      }
      const casesData = await casesRes.json();
      const reportsData = await reportsRes.json();
      if (!casesRes.ok || !reportsRes.ok) {
        setError("Betöltés sikertelen");
        return;
      }
      setCases(casesData.cases ?? []);
      setReports(reportsData.reports ?? []);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseDetail(caseId: string) {
    setSelectedCase(caseId);
    const res = await fetch(`/api/v1/admin/moderation-cases/${caseId}`);
    const data = await res.json();
    if (res.ok) setCaseDetail(data);
  }

  async function decide(decision: "approve" | "return_for_revision" | "reject") {
    if (!selectedCase || !note.trim()) return;
    const res = await fetch(`/api/v1/admin/moderation-cases/${selectedCase}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: note.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Döntés sikertelen");
      return;
    }
    setNote("");
    setCaseDetail(null);
    setSelectedCase(null);
    await loadQueues();
  }

  async function handleReport(
    reportId: string,
    action: "dismiss" | "hide_content" | "under_review",
  ) {
    if (!note.trim()) {
      setError("Indoklás kötelező.");
      return;
    }
    const res = await fetch(`/api/v1/admin/reports/${reportId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Művelet sikertelen");
      return;
    }
    setNote("");
    await loadQueues();
  }

  if (loading) return <p>Betöltés…</p>;

  return (
    <>
      <h1>Moderáció</h1>
      {error && <p className="error">{error}</p>}

      <div className="admin-grid">
        <section className="card">
          <h2>Felülvizsgálati ügyek ({cases.length})</h2>
          <ul className="admin-list">
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => loadCaseDetail(c.id)}
                >
                  {c.source} · {c.created_at.slice(0, 16)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Jelentések ({reports.length})</h2>
          <ul className="admin-list">
            {reports.map((r) => (
              <li key={r.id}>
                <p>
                  {r.reason} · {r.created_at.slice(0, 16)}
                </p>
                {r.note && <p className="meta">{r.note}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReport(r.id, "dismiss")}
                  >
                    Elutasítás
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReport(r.id, "hide_content")}
                  >
                    Tartalom elrejtése
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReport(r.id, "under_review")}
                  >
                    Vita felülvizsgálatra
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {caseDetail && (
        <section className="card">
          <h2>Ügy részletei</h2>
          <p className="meta">
            Szabályzat: {caseDetail.case.policy_version} · Lenyomat:{" "}
            <code>{caseDetail.case.content_hash.slice(0, 12)}…</code>
          </p>
          <p>{caseDetail.content_review?.input_text ?? caseDetail.case.reported_text}</p>
          {caseDetail.case.ai_issues?.length > 0 && (
            <ul className="content-review-list">
              {caseDetail.case.ai_issues.map((issue, i) => (
                <li key={i}>
                  <strong>„{issue.excerpt}”</strong> — {issue.category}:{" "}
                  {issue.explanation}
                </li>
              ))}
            </ul>
          )}
          <label>
            Indoklás (kötelező)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => decide("approve")}>
              Jóváhagyás
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => decide("return_for_revision")}
            >
              Visszaküldés javításra
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => decide("reject")}
            >
              Elutasítás
            </button>
          </div>
          {caseDetail.actions.length > 0 && (
            <>
              <h3>Korábbi események</h3>
              <ul>
                {caseDetail.actions.map((a, i) => (
                  <li key={i} className="meta">
                    {a.action} — {a.note} ({a.created_at.slice(0, 16)})
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
