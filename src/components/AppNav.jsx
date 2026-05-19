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
    <nav className="navbar navbar-expand-lg rounded-3 border border-dark-subtle bg-white mb-4">
      <div className="container-fluid">
        <span className="navbar-brand text-uppercase small fw-semibold letter-space">NRG Coaching Hub</span>
        <button
          className="navbar-toggler"
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
          <div className="navbar-nav ms-auto gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `btn btn-sm ${isActive ? "btn-dark" : "btn-outline-dark"}`
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
