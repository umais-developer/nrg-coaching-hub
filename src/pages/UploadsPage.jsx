import { useEffect, useMemo, useState } from "react";
import { useTeams } from "../contexts/TeamsContext";
import { saveUploadedFile } from "../lib/githubAuth";

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

export default function UploadsPage() {
  const { allMembers, getMemberBySlug } = useTeams();
  const sortedMembers = useMemo(
    () => allMembers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allMembers]
  );
  const [memberSlug, setMemberSlug] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Signed in. Ready to upload.");
  const [ok, setOk] = useState(true);
  const [resultText, setResultText] = useState("");

  // Auto-select first member once context loads
  useEffect(() => {
    if (!memberSlug && sortedMembers.length) {
      setMemberSlug(sortedMembers[0].slug);
    }
  }, [sortedMembers, memberSlug]);

  const member = getMemberBySlug(memberSlug);

  const onUpload = async () => {
    if (!member) {
      setStatus("Select a member.");
      setOk(false);
      return;
    }

    if (!file) {
      setStatus("Choose a file to upload.");
      setOk(false);
      return;
    }

    const repoPath = `members/${member.slug}/uploads/${timestamp()}_${safeName(file.name)}`;

    try {
      setStatus("Uploading file to GitHub...");
      setOk(false);
      const result = await saveUploadedFile({
        repoPath,
        file,
        message: `Upload ${file.name} for ${member.name}`
      });
      setStatus("Upload successful.");
      setOk(true);
      setResultText(`Saved path: ${repoPath}\nCommit: ${result.commit?.html_url || "(commit URL unavailable)"}`);
    } catch (error) {
      setStatus(`Upload failed: ${error.message}`);
      setOk(false);
    }
  };

  return (
    <>
      <div className="page-header ph-amber animate-in">
        <div className="page-header-eyebrow">📁 Uploads</div>
        <h1 style={{ fontSize: "2rem" }}>File Upload</h1>
        <p className="text-secondary mb-0">Upload supporting materials into a member's dedicated folder in the repository.</p>
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

            <div className="mb-4">
              <label className="form-label">File</label>
              <div
                className="file-drop-zone"
                onClick={() => document.getElementById("file-input").click()}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📎</div>
                <p className="mb-1" style={{ fontWeight: 600, color: "var(--ink-800)" }}>
                  {file ? file.name : "Click to choose a file"}
                </p>
                <p className="mb-0" style={{ fontSize: "0.8rem", color: "var(--ink-500)" }}>
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Any file type accepted"}
                </p>
              </div>
              <input
                id="file-input"
                type="file"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <button className="btn btn-primary-brand" type="button" onClick={onUpload}>
              ↑ Upload To Repository
            </button>
          </div>
        </div>

        <div className="col-lg-5 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>Upload destination</h2>
            {member ? (
              <p className="mono" style={{ fontSize: "0.74rem", color: "var(--ink-500)", wordBreak: "break-all" }}>
                members/{member.slug}/uploads/<em style={{ color: "var(--ink-300)" }}>&lt;timestamp&gt;</em>_{file ? file.name : "filename"}
              </p>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Select a member to preview the file path.</p>
            )}
            {resultText && (
              <div style={{ borderTop: "1px solid var(--line)", marginTop: "1rem", paddingTop: "1rem" }}>
                <p className="mb-1" style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 600 }}>✓ Upload successful</p>
                <pre className="note-preview" style={{ borderRadius: "0.5rem", padding: "0.6rem" }}>{resultText}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
