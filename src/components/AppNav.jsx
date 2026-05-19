import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/tools-setup", label: "Tools Setup" },
  { to: "/team-roster", label: "Team Roster" },
  { to: "/workshops", label: "Workshops" },
  { to: "/coach-notes", label: "Meeting Notes" },
  { to: "/discussions", label: "Discussions" },
  { to: "/uploads", label: "Uploads" },
  { to: "/login", label: "Login" }
];

export default function AppNav() {
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
          <div className="navbar-nav ms-auto gap-2 pt-3 pt-lg-0">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-chip ${isActive ? "nav-chip-active" : "nav-chip-idle"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
