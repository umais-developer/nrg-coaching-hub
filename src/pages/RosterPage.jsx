import { useTeams } from "../contexts/TeamsContext";
import { getColorStyles } from "../lib/teamColors";

export default function RosterPage() {
  const { teams, allMembers } = useTeams();

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
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {sorted.map((member) => (
                    <span key={member.slug} className="member-chip">
                      {member.name}
                    </span>
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
