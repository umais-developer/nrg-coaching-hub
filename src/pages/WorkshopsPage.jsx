import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { APP_CONFIG } from "../config";
import { saveTextFile } from "../lib/githubAuth";
import { WORKSHOPS } from "../data/workshopsData";

const DEFAULT_DATES = WORKSHOPS.map((w) => w.date);

async function loadSchedule(coachUsername) {
  const { TARGET_REPO, TARGET_BRANCH } = APP_CONFIG;
  const url = `https://api.github.com/repos/${TARGET_REPO}/contents/coaches/${coachUsername}/schedule.json?ref=${encodeURIComponent(TARGET_BRANCH)}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = decodeURIComponent(escape(atob((data.content || "").replace(/\n/g, ""))));
  return JSON.parse(text);
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function WorkshopsPage() {
  const { coachUsername, coachInitials } = useAuth();
  const [dates, setDates] = useState(DEFAULT_DATES);
  const [editing, setEditing] = useState(false);
  const [draftDates, setDraftDates] = useState(DEFAULT_DATES);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    if (!coachUsername) return;
    loadSchedule(coachUsername)
      .then((schedule) => {
        if (schedule?.workshopDates?.length === 6) {
          setDates(schedule.workshopDates);
          setDraftDates(schedule.workshopDates);
        }
      })
      .catch(() => {});
  }, [coachUsername]);

  const onSave = async () => {
    setSaving(true);
    setSaveStatus("Saving...");
    try {
      await saveTextFile({
        repoPath: `coaches/${coachUsername}/schedule.json`,
        text: JSON.stringify({ workshopDates: draftDates }, null, 2) + "\n",
        message: "Update workshop schedule dates"
      });
      setDates(draftDates);
      setEditing(false);
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (e) {
      setSaveStatus(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const podLabel = coachInitials ? `Pod 1A-${coachInitials}` : "Pod 1A";

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">🗓️ Schedule</div>
        <h1 style={{ fontSize: "2rem" }}>Workshop Sessions</h1>
        <p className="text-secondary mb-0">{podLabel} — Six structured sessions from kickoff to retrospective improvement.</p>
      </div>

      {coachUsername && (
        <div className="d-flex justify-content-end align-items-center mb-3 gap-2">
          {saveStatus && <span className="text-secondary small">{saveStatus}</span>}
          {editing ? (
            <>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setEditing(false); setDraftDates(dates); }}
              >
                Cancel
              </button>
              <button className="btn btn-sm btn-primary-brand" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save Dates"}
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(true)}>
              ✏️ Edit Dates
            </button>
          )}
        </div>
      )}

      <div className="timeline animate-in animate-in-2">
        {WORKSHOPS.map((ws, idx) => (
          <div className="timeline-item" key={ws.title}>
            <div className="timeline-dot">{idx + 1}</div>
            <div className="timeline-body">
              {editing ? (
                <input
                  type="date"
                  className="form-control form-control-sm mb-2"
                  style={{ maxWidth: "190px" }}
                  value={draftDates[idx]}
                  onChange={(e) => {
                    const next = [...draftDates];
                    next[idx] = e.target.value;
                    setDraftDates(next);
                  }}
                />
              ) : (
                <div className="timeline-date">{formatDate(dates[idx])}</div>
              )}
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.3rem" }}>{ws.title}</h2>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-700)", fontWeight: 500, marginBottom: "0.75rem" }}>{ws.focus}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {ws.outcomes.map((outcome) => (
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
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
