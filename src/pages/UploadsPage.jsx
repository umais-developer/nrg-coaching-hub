import { useMemo, useState } from "react";
import { TEAM_MEMBERS, getMemberBySlug } from "../data/membersData";
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
  const sortedMembers = useMemo(
    () => TEAM_MEMBERS.slice().sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const [memberSlug, setMemberSlug] = useState(sortedMembers[0]?.slug || "");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Signed in. Ready to upload.");
  const [ok, setOk] = useState(true);
  const [resultText, setResultText] = useState("");

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
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">Ad-Hoc Member File Upload</h1>
      <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2`}>{status}</p>

      <div className="mb-3">
        <label className="form-label">Team member</label>
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
        <label className="form-label">File</label>
        <input className="form-control" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>

      <button className="btn btn-dark" type="button" onClick={onUpload}>
        Upload File To Repository
      </button>

      {resultText ? <pre className="note-preview border rounded bg-light p-3 mt-3">{resultText}</pre> : null}
    </section>
  );
}
