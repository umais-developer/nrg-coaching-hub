import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import { saveTextFile } from "../lib/githubAuth";
import { UNKNOWN_COHORT, formatDateRange, getTeamCohort, getTeamCohortSlug } from "../lib/cohorts";

function formatNowForFile(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function CoachNotesPage() {
  const { coachUsername, coachDisplayName } = useAuth();
  const { teams, cohorts, allMembers, getMemberBySlug } = useTeams();
  const sortedMembers = useMemo(
    () => allMembers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allMembers]
  );
  const [cohortFilter, setCohortFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [memberSlug, setMemberSlug] = useState("");
  const [meetingDate, setMeetingDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Signed in. Ready to save notes.");
  const [ok, setOk] = useState(true);
  const [saved, setSaved] = useState("");

  // Does any team lack a cohort? Controls whether "Unknown" is offered as a filter.
  const hasUnknown = useMemo(
    () => teams.some((t) => getTeamCohortSlug(t, cohorts) === UNKNOWN_COHORT.slug),
    [teams, cohorts]
  );

  // Teams available for the Team dropdown, narrowed by the chosen cohort
  const teamOptions = useMemo(() => {
    const list =
      cohortFilter === "all"
        ? teams
        : teams.filter((t) => getTeamCohortSlug(t, cohorts) === cohortFilter);
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, cohorts, cohortFilter]);

  // Members narrowed by both filters
  const filteredMembers = useMemo(() => {
    const allowedTeams = new Set(teamOptions.map((t) => t.slug));
    return sortedMembers.filter((m) => {
      if (!allowedTeams.has(m.teamSlug)) return false;
      if (teamFilter !== "all" && m.teamSlug !== teamFilter) return false;
      return true;
    });
  }, [sortedMembers, teamOptions, teamFilter]);

  // Reset the team filter when it is no longer valid for the selected cohort
  useEffect(() => {
    if (teamFilter !== "all" && !teamOptions.some((t) => t.slug === teamFilter)) {
      setTeamFilter("all");
    }
  }, [teamOptions, teamFilter]);

  // Keep the selected member valid: pick the first match whenever the current
  // selection is filtered out, so the form never points at a hidden member
  useEffect(() => {
    if (!filteredMembers.length) {
      if (memberSlug) setMemberSlug("");
      return;
    }
    if (!filteredMembers.some((m) => m.slug === memberSlug)) {
      setMemberSlug(filteredMembers[0].slug);
    }
  }, [filteredMembers, memberSlug]);

  const member = getMemberBySlug(memberSlug);
  const memberCohort = useMemo(() => {
    const team = teams.find((t) => t.slug === member?.teamSlug);
    return team ? getTeamCohort(team, cohorts) : null;
  }, [teams, cohorts, member]);

  const onSave = async () => {
    if (!member) {
      setStatus("Select a member.");
      setOk(false);
      return;
    }

    if (!meetingDate) {
      setStatus("Meeting date is required.");
      setOk(false);
      return;
    }

    if (!notes.trim()) {
      setStatus("Notes are required.");
      setOk(false);
      return;
    }

    const now = new Date();
    const fileName = `${meetingDate}_${formatNowForFile(now)}.txt`;
    const repoPath = `coaches/${coachUsername}/members/${member.slug}/notes/${fileName}`;
    const content = [
      `Coach: ${coachDisplayName || coachUsername}`,
      `Member: ${member.name}`,
      `Team: ${member.team}`,
      `Cohort: ${memberCohort ? memberCohort.name : UNKNOWN_COHORT.name}`,
      `Meeting Date: ${meetingDate}`,
      `Saved At: ${now.toISOString()}`,
      "",
      "Discussion Notes:",
      notes.trim()
    ].join("\n");

    try {
      setStatus("Saving note file to GitHub...");
      setOk(false);
      const result = await saveTextFile({
        repoPath,
        text: content,
        message: `Add coaching note for ${member.name} on ${meetingDate}`
      });
      setStatus("Saved successfully.");
      setOk(true);
      setSaved(`Saved path: ${repoPath}\nCommit: ${result.commit?.html_url || "(commit URL unavailable)"}`);
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
      setOk(false);
    }
  };

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📋 Meeting Notes</div>
        <h1 style={{ fontSize: "2rem" }}>Coaching Discussion</h1>
        <p className="text-secondary mb-0">Select a team member, set the date, and save structured notes directly to the repository.</p>
      </div>

      <div className="row g-3">
        <div className="col-lg-7 animate-in animate-in-2">
          <div className="section-card p-4">
            <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</p>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Cohort</label>
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
              <div className="col-md-6">
                <label className="form-label">Team</label>
                <select
                  className="form-select"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="all">All teams</option>
                  {teamOptions.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-8">
                <label className="form-label">Team Member</label>
                <select
                  className="form-select"
                  value={memberSlug}
                  onChange={(e) => setMemberSlug(e.target.value)}
                  disabled={!filteredMembers.length}
                >
                  {filteredMembers.length === 0 ? (
                    <option value="">No members match these filters</option>
                  ) : (
                    filteredMembers.map((item) => (
                      <option value={item.slug} key={item.slug}>{item.name}</option>
                    ))
                  )}
                </select>
                <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                  Showing {filteredMembers.length} of {sortedMembers.length} members
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Team</label>
                <input className="form-control" value={member?.team || ""} readOnly />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Meeting Date</label>
              <input type="date" className="form-control" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="form-label">Discussion Notes</label>
              <textarea
                className="form-control"
                rows="10"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you discuss? Goals achieved, blockers raised, action items, follow-ups..."
                style={{ resize: "vertical" }}
              />
              <div className="mono mt-1" style={{ fontSize: "0.68rem", color: "var(--ink-300)", textAlign: "right" }}>
                {notes.length} chars
              </div>
            </div>

            <button className="btn btn-primary-brand" type="button" onClick={onSave}>
              ✓ Save Notes To Repository
            </button>
          </div>
        </div>

        <div className="col-lg-5 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>File destination</h2>
            {member ? (
              <>
                <div className="mb-3">
                  <p className="mono" style={{ fontSize: "0.74rem", color: "var(--ink-500)", wordBreak: "break-all" }}>
                    members/{member.slug}/notes/{meetingDate}_<em style={{ color: "var(--ink-300)" }}>&lt;timestamp&gt;</em>.txt
                  </p>
                </div>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                  <p className="mb-1" style={{ fontSize: "0.82rem" }}><strong>Member:</strong> {member.name}</p>
                  <p className="mb-1" style={{ fontSize: "0.82rem" }}><strong>Team:</strong> {member.team}</p>
                  <p className="mb-0" style={{ fontSize: "0.82rem" }}>
                    <strong>Cohort:</strong> {memberCohort ? memberCohort.name : UNKNOWN_COHORT.name}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Select a member to preview the file path.</p>
            )}
            {saved ? (
              <div style={{ borderTop: "1px solid var(--line)", marginTop: "1rem", paddingTop: "1rem" }}>
                <p className="mb-1" style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 600 }}>✓ Saved successfully</p>
                <pre className="note-preview" style={{ borderRadius: "0.5rem", padding: "0.6rem" }}>{saved}</pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
