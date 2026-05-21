import { useState } from "react";
import { useTeams } from "../contexts/TeamsContext";

function downloadCSV(filename, rows) {
  const escape = (val) => {
    const s = val == null ? "" : String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const { teams, allMembers, loading } = useTeams();
  const [flash, setFlash] = useState("");

  function notify(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  }

  // ── Export 1: Team Summary ─────────────────────────────────────────────────
  function exportTeamSummary() {
    const rows = [
      ["Team Name", "Total Members"],
      ...teams.map((t) => [t.name, (t.members || []).length]),
      [],
      ["TOTAL", allMembers.length],
    ];
    downloadCSV("nrg-team-summary.csv", rows);
    notify("Team summary downloaded.");
  }

  // ── Export 2: Full Roster ──────────────────────────────────────────────────
  function exportFullRoster() {
    const rows = [
      ["Team", "Name", "Position", "Location", "Working Hours", "In Program", "AI Knowledge"],
      ...teams.flatMap((t) =>
        (t.members || [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => [
            t.name,
            m.name,
            m.position || "",
            m.location || "",
            m.workingHours || "",
            m.inProgram || "",
            m.aiKnowledge || "",
          ])
      ),
    ];
    downloadCSV("nrg-full-roster.csv", rows);
    notify("Full roster downloaded.");
  }

  // ── Export 3: Per-Team sheets (one CSV per team) ───────────────────────────
  function exportPerTeam() {
    teams.forEach((t) => {
      const rows = [
        ["Name", "Position", "Location", "Working Hours", "In Program", "AI Knowledge"],
        ...(t.members || [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => [
            m.name,
            m.position || "",
            m.location || "",
            m.workingHours || "",
            m.inProgram || "",
            m.aiKnowledge || "",
          ]),
      ];
      const safe = t.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      downloadCSV(`nrg-${safe}.csv`, rows);
    });
    notify(`${teams.length} team files downloaded.`);
  }

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "12px",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  };

  const metaStyle = {
    fontSize: "0.8rem",
    color: "var(--ink-400)",
    fontFamily: "'Space Mono', monospace",
  };

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">📥 Exports</div>
        <h1 style={{ fontSize: "2rem" }}>Download Roster Data</h1>
        <p className="text-secondary mb-0">
          Export your coaching teams as CSV files — open directly in Excel, Google Sheets, or any spreadsheet app.
        </p>
      </div>

      {flash && (
        <div className="alert alert-success py-2 animate-in" style={{ fontSize: "0.88rem" }}>
          ✓ {flash}
        </div>
      )}

      {loading ? (
        <p className="text-secondary">Loading team data…</p>
      ) : (
        <div className="row g-3 animate-in animate-in-2">

          {/* ── Card 1: Team Summary ── */}
          <div className="col-md-4">
            <div style={cardStyle}>
              <div>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>📊</div>
                <h2 className="h5 mb-1" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                  Team Summary
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-500)", margin: 0 }}>
                  One row per team — name and total member count.
                </p>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.78rem", fontFamily: "'Space Mono', monospace", color: "var(--ink-500)" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: "var(--ink-600)" }}>Preview</div>
                <div>Team Name, Total Members</div>
                {teams.slice(0, 3).map((t) => (
                  <div key={t.slug}>{t.name}, {(t.members || []).length}</div>
                ))}
                {teams.length > 3 && <div style={{ color: "var(--ink-400)" }}>…{teams.length - 3} more rows</div>}
                <div style={{ marginTop: "0.3rem", borderTop: "1px solid var(--line)", paddingTop: "0.3rem" }}>
                  TOTAL, {allMembers.length}
                </div>
              </div>

              <div style={metaStyle}>
                {teams.length} teams · {allMembers.length} members total
              </div>

              <button
                className="btn btn-primary-brand"
                type="button"
                onClick={exportTeamSummary}
                disabled={!teams.length}
              >
                ↓ Download nrg-team-summary.csv
              </button>
            </div>
          </div>

          {/* ── Card 2: Full Roster ── */}
          <div className="col-md-4">
            <div style={cardStyle}>
              <div>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>📋</div>
                <h2 className="h5 mb-1" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                  Full Roster
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-500)", margin: 0 }}>
                  Every member across all teams with all profile fields.
                </p>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.78rem", fontFamily: "'Space Mono', monospace", color: "var(--ink-500)" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: "var(--ink-600)" }}>Columns</div>
                <div>Team</div>
                <div>Name</div>
                <div>Position</div>
                <div>Location</div>
                <div>Working Hours</div>
                <div>In Program</div>
                <div>AI Knowledge</div>
              </div>

              <div style={metaStyle}>
                {allMembers.length} rows · 7 columns
              </div>

              <button
                className="btn btn-primary-brand"
                type="button"
                onClick={exportFullRoster}
                disabled={!teams.length}
              >
                ↓ Download nrg-full-roster.csv
              </button>
            </div>
          </div>

          {/* ── Card 3: Per-Team Files ── */}
          <div className="col-md-4">
            <div style={cardStyle}>
              <div>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>🗂️</div>
                <h2 className="h5 mb-1" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                  Per-Team Files
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-500)", margin: 0 }}>
                  One CSV per team — useful for sharing with individual coaches.
                </p>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.78rem", fontFamily: "'Space Mono', monospace", color: "var(--ink-500)" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: "var(--ink-600)" }}>Files</div>
                {teams.map((t) => (
                  <div key={t.slug}>
                    nrg-{t.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv
                  </div>
                ))}
              </div>

              <div style={metaStyle}>
                {teams.length} files · {allMembers.length} members total
              </div>

              <button
                className="btn btn-primary-brand"
                type="button"
                onClick={exportPerTeam}
                disabled={!teams.length}
              >
                ↓ Download {teams.length} Team Files
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── Stats strip ── */}
      {!loading && !!teams.length && (
        <div className="section-card p-4 mt-4 animate-in animate-in-3">
          <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>
            Current Data Snapshot
          </h2>
          <div className="stat-strip">
            <div className="stat-pill">
              <span className="stat-pill-value">{allMembers.length}</span>
              <span className="stat-pill-label">Total Members</span>
            </div>
            {teams.map((t) => (
              <div className="stat-pill" key={t.slug}>
                <span className="stat-pill-value">{(t.members || []).length}</span>
                <span className="stat-pill-label">{t.name}</span>
              </div>
            ))}
          </div>
          <p className="mb-0 mt-3" style={{ fontSize: "0.75rem", color: "var(--ink-400)" }}>
            CSV files open directly in Microsoft Excel, Google Sheets, or Numbers. The UTF-8 BOM is included so special characters display correctly.
          </p>
        </div>
      )}
    </>
  );
}
