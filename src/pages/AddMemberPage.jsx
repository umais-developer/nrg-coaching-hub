import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { getColorStyles, toSlug } from "../lib/teamColors";
import { saveTextFile } from "../lib/githubAuth";

export default function AddMemberPage() {
  const { teams, allMembers, updateTeams, teamsPath } = useTeams();
  const navigate = useNavigate();

  const [teamSlug, setTeamSlug] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [inProgram, setInProgram] = useState("Yes");
  const [aiKnowledge, setAiKnowledge] = useState("Beginner");
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto-select first team once context finishes loading
  useEffect(() => {
    if (!teamSlug && teams.length) {
      setTeamSlug(teams[0].slug);
    }
  }, [teams, teamSlug]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.slug === teamSlug) || null,
    [teams, teamSlug]
  );
  const memberSlug = toSlug(name);
  const colorStyle = selectedTeam ? getColorStyles(selectedTeam.color) : null;

  const onSave = async () => {
    if (!selectedTeam) {
      setStatus("Select a team.");
      setOk(false);
      return;
    }
    if (!name.trim()) {
      setStatus("Member name is required.");
      setOk(false);
      return;
    }
    if (!memberSlug) {
      setStatus("Could not generate a slug from that name.");
      setOk(false);
      return;
    }
    if (allMembers.some((m) => m.slug === memberSlug)) {
      setStatus(`A member with slug "${memberSlug}" already exists.`);
      setOk(false);
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    try {
      const updatedTeams = teams.map((t) => {
        if (t.slug !== selectedTeam.slug) return t;
        return {
          ...t,
          members: [...(t.members || []), {
            name: name.trim(),
            slug: memberSlug,
            position: position.trim() || undefined,
            location: location.trim() || undefined,
            inProgram,
            aiKnowledge
          }]
        };
      });

      await saveTextFile({
        repoPath: teamsPath,
        text: JSON.stringify({ teams: updatedTeams }, null, 2) + "\n",
        message: `chore: add member "${name.trim()}" to ${selectedTeam.name}`
      });

      // Optimistically update context — no need to re-fetch from GitHub
      updateTeams(updatedTeams);
      setOk(true);
      setStatus(`"${name.trim()}" added to ${selectedTeam.name}!`);
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
      <div className="page-header ph-amber animate-in">
        <div className="page-header-eyebrow">👤 Members</div>
        <h1 style={{ fontSize: "2rem" }}>Add a New Member</h1>
        <p className="text-secondary mb-0">Adds the member to the chosen team in <span className="mono">data/teams.json</span> and commits it.</p>
      </div>

      <div className="row g-3">
        <div className="col-lg-6 animate-in animate-in-2">
          <div className="section-card p-4">
            {status && (
              <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</p>
            )}

            <div className="mb-4">
              <label className="form-label">Team</label>
              {teams.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Loading teams…</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {teams.map((t) => {
                    const s = getColorStyles(t.color);
                    const active = t.slug === teamSlug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => setTeamSlug(t.slug)}
                        style={{
                          padding: "0.4rem 0.85rem",
                          borderRadius: "999px",
                          border: `2px solid ${active ? s.border : "transparent"}`,
                          background: active ? s.badge : "rgba(255,255,255,0.5)",
                          color: active ? s.text : "var(--ink-500)",
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: "0.82rem",
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                          outline: "none",
                          transition: "all 150ms ease"
                        }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label">Member Name</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
              {memberSlug && (
                <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                  slug: <strong>{memberSlug}</strong>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label">Position <span style={{ color: "var(--ink-400)", fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-control"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Sales Representative"
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Location <span style={{ color: "var(--ink-400)", fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-control"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Phoenix, AZ"
              />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-sm-6">
                <label className="form-label">In Program</label>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {["Yes", "No"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setInProgram(opt)}
                      style={{
                        flex: 1,
                        padding: "0.45rem 0",
                        borderRadius: "8px",
                        border: `2px solid ${inProgram === opt ? (opt === "Yes" ? "#0f766e" : "#be185d") : "var(--line)"}`,
                        background: inProgram === opt ? (opt === "Yes" ? "rgba(15,118,110,0.1)" : "rgba(190,24,93,0.1)") : "transparent",
                        color: inProgram === opt ? (opt === "Yes" ? "#0f766e" : "#be185d") : "var(--ink-500)",
                        fontWeight: inProgram === opt ? 700 : 500,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "all 150ms ease"
                      }}
                    >
                      {opt === "Yes" ? "✓ Yes" : "✗ No"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-sm-6">
                <label className="form-label">AI Knowledge</label>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {["Beginner", "Medium", "Expert"].map((level) => {
                    const colors = { Beginner: "#6366f1", Medium: "#f59e0b", Expert: "#10b981" };
                    const active = aiKnowledge === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAiKnowledge(level)}
                        style={{
                          flex: 1,
                          padding: "0.45rem 0",
                          borderRadius: "8px",
                          border: `2px solid ${active ? colors[level] : "var(--line)"}`,
                          background: active ? `${colors[level]}18` : "transparent",
                          color: active ? colors[level] : "var(--ink-500)",
                          fontWeight: active ? 700 : 500,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          transition: "all 150ms ease"
                        }}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary-brand"
              type="button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "✓ Add Member To Repository"}
            </button>
          </div>
        </div>

        <div className="col-lg-6 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>Preview</h2>

            {selectedTeam && colorStyle ? (
              <article className="section-card p-3 mb-3" style={{ borderTop: `3px solid ${colorStyle.border}` }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>{selectedTeam.name}</h3>
                  <span className="team-badge" style={{ background: colorStyle.badge, color: colorStyle.text }}>
                    {(selectedTeam.members?.length || 0) + (name.trim() ? 1 : 0)} members
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {(selectedTeam.members || []).map((m) => (
                    <span key={m.slug} className="member-chip">{m.name}</span>
                  ))}
                  {name.trim() && (
                    <span
                      className="member-chip"
                      style={{ background: colorStyle.badge, borderColor: colorStyle.border, color: colorStyle.text, fontWeight: 700 }}
                    >
                      {name} ✦ new
                    </span>
                  )}
                </div>
              </article>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Select a team to see a preview.</p>
            )}

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
              <p className="mb-0 mono" style={{ fontSize: "0.7rem", color: "var(--ink-400)" }}>
                File: <span style={{ color: "var(--ink-600)" }}>data/teams.json</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
