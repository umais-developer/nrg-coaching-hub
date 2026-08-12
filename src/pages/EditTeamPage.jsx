import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { TEAM_COLOR_OPTIONS, getColorStyles } from "../lib/teamColors";
import { formatDateRange } from "../lib/cohorts";

export default function EditTeamPage() {
  const { teams, cohorts, saveAll, loading } = useTeams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [teamSlug, setTeamSlug] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("teal");
  const [cohort, setCohort] = useState("");

  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sortedTeams = useMemo(
    () => teams.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  );

  // Pre-select from ?slug= (linked from RosterPage), else fall back to the first team
  useEffect(() => {
    const slug = searchParams.get("slug");
    if (slug && teams.length) {
      setTeamSlug(slug);
    } else if (!teamSlug && teams.length) {
      setTeamSlug(sortedTeams[0]?.slug || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  // Populate the form whenever the selected team changes
  useEffect(() => {
    if (!teamSlug) return;
    const t = teams.find((x) => x.slug === teamSlug);
    if (!t) return;
    setName(t.name);
    setColor(t.color || "teal");
    setCohort(t.cohort || "");
    setStatus("");
    setOk(true);
    setDirty(false);
  }, [teamSlug, teams]);

  const currentTeam = teams.find((t) => t.slug === teamSlug) || null;
  const preview = getColorStyles(color);
  const selectedCohort = cohorts.find((c) => c.slug === cohort) || null;

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  const onSave = async () => {
    if (!currentTeam) {
      setStatus("Select a team to edit.");
      setOk(false);
      return;
    }
    if (!name.trim()) {
      setStatus("Team name is required.");
      setOk(false);
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    setOk(false);
    try {
      // The slug is the team's identity and is deliberately preserved — note and
      // upload paths are keyed off it.
      const updatedTeams = teams.map((t) => {
        if (t.slug !== teamSlug) return t;
        // Rebuild without the cohort key so unassigning removes it entirely
        // rather than storing an empty string
        const { cohort: _previous, ...rest } = t;
        return { ...rest, name: name.trim(), color, ...(cohort ? { cohort } : {}) };
      });

      await saveAll({
        teams: updatedTeams,
        message: `chore: update team "${name.trim()}"`,
      });

      setOk(true);
      setStatus(`"${name.trim()}" updated successfully.`);
      setDirty(false);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">✦ Teams</div>
        <h1 style={{ fontSize: "2rem" }}>Edit Team</h1>
        <p className="text-secondary mb-0">
          Update a team's name, color, and cohort assignment. Members are not affected.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-lg-6 animate-in animate-in-2">
          <div className="section-card p-4">
            {status && (
              <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</p>
            )}

            <div className="mb-4">
              <label className="form-label">Team</label>
              {loading ? (
                <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Loading teams…</p>
              ) : sortedTeams.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                  No teams yet. Create one on the Add Team page.
                </p>
              ) : (
                <select
                  className="form-select"
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value)}
                >
                  {sortedTeams.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name} — {(t.members || []).length} members
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentTeam && (
              <>
                <div className="mb-4">
                  <label className="form-label">Team Name</label>
                  <input
                    className="form-control"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                  />
                  <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                    slug: <strong>{currentTeam.slug}</strong> (not editable)
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Team Color</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                    {TEAM_COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setColor(opt.value);
                          markDirty();
                        }}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "999px",
                          border: `2px solid ${color === opt.value ? opt.hex : "transparent"}`,
                          background: `${opt.hex}22`,
                          color: opt.hex,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          outline: "none",
                          transition: "all 150ms ease"
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Cohort</label>
                  <select
                    className="form-select"
                    value={cohort}
                    onChange={(e) => {
                      setCohort(e.target.value);
                      markDirty();
                    }}
                  >
                    <option value="">— Unassigned —</option>
                    {cohorts.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name} ({formatDateRange(c.startDate, c.endDate)})
                      </option>
                    ))}
                  </select>
                  <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                    {cohorts.length === 0
                      ? "No cohorts defined yet — create one on the Cohorts page."
                      : "Unassigned teams appear under \"Unknown\" on the roster."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-primary-brand"
                    type="button"
                    onClick={onSave}
                    disabled={saving || !dirty}
                  >
                    {saving ? "Saving..." : "✓ Save Team To Repository"}
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => navigate("/team-roster")}
                  >
                    Back to Roster
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="col-lg-6 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2
              className="h6 mb-3"
              style={{
                fontFamily: "'Sora',sans-serif",
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.7rem"
              }}
            >
              Preview
            </h2>
            {currentTeam ? (
              <article className="section-card p-3" style={{ borderTop: `3px solid ${preview.border}` }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                    {name || currentTeam.name}
                  </h3>
                  <span className="team-badge" style={{ background: preview.badge, color: preview.text }}>
                    {(currentTeam.members || []).length} members
                  </span>
                </div>
                <div className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-300)" }}>
                  {currentTeam.slug}
                </div>
                <div className="mono mt-2" style={{ fontSize: "0.7rem", color: "var(--ink-500)" }}>
                  {selectedCohort
                    ? `${selectedCohort.name} · ${formatDateRange(selectedCohort.startDate, selectedCohort.endDate)}`
                    : "Unknown cohort"}
                </div>
              </article>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                Select a team to see a preview.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
