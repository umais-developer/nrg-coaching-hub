import { useMemo, useState } from "react";
import { useTeams } from "../contexts/TeamsContext";
import { listMemberNoteFiles, readTextFile } from "../lib/githubAuth";

function extractMemberSlug(path) {
  const parts = path.split("/");
  return parts[1] || "";
}

export default function DiscussionsPage() {
  const { allMembers, getMemberBySlug } = useTeams();
  const [status, setStatus] = useState("Ready.");
  const [ok, setOk] = useState(true);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState({});
  const [memberFilter, setMemberFilter] = useState("all");

  const memberOptions = useMemo(
    () => allMembers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allMembers]
  );

  const filteredFiles = useMemo(() => {
    if (memberFilter === "all") {
      return files;
    }

    return files.filter((file) => extractMemberSlug(file.path) === memberFilter);
  }, [files, memberFilter]);

  const loadNotes = async () => {
    setStatus("Loading note files...");
    setOk(false);
    setPreviews({});

    try {
      const all = await listMemberNoteFiles();
      const sorted = all.sort((a, b) => b.path.localeCompare(a.path));
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
      setPreviews((prev) => ({ ...prev, [path]: text }));
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
        <p className="text-secondary mb-0">Browse and preview every coaching note from the repository.</p>
      </div>

      <div className="row g-3 mb-4 align-items-end animate-in animate-in-2">
        <div className="col-md-7 col-lg-5">
          <label className="form-label">Filter by team member</label>
          <select className="form-select" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
            <option value="all">All team members</option>
            {memberOptions.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </div>
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
                      <span className="team-badge" style={{
                        background: member.team === "Team Brad" ? "rgba(15,118,110,0.12)" :
                          member.team === "Partner Team" ? "rgba(67,56,202,0.12)" :
                          member.team === "Indirect Team" ? "rgba(180,83,9,0.12)" :
                          "rgba(190,24,93,0.12)",
                        color: member.team === "Team Brad" ? "var(--team-brad)" :
                          member.team === "Partner Team" ? "var(--team-partner)" :
                          member.team === "Indirect Team" ? "var(--team-indirect)" :
                          "var(--team-amigo)"
                      }}>{member.team}</span>
                    )}
                    <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-500)" }}>
                      {dateFromPath(file.path)}
                    </span>
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
