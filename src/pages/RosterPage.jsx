import { useNavigate } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { getColorStyles } from "../lib/teamColors";

const AI_COLORS = { Beginner: "#6366f1", Medium: "#f59e0b", Expert: "#10b981" };

export default function RosterPage() {
  const { teams, allMembers } = useTeams();
  const navigate = useNavigate();

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">👥 Team Roster</div>
        <h1 style={{ fontSize: "2rem" }}>Team Roster</h1>
        <p className="text-secondary mb-3">All members grouped by their coaching team.</p>
        <div className="stat-strip">
          <div className="stat-pill">
            <span className="stat-pill-value">{allMembers.length}</span>
            <span className="stat-pill-label">Total Members</span>
          </div>
          {teams.map((t) => (
            <div className="stat-pill" key={t.slug}>
              <span className="stat-pill-value" style={{ fontSize: "1.4rem" }}>{t.members?.length || 0}</span>
              <span className="stat-pill-label">{t.name.replace(" Team", "")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="row g-3">
        {teams.map((team, idx) => {
          const s = getColorStyles(team.color);
          const sorted = (team.members || []).slice().sort((a, b) => a.name.localeCompare(b.name));
          return (
            <div className={`col-md-6 animate-in animate-in-${idx + 1}`} key={team.slug}>
              <article className="section-card p-4 h-100" style={{ borderTop: `3px solid ${s.border}` }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                    {team.name}
                  </h2>
                  <span className="team-badge" style={{ background: s.badge, color: s.text }}>
                    {sorted.length} members
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sorted.map((member) => (
                    <div
                      key={member.slug}
                      style={{
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{member.name}</span>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                          {member.inProgram && (
                            <span style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.45rem",
                              borderRadius: "999px",
                              background: member.inProgram === "Yes" ? "rgba(15,118,110,0.12)" : "rgba(190,24,93,0.12)",
                              color: member.inProgram === "Yes" ? "#0f766e" : "#be185d",
                              letterSpacing: "0.02em"
                            }}>
                              {member.inProgram === "Yes" ? "✓ In Program" : "✗ Not In Program"}
                            </span>
                          )}
                          {member.aiKnowledge && (
                            <span style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.45rem",
                              borderRadius: "999px",
                              background: `${AI_COLORS[member.aiKnowledge] || "#6366f1"}18`,
                              color: AI_COLORS[member.aiKnowledge] || "#6366f1",
                              letterSpacing: "0.02em"
                            }}>
                              🤖 {member.aiKnowledge}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/edit-member?slug=${member.slug}`)}
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              background: "transparent",
                              color: "var(--ink-500)",
                              cursor: "pointer",
                              transition: "all 120ms ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = s.badge; e.currentTarget.style.color = s.text; e.currentTarget.style.borderColor = s.border; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-500)"; e.currentTarget.style.borderColor = "var(--line)"; }}
                          >
                            ✎ Edit
                          </button>
                        </div>
                      </div>
                      {(member.position || member.location || member.workingHours) && (
                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                          {member.position && (
                            <span style={{ fontSize: "0.75rem", color: "var(--ink-500)" }}>
                              💼 {member.position}
                            </span>
                          )}
                          {member.location && (
                            <span style={{ fontSize: "0.75rem", color: "var(--ink-500)" }}>
                              📍 {member.location}
                            </span>
                          )}
                          {member.workingHours && (
                            <span style={{ fontSize: "0.75rem", color: "var(--ink-500)" }}>
                              🕐 {member.workingHours}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </>
  );
}
