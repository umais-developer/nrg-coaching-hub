import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { TEAM_COLOR_OPTIONS, getColorStyles, toSlug } from "../lib/teamColors";
import { saveTextFile } from "../lib/githubAuth";

export default function AddTeamPage() {
  const { teams, updateTeams, teamsPath } = useTeams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [color, setColor] = useState("teal");
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);

  const slug = toSlug(name);
  const preview = getColorStyles(color);

  const onSave = async () => {
    if (!name.trim()) {
      setStatus("Team name is required.");
      setOk(false);
      return;
    }
    if (!slug) {
      setStatus("Could not generate a slug from that name.");
      setOk(false);
      return;
    }
    if (teams.some((t) => t.slug === slug)) {
      setStatus(`A team with slug "${slug}" already exists.`);
      setOk(false);
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    try {
      const updated = {
        teams: [...teams, { name: name.trim(), slug, color, members: [] }]
      };
      await saveTextFile({
        repoPath: teamsPath,
        text: JSON.stringify(updated, null, 2) + "\n",
        message: `chore: add team "${name.trim()}"`
      });
      // Optimistically update context — no need to re-fetch from GitHub
      updateTeams(updated.teams);
      setOk(true);
      setStatus(`Team "${name.trim()}" added!`);
      navigate("/team-roster");
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
        <h1 style={{ fontSize: "2rem" }}>Add a New Team</h1>
        <p className="text-secondary mb-0">Creates an entry in <span className="mono">data/teams.json</span> and commits it to the repository.</p>
      </div>

      <div className="row g-3">
        <div className="col-lg-6 animate-in animate-in-2">
          <div className="section-card p-4">
            {status && (
              <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</p>
            )}

            <div className="mb-4">
              <label className="form-label">Team Name</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Star Team"
              />
              {slug && (
                <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                  slug: <strong>{slug}</strong>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label">Team Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                {TEAM_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
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

            <button
              className="btn btn-primary-brand"
              type="button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "✓ Save Team To Repository"}
            </button>
          </div>
        </div>

        <div className="col-lg-6 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>Preview</h2>
            {name ? (
              <article
                className="section-card p-3"
                style={{ borderTop: `3px solid ${preview.border}` }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                    {name}
                  </h3>
                  <span
                    className="team-badge"
                    style={{ background: preview.badge, color: preview.text }}
                  >
                    0 members
                  </span>
                </div>
                <div className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-300)" }}>{slug}</div>
              </article>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Enter a team name to see a preview.</p>
            )}

            <div style={{ borderTop: "1px solid var(--line)", marginTop: "1.5rem", paddingTop: "1rem" }}>
              <h3 className="h6 mb-2" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>Existing teams</h3>
              {teams.map((t) => {
                const s = getColorStyles(t.color);
                return (
                  <div key={t.slug} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span className="team-badge" style={{ background: s.badge, color: s.text }}>{t.name}</span>
                    <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-300)" }}>{t.members?.length || 0} members</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
