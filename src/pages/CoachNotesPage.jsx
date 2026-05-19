import { useMemo, useState } from "react";
import { TEAM_MEMBERS, getMemberBySlug } from "../data/membersData";
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
  const sortedMembers = useMemo(
    () => TEAM_MEMBERS.slice().sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const [memberSlug, setMemberSlug] = useState(sortedMembers[0]?.slug || "");
  const [meetingDate, setMeetingDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Signed in. Ready to save notes.");
  const [ok, setOk] = useState(true);
  const [saved, setSaved] = useState("");

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
    const repoPath = `members/${member.slug}/notes/${fileName}`;
    const content = [
      "Coach: Umais Siddiqui",
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
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">Save Coaching Discussion</h1>
      <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2`}>{status}</p>

      <div className="mb-3">
        <label className="form-label">Team Member</label>
        <select className="form-select" value={memberSlug} onChange={(e) => setMemberSlug(e.target.value)}>
          {sortedMembers.map((item) => (
            <option value={item.slug} key={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">Team</label>
        <input className="form-control" value={member?.team || ""} readOnly />
      </div>

      <div className="mb-3">
        <label className="form-label">Meeting date</label>
        <input
          type="date"
          className="form-control"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Discussion notes</label>
        <textarea
          className="form-control"
          rows="8"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you discuss? Decisions, blockers, action items..."
        />
      </div>

      <button className="btn btn-dark" type="button" onClick={onSave}>
        Save Notes To Repository
      </button>
      {saved ? <pre className="note-preview border rounded bg-light p-3 mt-3">{saved}</pre> : null}
    </section>
  );
}
