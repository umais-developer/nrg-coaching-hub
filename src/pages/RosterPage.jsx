import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { getColorStyles } from "../lib/teamColors";
import {
  COHORT_STATUS_LABELS,
  UNKNOWN_COHORT,
  countMembers,
  formatDateRange,
  getCohortStatus,
  groupTeamsByCohort,
  isUnknownCohort,
} from "../lib/cohorts";

const AI_COLORS = { Beginner: "#6366f1", Medium: "#f59e0b", Expert: "#10b981" };
const STATUS_COLORS = { upcoming: "#0284c7", active: "#16a34a", completed: "#6b7280" };

function TeamCard({ team, cohort, onEdit, onEditMember }) {
  const s = getColorStyles(team.color);
  const cs = getColorStyles(cohort.color);
  const sorted = (team.members || []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <article className="section-card p-4 h-100" style={{ borderTop: `3px solid ${s.border}` }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
          {team.name}
        </h3>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <span className="team-badge" style={{ background: s.badge, color: s.text }}>
            {sorted.length} members
          </span>
          <button
            type="button"
            onClick={onEdit}
            title="Edit team name, color, and cohort"
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = s.badge;
              e.currentTarget.style.color = s.text;
              e.currentTarget.style.borderColor = s.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-500)";
              e.currentTarget.style.borderColor = "var(--line)";
            }}
          >
            ✎ Edit
          </button>
        </div>
      </div>

      <div className="mb-3">
        <span
          className="mono"
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            padding: "0.12rem 0.45rem",
            borderRadius: "999px",
            background: cs.badge,
            color: cs.text,
            letterSpacing: "0.02em",
          }}
        >
          {cohort.name}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {sorted.length === 0 && (
          <p className="text-secondary mb-0" style={{ fontSize: "0.85rem" }}>
            No members yet.
          </p>
        )}
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
                  onClick={() => onEditMember(member.slug)}
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
  );
}

function CohortHeading({ cohort, teams }) {
  const cs = getColorStyles(cohort.color);
  const unknown = isUnknownCohort(cohort);
  const status = unknown ? null : getCohortStatus(cohort);
  const memberCount = countMembers(teams);

  return (
    <div
      style={{
        borderLeft: `4px solid ${cs.border}`,
        background: cs.badge,
        borderRadius: "10px",
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2
            className="h5 mb-0"
            style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: cs.text }}
          >
            {cohort.name}
          </h2>
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
        </div>
        <div className="mono mt-1" style={{ fontSize: "0.72rem", color: cs.text, opacity: 0.85 }}>
          {unknown ? "No cohort assigned" : formatDateRange(cohort.startDate, cohort.endDate)}
        </div>
      </div>
      <div className="mono" style={{ fontSize: "0.72rem", color: cs.text, opacity: 0.85 }}>
        {teams.length} {teams.length === 1 ? "team" : "teams"} · {memberCount}{" "}
        {memberCount === 1 ? "member" : "members"}
      </div>
    </div>
  );
}

export default function RosterPage() {
  const { teams, cohorts, allMembers, loading } = useTeams();
  const navigate = useNavigate();
  const [cohortFilter, setCohortFilter] = useState("all");

  const groups = useMemo(() => groupTeamsByCohort(teams, cohorts), [teams, cohorts]);

  const visibleGroups = useMemo(
    () => (cohortFilter === "all" ? groups : groups.filter((g) => g.cohort.slug === cohortFilter)),
    [groups, cohortFilter]
  );

  const visibleTeamCount = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.teams.length, 0),
    [visibleGroups]
  );

  const hasUnknown = groups.some((g) => isUnknownCohort(g.cohort));

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">👥 Team Roster</div>
        <h1 style={{ fontSize: "2rem" }}>Team Roster</h1>
        <p className="text-secondary mb-3">All members grouped by cohort and coaching team.</p>
        <div className="stat-strip">
          <div className="stat-pill">
            <span className="stat-pill-value">{allMembers.length}</span>
            <span className="stat-pill-label">Total Members</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{teams.length}</span>
            <span className="stat-pill-label">Teams</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{cohorts.length}</span>
            <span className="stat-pill-label">Cohorts</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4 align-items-end animate-in animate-in-2">
        <div className="col-md-7 col-lg-5">
          <label className="form-label">Filter by cohort</label>
          <select
            className="form-select"
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
          >
            <option value="all">All cohorts</option>
            {cohorts.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({formatDateRange(c.startDate, c.endDate)})
              </option>
            ))}
            {hasUnknown && <option value={UNKNOWN_COHORT.slug}>{UNKNOWN_COHORT.name}</option>}
          </select>
        </div>
        <div className="col-md-auto">
          <p className="mb-0 mono" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
            {loading ? "Loading…" : `Showing ${visibleTeamCount} of ${teams.length} teams`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-secondary">Loading teams…</p>
      ) : teams.length === 0 ? (
        <p className="text-secondary">No teams yet. Create one on the Add Team page.</p>
      ) : visibleGroups.length === 0 ? (
        <p className="text-secondary">No teams match this cohort.</p>
      ) : (
        visibleGroups.map((group, gi) => (
          <section key={group.cohort.slug} className={`mb-4 animate-in animate-in-${Math.min(gi + 2, 4)}`}>
            <CohortHeading cohort={group.cohort} teams={group.teams} />
            {group.teams.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                No teams assigned to this cohort yet.
              </p>
            ) : (
              <div className="row g-3">
                {group.teams.map((team) => (
                  <div className="col-md-6" key={team.slug}>
                    <TeamCard
                      team={team}
                      cohort={group.cohort}
                      onEdit={() => navigate(`/edit-team?slug=${team.slug}`)}
                      onEditMember={(slug) => navigate(`/edit-member?slug=${slug}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
