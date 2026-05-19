import { Link } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { WORKSHOPS } from "../data/workshopsData";

const features = [
  {
    icon: "📋",
    iconBg: "linear-gradient(135deg,#ccfbf1,#99f6e4)",
    title: "Meeting Notes",
    desc: "Capture structured coaching discussions and commit them directly to GitHub — searchable and permanent.",
    link: "/coach-notes",
    cta: "Open Notes"
  },
  {
    icon: "💬",
    iconBg: "linear-gradient(135deg,#e0e7ff,#c7d2fe)",
    title: "Discussions",
    desc: "Browse and preview every saved discussion note across your team, filterable by member.",
    link: "/discussions",
    cta: "View Discussions"
  },
  {
    icon: "📁",
    iconBg: "linear-gradient(135deg,#ffedd5,#fed7aa)",
    title: "File Uploads",
    desc: "Upload supporting materials and resources to each member's dedicated folder in the repository.",
    link: "/uploads",
    cta: "Upload Files"
  },
  {
    icon: "👥",
    iconBg: "linear-gradient(135deg,#fce7f3,#fbcfe8)",
    title: "Team Roster",
    desc: "View all team members grouped by their coaching team with quick-reference details.",
    link: "/team-roster",
    cta: "View Roster"
  },
  {
    icon: "🗓️",
    iconBg: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
    title: "Workshops",
    desc: "Six structured sessions from kickoff to retrospective — track focus areas and outcomes.",
    link: "/workshops",
    cta: "View Schedule"
  },
  {
    icon: "🛠️",
    iconBg: "linear-gradient(135deg,#e0f2fe,#bae6fd)",
    title: "Student Setup",
    desc: "Share this with students before class — step-by-step guides for VS Code, Python, and Copilot Chat.",
    link: "/tools-setup",
    cta: "Open Guide"
  }
];

export default function HomePage() {
  const { teams, allMembers } = useTeams();

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="hero-card mb-4 animate-in">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-eyebrow">NRG · Pod 1A-US · DLP Program</div>
          <h1 className="hero-title">
            Coaching<br />
            <span className="gradient-text">Workspace.</span>
          </h1>
          <p className="hero-subtitle">
            Structured sessions, captured notes, and organized outcomes —
            all securely committed to your GitHub repository.
          </p>
          <div className="hero-actions">
            <Link to="/coach-notes" className="btn btn-primary-brand">Start Coaching ↗</Link>
            <Link to="/discussions" className="btn btn-outline-dark">View Discussions</Link>
            <Link to="/login" className="btn btn-ghost">Sign In</Link>
          </div>
        </div>
      </div>

      {/* ── STATS ─────────────────────────────────────────────── */}
      <div className="stat-strip mb-4 animate-in animate-in-2">
        <div className="stat-pill">
          <span className="stat-pill-value">{allMembers.length}</span>
          <span className="stat-pill-label">Members</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{teams.length}</span>
          <span className="stat-pill-label">Teams</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{WORKSHOPS.length}</span>
          <span className="stat-pill-label">Workshops</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">100%</span>
          <span className="stat-pill-label">Git-Backed</span>
        </div>
      </div>

      {/* ── FEATURE GRID ──────────────────────────────────────── */}
      <div className="row g-3">
        {features.map((f, i) => (
          <div className={`col-md-6 col-xl-4 animate-in animate-in-${i + 1}`} key={f.title}>
            <div className="feature-card p-4 h-100 d-flex flex-column">
              <div className="feature-icon" style={{ background: f.iconBg }}>
                {f.icon}
              </div>
              <h2 className="h5 mb-2" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700 }}>{f.title}</h2>
              <p className="text-secondary flex-grow-1" style={{ fontSize: "0.9rem" }}>{f.desc}</p>
              <Link to={f.link} className="btn btn-dark btn-sm mt-3" style={{ alignSelf: "flex-start" }}>{f.cta}</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
