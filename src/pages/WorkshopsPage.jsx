import { WORKSHOPS } from "../data/workshopsData";

export default function WorkshopsPage() {
  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">🗓️ Schedule</div>
        <h1 style={{ fontSize: "2rem" }}>Workshop Sessions</h1>
        <p className="text-secondary mb-0">Pod 1A-US — Six structured sessions from kickoff to retrospective improvement.</p>
      </div>

      <div className="timeline animate-in animate-in-2">
        {WORKSHOPS.map((ws, idx) => (
          <div className="timeline-item" key={ws.title}>
            <div className="timeline-dot">{idx + 1}</div>
            <div className="timeline-body">
              <div className="timeline-date">{new Date(ws.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.3rem" }}>{ws.title}</h2>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-700)", fontWeight: 500, marginBottom: "0.75rem" }}>{ws.focus}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {ws.outcomes.map((outcome) => (
                  <span key={outcome} style={{
                    display: "inline-block",
                    padding: "0.22rem 0.6rem",
                    borderRadius: "999px",
                    background: "var(--brand-soft)",
                    color: "var(--brand-strong)",
                    fontSize: "0.75rem",
                    fontWeight: 600
                  }}>{outcome}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
