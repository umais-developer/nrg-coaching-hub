import { TEAM_MEMBERS, getMembersByTeam } from "../data/membersData";

const TEAM_META = {
  "Team Brad":     { cls: "team-brad",     cardCls: "team-card-brad",     icon: "🟢" },
  "Partner Team":  { cls: "team-partner",  cardCls: "team-card-partner",  icon: "🔵" },
  "Indirect Team": { cls: "team-indirect", cardCls: "team-card-indirect", icon: "🟡" },
  "Amigo Team":    { cls: "team-amigo",    cardCls: "team-card-amigo",    icon: "🌸" }
};

export default function RosterPage() {
  const grouped = getMembersByTeam();

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">👥 Team Roster</div>
        <h1 style={{ fontSize: "2rem" }}>Team Roster</h1>
        <p className="text-secondary mb-3">All members grouped by their coaching team.</p>
        <div className="stat-strip">
          <div className="stat-pill">
            <span className="stat-pill-value">{TEAM_MEMBERS.length}</span>
            <span className="stat-pill-label">Total Members</span>
          </div>
          {Object.entries(grouped).map(([team, members]) => {
            const meta = TEAM_META[team] || { cls: "", cardCls: "", icon: "•" };
            return (
              <div className="stat-pill" key={team}>
                <span className="stat-pill-value" style={{ fontSize: "1.4rem" }}>{members.length}</span>
                <span className="stat-pill-label">{team.replace(" Team", "")}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="row g-3">
        {Object.entries(grouped).map(([team, members], idx) => {
          const meta = TEAM_META[team] || { cls: "", cardCls: "", icon: "•" };
          const sorted = members.slice().sort((a, b) => a.name.localeCompare(b.name));
          return (
            <div className={`col-md-6 animate-in animate-in-${idx + 1}`} key={team}>
              <article className={`section-card p-4 h-100 ${meta.cardCls}`}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                    {meta.icon} {team}
                  </h2>
                  <span className={`team-badge ${meta.cls}`}>{sorted.length} members</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }} className={meta.cls}>
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
