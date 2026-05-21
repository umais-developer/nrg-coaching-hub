import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { getColorStyles, toSlug } from "../lib/teamColors";
import { saveTextFile } from "../lib/githubAuth";

const AI_COLORS = { Beginner: "#6366f1", Medium: "#f59e0b", Expert: "#10b981" };

export default function EditMemberPage() {
  const { teams, allMembers, updateTeams, teamsPath } = useTeams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form state
  const [memberSlug, setMemberSlug] = useState("");
  const [name, setName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [inProgram, setInProgram] = useState("Yes");
  const [aiKnowledge, setAiKnowledge] = useState("Beginner");

  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sortedMembers = useMemo(
    () => allMembers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allMembers]
  );

  // Pre-select from ?slug= query param (linked from RosterPage)
  useEffect(() => {
    const slug = searchParams.get("slug");
    if (slug && allMembers.length) {
      setMemberSlug(slug);
    } else if (!memberSlug && allMembers.length) {
      setMemberSlug(allMembers[0]?.slug || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMembers]);

  // Populate form when a member is selected
  useEffect(() => {
    if (!memberSlug) return;
    const m = allMembers.find((x) => x.slug === memberSlug);
    if (!m) return;
    setName(m.name);
    setTeamSlug(m.teamSlug || "");
    setPosition(m.position || "");
    setLocation(m.location || "");
    setWorkingHours(m.workingHours || "");
    setInProgram(m.inProgram || "Yes");
    setAiKnowledge(m.aiKnowledge || "Beginner");
    setStatus("");
    setOk(true);
    setDirty(false);
  }, [memberSlug, allMembers]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.slug === teamSlug) || null,
    [teams, teamSlug]
  );
  const colorStyle = selectedTeam ? getColorStyles(selectedTeam.color) : null;
  const currentMember = allMembers.find((m) => m.slug === memberSlug) || null;

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  const onSave = async () => {
    if (!currentMember) {
      setStatus("Select a member to edit.");
      setOk(false);
      return;
    }
    if (!name.trim()) {
      setStatus("Member name is required.");
      setOk(false);
      return;
    }
    if (!selectedTeam) {
      setStatus("Select a team.");
      setOk(false);
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    setOk(false);

    try {
      const updatedTeams = teams.map((t) => {
        // Remove this member from every team first
        const withoutMember = (t.members || []).filter((m) => m.slug !== memberSlug);
        if (t.slug !== teamSlug) {
          // Not the target team — just return with member removed (handles team change)
          return withoutMember.length !== (t.members || []).length
            ? { ...t, members: withoutMember }
            : t;
        }
        // Target team — add updated member
        const updatedMember = {
          name: name.trim(),
          slug: memberSlug,
          ...(position.trim() ? { position: position.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(workingHours.trim() ? { workingHours: workingHours.trim() } : {}),
          inProgram,
          aiKnowledge,
        };
        return { ...t, members: [...withoutMember, updatedMember] };
      });

      await saveTextFile({
        repoPath: teamsPath,
        text: JSON.stringify({ teams: updatedTeams }, null, 2) + "\n",
        message: `chore: update member "${name.trim()}"`,
      });

      updateTeams(updatedTeams);
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
      <div className="page-header ph-amber animate-in">
        <div className="page-header-eyebrow">✏️ Members</div>
        <h1 style={{ fontSize: "2rem" }}>Edit Member</h1>
        <p className="text-secondary mb-0">
          Update a team member's details. Changes are committed to the repository instantly.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-lg-6 animate-in animate-in-2">
          <div className="section-card p-4">
            {status && (
              <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>
                {status}
              </p>
            )}

            {/* Member selector */}
            <div className="mb-4">
              <label className="form-label">Select Member</label>
              {sortedMembers.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Loading members…</p>
              ) : (
                <select
                  className="form-select"
                  value={memberSlug}
                  onChange={(e) => setMemberSlug(e.target.value)}
                >
                  {sortedMembers.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name} — {m.team}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentMember && (
              <>
                {/* Team picker */}
                <div className="mb-4">
                  <label className="form-label">Team</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                    {teams.map((t) => {
                      const s = getColorStyles(t.color);
                      const active = t.slug === teamSlug;
                      return (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => { setTeamSlug(t.slug); markDirty(); }}
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
                            transition: "all 150ms ease",
                          }}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name */}
                <div className="mb-4">
                  <label className="form-label">Member Name</label>
                  <input
                    className="form-control"
                    value={name}
                    onChange={(e) => { setName(e.target.value); markDirty(); }}
                    placeholder="e.g. Jane Smith"
                  />
                  <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                    slug: <strong>{memberSlug}</strong> <span style={{ color: "var(--ink-400)" }}>(not editable)</span>
                  </div>
                </div>

                {/* Position */}
                <div className="mb-4">
                  <label className="form-label">
                    Position <span style={{ color: "var(--ink-400)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    className="form-control"
                    value={position}
                    onChange={(e) => { setPosition(e.target.value); markDirty(); }}
                    placeholder="e.g. Sales Representative"
                  />
                </div>

                {/* Location */}
                <div className="mb-4">
                  <label className="form-label">
                    Location <span style={{ color: "var(--ink-400)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    className="form-control"
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); markDirty(); }}
                    placeholder="e.g. Phoenix, AZ"
                  />
                </div>

                {/* Working Hours */}
                <div className="mb-4">
                  <label className="form-label">
                    Working Hours <span style={{ color: "var(--ink-400)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    className="form-control"
                    value={workingHours}
                    onChange={(e) => { setWorkingHours(e.target.value); markDirty(); }}
                    placeholder="e.g. 9AM – 5PM CST"
                  />
                </div>

                {/* In Program + AI Knowledge */}
                <div className="row g-3 mb-4">
                  <div className="col-sm-6">
                    <label className="form-label">In Program</label>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      {["Yes", "No"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setInProgram(opt); markDirty(); }}
                          style={{
                            flex: 1,
                            padding: "0.45rem 0",
                            borderRadius: "8px",
                            border: `2px solid ${inProgram === opt ? (opt === "Yes" ? "#0f766e" : "#be185d") : "var(--line)"}`,
                            background: inProgram === opt
                              ? (opt === "Yes" ? "rgba(15,118,110,0.1)" : "rgba(190,24,93,0.1)")
                              : "transparent",
                            color: inProgram === opt ? (opt === "Yes" ? "#0f766e" : "#be185d") : "var(--ink-500)",
                            fontWeight: inProgram === opt ? 700 : 500,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            transition: "all 150ms ease",
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
                        const active = aiKnowledge === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => { setAiKnowledge(level); markDirty(); }}
                            style={{
                              flex: 1,
                              padding: "0.45rem 0",
                              borderRadius: "8px",
                              border: `2px solid ${active ? AI_COLORS[level] : "var(--line)"}`,
                              background: active ? `${AI_COLORS[level]}18` : "transparent",
                              color: active ? AI_COLORS[level] : "var(--ink-500)",
                              fontWeight: active ? 700 : 500,
                              fontSize: "0.78rem",
                              cursor: "pointer",
                              transition: "all 150ms ease",
                            }}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <button
                    className="btn btn-primary-brand"
                    type="button"
                    onClick={onSave}
                    disabled={saving || !dirty}
                  >
                    {saving ? "Saving..." : "✓ Save Changes"}
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => navigate("/team-roster")}
                  >
                    ← Back to Roster
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="col-lg-6 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2
              className="h6 mb-3"
              style={{
                fontFamily: "'Sora',sans-serif",
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.7rem",
              }}
            >
              Preview
            </h2>

            {currentMember && colorStyle ? (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  border: `2px solid ${dirty ? colorStyle.border : "var(--line)"}`,
                  transition: "border-color 200ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {name || currentMember.name}
                  </span>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span
                      className="team-badge"
                      style={{ background: colorStyle.badge, color: colorStyle.text }}
                    >
                      {selectedTeam?.name}
                    </span>
                    {inProgram && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "999px",
                          background: inProgram === "Yes" ? "rgba(15,118,110,0.12)" : "rgba(190,24,93,0.12)",
                          color: inProgram === "Yes" ? "#0f766e" : "#be185d",
                        }}
                      >
                        {inProgram === "Yes" ? "✓ In Program" : "✗ Not In Program"}
                      </span>
                    )}
                    {aiKnowledge && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "999px",
                          background: `${AI_COLORS[aiKnowledge]}18`,
                          color: AI_COLORS[aiKnowledge],
                        }}
                      >
                        🤖 {aiKnowledge}
                      </span>
                    )}
                  </div>
                </div>
                {(position || location || workingHours) && (
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {position && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-500)" }}>
                        💼 {position}
                      </span>
                    )}
                    {location && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-500)" }}>
                        📍 {location}
                      </span>
                    )}
                    {workingHours && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-500)" }}>
                        🕐 {workingHours}
                      </span>
                    )}
                  </div>
                )}
                {dirty && (
                  <p
                    style={{
                      fontSize: "0.7rem",
                      color: colorStyle.text,
                      marginTop: "0.6rem",
                      marginBottom: 0,
                    }}
                  >
                    ● Unsaved changes
                  </p>
                )}
              </div>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                Select a member to preview.
              </p>
            )}

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginTop: "1.5rem" }}>
              <p className="mb-0 mono" style={{ fontSize: "0.7rem", color: "var(--ink-400)" }}>
                Slug: <strong style={{ color: "var(--ink-600)" }}>{memberSlug || "—"}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
