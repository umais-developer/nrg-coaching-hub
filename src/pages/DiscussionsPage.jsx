import { useMemo, useState } from "react";
import { TEAM_MEMBERS, getMemberBySlug } from "../data/membersData";
import { listMemberNoteFiles, readTextFile } from "../lib/githubAuth";

function extractMemberSlug(path) {
  const parts = path.split("/");
  return parts[1] || "";
}

export default function DiscussionsPage() {
  const [status, setStatus] = useState("Ready.");
  const [ok, setOk] = useState(true);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState({});
  const [memberFilter, setMemberFilter] = useState("all");

  const memberOptions = useMemo(
    () => TEAM_MEMBERS.slice().sort((a, b) => a.name.localeCompare(b.name)),
    []
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

  return (
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">All Saved Discussions</h1>
      <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2`}>{status}</p>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-7 col-lg-5">
          <label className="form-label">Filter by team member</label>
          <select
            className="form-select"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          >
            <option value="all">All team members</option>
            {memberOptions.map((member) => (
              <option key={member.slug} value={member.slug}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-auto">
          <button className="btn btn-dark" type="button" onClick={loadNotes}>
            Refresh Discussion List
          </button>
        </div>
      </div>

      <p className="text-secondary small mb-3">
        Showing {filteredFiles.length} of {files.length} notes.
      </p>

      <div className="d-grid gap-3">
        {filteredFiles.map((file) => {
          const slug = extractMemberSlug(file.path);
          const member = getMemberBySlug(slug);
          return (
            <article className="border rounded p-3 bg-white" key={file.path}>
              <div className="fw-semibold">{member ? `${member.name} (${member.team})` : slug}</div>
              <div className="mono small text-secondary mb-2">{file.path}</div>
              <button
                className="btn btn-outline-dark btn-sm"
                type="button"
                onClick={() => togglePreview(file.path)}
              >
                {loading[file.path] ? "Loading..." : previews[file.path] ? "Hide" : "Preview"}
              </button>
              {previews[file.path] ? (
                <pre className="note-preview border rounded bg-light p-3 mt-2">{previews[file.path]}</pre>
              ) : null}
            </article>
          );
        })}

        {!filteredFiles.length && files.length ? (
          <div className="text-secondary">No discussions found for the selected team member.</div>
        ) : null}
      </div>
    </section>
  );
}
