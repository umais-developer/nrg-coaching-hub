import { Link } from "react-router-dom";
import { TEAM_MEMBERS, getMembersByTeam } from "../data/membersData";

export default function HomePage() {
  const byTeam = getMembersByTeam();
  const teamSummary = Object.entries(byTeam)
    .map(([team, members]) => `${team}: ${members.length}`)
    .join(" | ");

  return (
    <>
      <section className="hero-card rounded-3 p-4 mb-4">
        <h1 className="display-6 fw-semibold">Coaching Workspace For Pod 1A-US</h1>
        <p className="mb-0 text-secondary">
          A React-based coaching workflow with GitHub OAuth, repository-backed notes, discussions,
          and uploads.
        </p>
      </section>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="section-card rounded-3 p-3 h-100">
            <h2 className="h5">Rosters At A Glance</h2>
            <p className="text-secondary mb-2">
              {TEAM_MEMBERS.length} total members across {Object.keys(byTeam).length} teams.
            </p>
            <p className="mono small text-secondary">{teamSummary}</p>
            <Link to="/team-roster" className="btn btn-dark btn-sm">Open roster</Link>
          </div>
        </div>
        <div className="col-md-4">
          <div className="section-card rounded-3 p-3 h-100">
            <h2 className="h5">Workshop Cycle</h2>
            <p className="text-secondary">Six structured sessions from kickoff to retrospective.</p>
            <Link to="/workshops" className="btn btn-dark btn-sm">Open workshops</Link>
          </div>
        </div>
        <div className="col-md-4">
          <div className="section-card rounded-3 p-3 h-100">
            <h2 className="h5">Coach Action Center</h2>
            <p className="text-secondary">Capture notes and upload files to member folders.</p>
            <Link to="/coach-notes" className="btn btn-dark btn-sm">Start notes</Link>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {[
          ["Login", "/login"],
          ["Meeting Notes", "/coach-notes"],
          ["Discussions", "/discussions"],
          ["Uploads", "/uploads"],
          ["Student Setup", "/tools-setup"]
        ].map(([label, to]) => (
          <div className="col-sm-6 col-lg-4" key={to}>
            <div className="section-card rounded-3 p-3 h-100 d-flex flex-column">
              <h3 className="h6">{label}</h3>
              <Link to={to} className="btn btn-outline-dark btn-sm mt-auto">Open</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
