import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken } from "../lib/githubAuth";
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

function PublicHome() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="hero-card mb-4 animate-in">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-eyebrow">Pod 1A-US · DLP Program</div>
          <h1 className="hero-title">
            Coaching<br />
            <span className="gradient-text">Workspace.</span>
          </h1>
          <p className="hero-subtitle">
            A private coaching platform for the DLP program — structured sessions,
            captured notes, and team outcomes securely committed to GitHub.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary-brand">Sign In With GitHub ↗</Link>
            <Link to="/tools-setup" className="btn btn-outline-dark">Student Setup Guide</Link>
          </div>
        </div>
      </div>

      {/* ── WORKSHOP SCHEDULE ─────────────────────────────────── */}
      <div className="section-card p-4 mb-4 animate-in animate-in-2">
        <div className="mb-4">
          <span
            className="page-header-eyebrow"
            style={{
              background: "var(--brand-soft)",
              color: "var(--brand-strong)",
              borderRadius: "999px",
              padding: "0.22rem 0.75rem",
              fontSize: "0.68rem",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              display: "inline-block",
              marginBottom: "0.6rem"
            }}
          >
            6-Session Program
          </span>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, marginBottom: "0.4rem" }}>
            Workshop Schedule
          </h2>
          <p style={{ color: "var(--ink-500)", fontSize: "0.9rem", margin: 0 }}>
            The DLP coaching program runs six structured workshops covering the full software delivery lifecycle.
            Sign in to access coaching notes, discussions, and team resources.
          </p>
        </div>
        <div className="row g-3">
          {WORKSHOPS.map((w, i) => (
            <div className="col-md-6 col-xl-4" key={w.title}>
              <div className="glass-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span
                    style={{
                      background: "var(--brand-soft)",
                      color: "var(--brand-strong)",
                      borderRadius: "999px",
                      padding: "0.15rem 0.6rem",
                      fontSize: "0.62rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.07em",
                      textTransform: "uppercase"
                    }}
                  >
                    Session {i + 1}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--ink-500)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {new Date(w.date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric"
                    })}
                  </span>
                </div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, marginBottom: "0.3rem" }}>
                  {w.title}
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--ink-500)", marginBottom: "0.6rem" }}>
                  {w.focus}
                </p>
                <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
                  {w.outcomes.map((o) => (
                    <li key={o} style={{ fontSize: "0.78rem", color: "var(--ink-700)" }}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOOLS SETUP CTA ───────────────────────────────────── */}
      <div className="feature-card p-4 animate-in animate-in-3 d-flex gap-4 align-items-start">
        <div
          className="feature-icon flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#e0f2fe,#bae6fd)" }}
        >
          🛠️
        </div>
        <div>
          <h2 className="h5 mb-1" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700 }}>
            Student Setup Guide
          </h2>
          <p className="text-secondary mb-3" style={{ fontSize: "0.9rem" }}>
            New to the program? Get your development environment ready — step-by-step guides for
            VS Code, Python, and Copilot Chat.
          </p>
          <Link to="/tools-setup" className="btn btn-dark btn-sm">Open Setup Guide →</Link>
        </div>
      </div>
    </>
  );
}

function CoachDashboard() {
  const { teams, allMembers } = useTeams();

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="hero-card mb-4 animate-in">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-eyebrow">Pod 1A-US · DLP Program</div>
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

export default function HomePage() {
  const [authed, setAuthed] = useState(!!getToken());

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  return authed ? <CoachDashboard /> : <PublicHome />;
}
