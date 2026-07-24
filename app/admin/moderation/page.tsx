"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatContentHash,
  formatIssueCategory,
  formatRuleReference,
} from "../../review-labels";
import {
  formatAdminDateTime,
  formatModerationAction,
  formatModerationCaseStatus,
  formatModerationSource,
  formatReportReason,
} from "../../moderation-labels";

type ModerationCase = {
  id: string;
  source: string;
  status: string;
  requester_id: string;
  debate_id: string | null;
  reported_text: string;
  content_hash: string | null;
  policy_version: string;
  ai_issues: Array<{
    excerpt?: string;
    category?: string;
    rule_reference?: string;
    explanation?: string;
  }> | null;
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

type CaseDetail = {
  case: ModerationCase;
  content_review: { input_text: string; status: string; issues: unknown[] } | null;
  actions: Array<{ action: string; note: string; created_at: string }>;
};

export default function AdminModerationPage() {
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
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
    setCaseLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/moderation-cases/${caseId}`);
      const data = await res.json();
      if (!res.ok || !data?.case) {
        setCaseDetail(null);
        setError(data.error?.message ?? "Ügy betöltése sikertelen");
        return;
      }
      setCaseDetail(data as CaseDetail);
    } catch {
      setCaseDetail(null);
      setError("Hálózati hiba az ügy betöltésekor");
    } finally {
      setCaseLoading(false);
    }
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

  const issues = Array.isArray(caseDetail?.case?.ai_issues)
    ? caseDetail.case.ai_issues
    : [];

  return (
    <>
      <h1>Moderáció</h1>
      <p className="hint">
        <Link href="/admin">Admin áttekintés</Link>
      </p>
      {error && <p className="error">{error}</p>}

      <div className="admin-grid">
        <section className="card">
          <h2>Felülvizsgálati ügyek ({cases.length})</h2>
          <ul className="admin-list">
            {cases.length === 0 && (
              <li className="meta">Nincs nyitott felülvizsgálati ügy.</li>
            )}
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void loadCaseDetail(c.id)}
                >
                  {formatModerationSource(c.source)} ·{" "}
                  {formatModerationCaseStatus(c.status)} ·{" "}
                  {formatAdminDateTime(c.created_at)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Jelentések ({reports.length})</h2>
          <ul className="admin-list">
            {reports.length === 0 && (
              <li className="meta">Nincs nyitott jelentés.</li>
            )}
            {reports.map((r) => (
              <li key={r.id}>
                <p>
                  {formatReportReason(r.reason)} · {formatAdminDateTime(r.created_at)}
                </p>
                {r.note && <p className="meta">{r.note}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleReport(r.id, "dismiss")}
                  >
                    Elutasítás
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleReport(r.id, "hide_content")}
                  >
                    Tartalom elrejtése
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleReport(r.id, "under_review")}
                  >
                    Vita felülvizsgálatra
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {caseLoading && <p className="hint">Ügy betöltése…</p>}

      {caseDetail && !caseLoading && (
        <section className="card">
          <h2>Ügy részletei</h2>
          <p className="meta">
            Forrás: {formatModerationSource(caseDetail.case.source)} · Állapot:{" "}
            {formatModerationCaseStatus(caseDetail.case.status)} · Szabályzat:{" "}
            {caseDetail.case.policy_version} · Lenyomat:{" "}
            <code>{formatContentHash(caseDetail.case.content_hash)}</code>
          </p>
          <p>{caseDetail.content_review?.input_text ?? caseDetail.case.reported_text}</p>
          {issues.length > 0 && (
            <ul className="content-review-list">
              {issues.map((issue, i) => (
                <li key={i}>
                  <strong>„{issue.excerpt ?? "—"}”</strong> —{" "}
                  {formatIssueCategory(issue.category)} ·{" "}
                  {formatRuleReference(issue.rule_reference)} ·{" "}
                  {issue.explanation ?? ""}
                </li>
              ))}
            </ul>
          )}
          <label>
            Indoklás (kötelező)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => void decide("approve")}>
              Jóváhagyás
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void decide("return_for_revision")}
            >
              Visszaküldés javításra
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void decide("reject")}
            >
              Elutasítás
            </button>
          </div>
          {(caseDetail.actions?.length ?? 0) > 0 && (
            <>
              <h3>Korábbi események</h3>
              <ul>
                {caseDetail.actions.map((a, i) => (
                  <li key={i} className="meta">
                    {formatModerationAction(a.action)} — {a.note} (
                    {formatAdminDateTime(a.created_at)})
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
