import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import { saveTextFile } from "../lib/githubAuth";

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
  const { allMembers, getMemberBySlug } = useTeams();
  const sortedMembers = useMemo(
    () => allMembers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allMembers]
  );
  const [memberSlug, setMemberSlug] = useState("");
  const [meetingDate, setMeetingDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Signed in. Ready to save notes.");
  const [ok, setOk] = useState(true);
  const [saved, setSaved] = useState("");

  // Auto-select first member once context loads
  useEffect(() => {
    if (!memberSlug && sortedMembers.length) {
      setMemberSlug(sortedMembers[0].slug);
    }
  }, [sortedMembers, memberSlug]);

  const member = getMemberBySlug(memberSlug);

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
              <div className="col-md-8">
                <label className="form-label">Team Member</label>
                <select className="form-select" value={memberSlug} onChange={(e) => setMemberSlug(e.target.value)}>
                  {sortedMembers.map((item) => (
                    <option value={item.slug} key={item.slug}>{item.name}</option>
                  ))}
                </select>
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
                  <p className="mb-0" style={{ fontSize: "0.82rem" }}><strong>Team:</strong> {member.team}</p>
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
