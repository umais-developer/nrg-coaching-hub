import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken } from "../lib/githubAuth";

const coachLinks = [
  { to: "/", label: "Dashboard", end: true },
  null,
  { to: "/team-roster", label: "Team Roster" },
  { to: "/workshops", label: "Workshops" },
  { to: "/coach-notes", label: "Meeting Notes" },
  { to: "/discussions", label: "Discussions" },
  { to: "/uploads", label: "Uploads" },
  null,
  { to: "/add-team", label: "Add Team" },
  { to: "/add-member", label: "Add Member" },
];

export default function AppNav() {
  const location = useLocation();
  const [authed, setAuthed] = useState(!!getToken());

  useEffect(() => {
    setAuthed(!!getToken());
  }, [location.pathname]);

  const coachActive = coachLinks
    .filter(Boolean)
    .some((l) => l.end ? location.pathname === l.to : location.pathname.startsWith(l.to));

  return (
    <nav className="app-nav navbar navbar-expand-lg mb-4">
      <div className="container-fluid">
        <span className="navbar-brand d-flex flex-column lh-sm">
          <span className="brand-title">NRG Coaching Hub</span>
          <span className="brand-subtitle">Collaborative Coaching Workspace</span>
        </span>
        <button
          className="navbar-toggler app-nav-toggle"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="mainNav">
          <div className="navbar-nav ms-auto gap-2 pt-3 pt-lg-0 align-items-lg-center">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-chip ${isActive ? "nav-chip-active" : "nav-chip-idle"}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/tools-setup"
              className={({ isActive }) =>
                `nav-chip ${isActive ? "nav-chip-active" : "nav-chip-idle"}`
              }
            >
              Tools Setup
            </NavLink>
            {authed && (
              <div className="dropdown">
                <button
                  className={`nav-chip nav-chip-btn ${coachActive ? "nav-chip-coach-active" : "nav-chip-idle"}`}
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  Coach ▾
                </button>
                <ul className="dropdown-menu dropdown-menu-end coach-dropdown">
                  {coachLinks.map((link, i) =>
                    link === null ? (
                      <li key={`div-${i}`}>
                        <hr className="dropdown-divider coach-divider" />
                      </li>
                    ) : (
                      <li key={link.to + link.label}>
                        <NavLink
                          to={link.to}
                          end={link.end}
                          className={({ isActive }) =>
                            `dropdown-item coach-dropdown-item${isActive ? " active" : ""}`
                          }
                        >
                          {link.label}
                        </NavLink>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `nav-chip ${isActive || location.pathname === "/auth-callback" ? "nav-chip-active" : "nav-chip-idle"}`
              }
            >
              {authed ? "Account" : "Login"}
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
