import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import { APP_CONFIG } from "../config";
import { saveTextFile, getToken } from "../lib/githubAuth";
import { WORKSHOPS } from "../data/workshopsData";
import {
  COHORT_STATUS_LABELS,
  buildSchedule,
  formatDate,
  formatDateRange,
  getCohortStatus,
  parseOutcomes,
} from "../lib/cohorts";

const STATUS_COLORS = { upcoming: "#0284c7", active: "#16a34a", completed: "#6b7280" };

async function loadSchedule(coachUsername) {
  const { TARGET_REPO, TARGET_BRANCH } = APP_CONFIG;
  const url = `https://api.github.com/repos/${TARGET_REPO}/contents/coaches/${coachUsername}/schedule.json?ref=${encodeURIComponent(TARGET_BRANCH)}`;
  const token = getToken();
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = decodeURIComponent(escape(atob((data.content || "").replace(/\n/g, ""))));
  return JSON.parse(text);
}

export default function WorkshopsPage() {
  const { coachUsername } = useAuth();
  const { cohorts, loading: teamsLoading } = useTeams();

  // Whole schedule file: { schedules: { <cohortSlug>: { sessions: [...] } },
  // workshopDates: [...] }  — workshopDates is the legacy coach-wide value,
  // preserved so previously saved dates keep working as a fallback.
  const [file, setFile] = useState(null);
  const [cohortSlug, setCohortSlug] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    if (!coachUsername) return;
    loadSchedule(coachUsername)
      .then((data) => setFile(data || {}))
      .catch(() => setFile({}));
  }, [coachUsername]);

  // Default to the active cohort, else the first one
  useEffect(() => {
    if (cohortSlug || !cohorts.length) return;
    const active = cohorts.find((c) => getCohortStatus(c) === "active");
    setCohortSlug((active || cohorts[0]).slug);
  }, [cohorts, cohortSlug]);

  const cohort = useMemo(
    () => cohorts.find((c) => c.slug === cohortSlug) || null,
    [cohorts, cohortSlug]
  );

  const savedForCohort = file?.schedules?.[cohortSlug] || null;
  const hasSavedSchedule = Boolean(savedForCohort?.sessions?.length);

  // The sessions currently displayed: saved schedule, or the template with
  // dates spread across this cohort's window
  const sessions = useMemo(
    () =>
      buildSchedule({
        template: WORKSHOPS,
        saved: savedForCohort || { workshopDates: file?.workshopDates },
        cohort,
      }),
    [savedForCohort, file, cohort]
  );

  // Leave edit mode if the cohort changes mid-edit
  useEffect(() => {
    setEditing(false);
    setSaveStatus("");
  }, [cohortSlug]);

  const startEditing = () => {
    setDraft(sessions.map((s) => ({ ...s, outcomesText: (s.outcomes || []).join(", ") })));
    setEditing(true);
  };

  const updateDraft = (idx, patch) =>
    setDraft((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const onSave = async () => {
    if (!cohort) {
      setSaveStatus("Select a cohort first.");
      return;
    }
    setSaving(true);
    setSaveStatus("Saving...");
    try {
      const nextSessions = draft.map((s) => ({
        date: s.date,
        title: s.title.trim(),
        focus: s.focus.trim(),
        outcomes: parseOutcomes(s.outcomesText),
      }));
      // Merge into the existing file so other cohorts' schedules survive
      const nextFile = {
        ...(file || {}),
        schedules: {
          ...(file?.schedules || {}),
          [cohortSlug]: { sessions: nextSessions },
        },
      };
      await saveTextFile({
        repoPath: `coaches/${coachUsername}/schedule.json`,
        text: JSON.stringify(nextFile, null, 2) + "\n",
        message: `chore: update workshop schedule for "${cohort.name}"`,
      });
      setFile(nextFile);
      setEditing(false);
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (e) {
      setSaveStatus(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const status = cohort ? getCohortStatus(cohort) : null;
  const rows = editing ? draft : sessions;

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">🗓️ Schedule</div>
        <h1 style={{ fontSize: "2rem" }}>Workshop Sessions</h1>
        <p className="text-secondary mb-0">
          Each cohort runs its own {WORKSHOPS.length} sessions — dates, titles, and focus can differ.
        </p>
      </div>

      <div className="row g-3 mb-4 align-items-end animate-in animate-in-2">
        <div className="col-md-7 col-lg-5">
          <label className="form-label">Cohort</label>
          <select
            className="form-select"
            value={cohortSlug}
            onChange={(e) => setCohortSlug(e.target.value)}
            disabled={editing || !cohorts.length}
          >
            {cohorts.length === 0 ? (
              <option value="">No cohorts defined yet</option>
            ) : (
              cohorts.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({formatDateRange(c.startDate, c.endDate)})
                </option>
              ))
            )}
          </select>
        </div>
        {cohort && (
          <div className="col-md-auto">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {status && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.45rem",
                    borderRadius: "999px",
                    background: `${STATUS_COLORS[status]}18`,
                    color: STATUS_COLORS[status],
                    letterSpacing: "0.02em",
                  }}
                >
                  {COHORT_STATUS_LABELS[status]}
                </span>
              )}
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                {hasSavedSchedule ? "Saved schedule" : "Suggested dates — not saved yet"}
              </span>
            </div>
          </div>
        )}
        <div className="col-md-auto ms-md-auto">
          <div className="d-flex align-items-center gap-2">
            {saveStatus && <span className="text-secondary small">{saveStatus}</span>}
            {coachUsername && cohort && (
              editing ? (
                <>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => { setEditing(false); setSaveStatus(""); }}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-sm btn-primary-brand" onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : "Save Schedule"}
                  </button>
                </>
              ) : (
                <button className="btn btn-sm btn-outline-secondary" onClick={startEditing}>
                  ✏️ Edit Schedule
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {teamsLoading ? (
        <p className="text-secondary">Loading…</p>
      ) : cohorts.length === 0 ? (
        <p className="text-secondary">
          No cohorts defined yet. Create one on the Cohorts page to schedule its workshops.
        </p>
      ) : (
        <div className="timeline animate-in animate-in-3">
          {rows.map((ws, idx) => (
            <div className="timeline-item" key={idx}>
              <div className="timeline-dot">{idx + 1}</div>
              <div className="timeline-body">
                {editing ? (
                  <>
                    <input
                      type="date"
                      className="form-control form-control-sm mb-2"
                      style={{ maxWidth: "190px" }}
                      value={ws.date}
                      onChange={(e) => updateDraft(idx, { date: e.target.value })}
                    />
                    <input
                      className="form-control form-control-sm mb-2"
                      value={ws.title}
                      placeholder="Session title"
                      onChange={(e) => updateDraft(idx, { title: e.target.value })}
                    />
                    <input
                      className="form-control form-control-sm mb-2"
                      value={ws.focus}
                      placeholder="Session focus"
                      onChange={(e) => updateDraft(idx, { focus: e.target.value })}
                    />
                    <input
                      className="form-control form-control-sm mb-1"
                      value={ws.outcomesText}
                      placeholder="Outcome 1, Outcome 2, Outcome 3"
                      onChange={(e) => updateDraft(idx, { outcomesText: e.target.value })}
                    />
                    <div className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-300)" }}>
                      comma-separated outcomes
                    </div>
                  </>
                ) : (
                  <>
                    <div className="timeline-date">{formatDate(ws.date)}</div>
                    <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.3rem" }}>{ws.title}</h2>
                    <p style={{ fontSize: "0.9rem", color: "var(--ink-700)", fontWeight: 500, marginBottom: "0.75rem" }}>{ws.focus}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {(ws.outcomes || []).map((outcome) => (
                        <span key={outcome} style={{
                          display: "inline-block",
                          padding: "0.22rem 0.6rem",
                          borderRadius: "999px",
                          background: "var(--brand-soft)",
                          color: "var(--brand-strong)",
                          fontSize: "0.75rem",
                          fontWeight: 600
                        }}>{outcome}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
