import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import {
  isOwnedPath,
  listCoachNoteFiles,
  listMemberNoteFiles,
  readTextFile,
} from "../lib/githubAuth";
import { getColorStyles } from "../lib/teamColors";
import { UNKNOWN_COHORT, formatDateRange, getTeamCohortSlug } from "../lib/cohorts";
import { canMemberSeeNote, noteMemberSlug } from "../lib/roles";
import { isEncryptedNote, readableNote } from "../lib/notes";

// path: coaches/COACH/members/MEMBER-SLUG/notes/file.txt
function extractMemberSlug(path) {
  const parts = path.split("/");
  return parts[3] || "";
}

function extractCoachSlug(path) {
  const parts = path.split("/");
  return parts[1] || "";
}

export default function DiscussionsPage() {
  const { teams, cohorts, allMembers, getMemberBySlug } = useTeams();
  const { memberIdentity } = useAuth();
  const [status, setStatus] = useState("Ready.");
  const [ok, setOk] = useState(true);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState({});
  // Paths known to be encrypted, recorded before the body is decrypted
  const [encryptedPaths, setEncryptedPaths] = useState({});
  const [loading, setLoading] = useState({});
  const [cohortFilter, setCohortFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");

  const hasUnknown = useMemo(
    () => teams.some((t) => getTeamCohortSlug(t, cohorts) === UNKNOWN_COHORT.slug),
    [teams, cohorts]
  );

  // Teams narrowed by the chosen cohort
  const teamOptions = useMemo(() => {
    const list =
      cohortFilter === "all"
        ? teams
        : teams.filter((t) => getTeamCohortSlug(t, cohorts) === cohortFilter);
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, cohorts, cohortFilter]);

  // Members narrowed by cohort + team
  const memberOptions = useMemo(() => {
    const allowed = new Set(teamOptions.map((t) => t.slug));
    return allMembers
      .filter((m) => allowed.has(m.teamSlug) && (teamFilter === "all" || m.teamSlug === teamFilter))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMembers, teamOptions, teamFilter]);

  // Reset downstream filters when they no longer apply
  useEffect(() => {
    if (teamFilter !== "all" && !teamOptions.some((t) => t.slug === teamFilter)) {
      setTeamFilter("all");
    }
  }, [teamOptions, teamFilter]);

  useEffect(() => {
    if (memberFilter !== "all" && !memberOptions.some((m) => m.slug === memberFilter)) {
      setMemberFilter("all");
    }
  }, [memberOptions, memberFilter]);

  const filteredFiles = useMemo(() => {
    const allowed = new Set(memberOptions.map((m) => m.slug));
    return files.filter((file) => {
      const slug = extractMemberSlug(file.path);
      if (memberFilter !== "all") return slug === memberFilter;
      // With no explicit member chosen, show notes for whoever the cohort/team
      // filters allow. Notes for members no longer on any team still show when
      // no filter is applied, so history is never silently dropped.
      if (cohortFilter === "all" && teamFilter === "all") return true;
      return allowed.has(slug);
    });
  }, [files, memberOptions, memberFilter, cohortFilter, teamFilter]);

  const loadNotes = async () => {
    setStatus("Loading note files...");
    setOk(false);
    setPreviews({});

    try {
      if (memberIdentity) {
        // Members see only notes ABOUT them that were explicitly SHARED.
        // The Visibility header stays readable even on encrypted notes, so
        // this filter needs the file but never its decrypted body — and the
        // val independently refuses to decrypt a private note for a member,
        // so this check is convenience, not the enforcement point.
        const all = await listCoachNoteFiles(memberIdentity.coach);
        const mine = all.filter((f) => noteMemberSlug(f.path) === memberIdentity.memberSlug);
        const checked = await Promise.all(
          mine.map(async (f) => {
            try {
              const text = await readTextFile(f.path);
              return canMemberSeeNote({ path: f.path, text, memberIdentity }) ? { ...f, text } : null;
            } catch {
              return null;
            }
          })
        );
        const shared = checked.filter(Boolean).sort((a, b) => b.path.localeCompare(a.path));
        setFiles(shared);
        setStatus(
          shared.length
            ? `Found ${shared.length} shared ${shared.length === 1 ? "note" : "notes"}.`
            : "No notes have been shared with you yet."
        );
        setOk(shared.length > 0);
        return;
      }

      // Returns only the signed-in coach's notes; the extra filter is belt-and-
      // braces so nothing outside the boundary can reach the UI
      const all = await listMemberNoteFiles();
      const sorted = all
        .filter((f) => isOwnedPath(f.path))
        .sort((a, b) => b.path.localeCompare(a.path));
      setFiles(sorted);
      if (!sorted.length) {
        setStatus("No saved discussions found yet.");
        setOk(false);
        return;
      }
      setStatus(`Found ${sorted.length} notes.`);
      setOk(true);
    } catch (error) {
      setStatus(`Failed to load notes: ${error.message}`);
      setOk(false);
    }
  };

  const togglePreview = async (path) => {
    if (previews[path]) {
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      return;
    }

    setLoading((prev) => ({ ...prev, [path]: true }));
    try {
      const text = await readTextFile(path);
      // Remember this before decrypting — the rendered text no longer carries
      // the Encryption header
      if (isEncryptedNote(text)) {
        setEncryptedPaths((prev) => ({ ...prev, [path]: true }));
      }
      // Legacy plaintext notes pass through untouched; encrypted ones go to
      // the val, which decrypts only if this caller is allowed to see them
      const display = await readableNote({ path, noteText: text });
      setPreviews((prev) => ({ ...prev, [path]: display }));
    } catch (error) {
      setPreviews((prev) => ({ ...prev, [path]: `Unable to load file: ${error.message}` }));
    } finally {
      setLoading((prev) => ({ ...prev, [path]: false }));
    }
  };

  const dateFromPath = (path) => {
    const file = path.split("/").pop() || "";
    return file.slice(0, 10) || "";
  };

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">💬 Discussions</div>
        <h1 style={{ fontSize: "2rem" }}>Saved Discussions</h1>
        <p className="text-secondary mb-0">
          {memberIdentity
            ? "Coaching notes your coach has chosen to share with you."
            : "Browse and preview your own coaching notes."}
        </p>
      </div>

      {/* Cohort/team/member filters are meaningless for a single member */}
      <div className="row g-3 mb-3 animate-in animate-in-2" style={{ display: memberIdentity ? "none" : undefined }}>
        <div className="col-md-4">
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
        <div className="col-md-4">
          <label className="form-label">Team</label>
          <select
            className="form-select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="all">All teams</option>
            {teamOptions.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Team member</label>
          <select
            className="form-select"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          >
            <option value="all">All team members</option>
            {memberOptions.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row g-3 mb-4 align-items-center animate-in animate-in-2">
        <div className="col-md-auto">
          <button className="btn btn-dark" type="button" onClick={loadNotes}>↻ Load Notes</button>
        </div>
        <div className="col-md-auto">
          <p className="mb-0 mono" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
            {files.length ? `Showing ${filteredFiles.length} of ${files.length}` : "Click to load"}
          </p>
        </div>
      </div>

      <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 animate-in animate-in-3`}>{status}</p>

      <div className="d-grid gap-2 animate-in animate-in-4">
        {filteredFiles.map((file) => {
          const slug = extractMemberSlug(file.path);
          const coachSlug = extractCoachSlug(file.path);
          const member = getMemberBySlug(slug);
          const isOpen = !!previews[file.path];
          return (
            <article className="discussion-card" key={file.path}>
              <div className="discussion-card-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                    {member ? member.name : slug}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {member && (
                      <span
                        className="team-badge"
                        style={{
                          background: getColorStyles(member.teamColor).badge,
                          color: getColorStyles(member.teamColor).text,
                        }}
                      >
                        {member.team}
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-400)", background: "var(--ink-100)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                      🧑‍💼 {coachSlug}
                    </span>
                    <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-500)" }}>
                      {dateFromPath(file.path)}
                    </span>
                    {/* Only known when the listing already fetched the file
                        (member view) or after a preview has been opened */}
                    {(encryptedPaths[file.path] || isEncryptedNote(file.text || "")) && (
                      <span
                        className="mono"
                        style={{ fontSize: "0.68rem", color: "#15803d" }}
                        title="Body encrypted; decrypted server-side on preview"
                      >
                        🔒 encrypted
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={`btn ${isOpen ? "btn-dark" : "btn-outline-dark"} btn-sm`}
                  type="button"
                  onClick={() => togglePreview(file.path)}
                  style={{ flexShrink: 0 }}
                >
                  {loading[file.path] ? "⏳" : isOpen ? "✕ Hide" : "▶ Preview"}
                </button>
              </div>
              {isOpen && (
                <div className="discussion-preview">
                  <pre className="note-preview">{previews[file.path]}</pre>
                </div>
              )}
            </article>
          );
        })}

        {!filteredFiles.length && files.length > 0 && (
          <div className="section-card p-4 text-center" style={{ color: "var(--ink-500)" }}>
            No discussions found for the selected team member.
          </div>
        )}

        {!files.length && (
          <div className="section-card p-4 text-center" style={{ color: "var(--ink-500)" }}>
            <p style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>📂</p>
            <p className="mb-2">No notes loaded yet.</p>
            <button className="btn btn-dark" type="button" onClick={loadNotes}>Load Discussions</button>
          </div>
        )}
      </div>
    </>
  );
}
