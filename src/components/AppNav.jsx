import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { getToken, logout, fetchCurrentUser } from "../lib/githubAuth";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../lib/roles";

// `capability` omitted means the link is visible to every signed-in user.
// Filtering here is cosmetic — ProtectedRoute is the actual gate.
const coachLinks = [
  { to: "/", label: "Dashboard", end: true },
  null,
  { to: "/team-roster", label: "Team Roster" },
  { to: "/workshops", label: "Workshops" },
  { to: "/coach-notes", label: "Meeting Notes", capability: "writeNotes" },
  { to: "/discussions", label: "Discussions" },
  { to: "/uploads", label: "Uploads", capability: "uploadOwnFiles" },
  { to: "/quizzes", label: "Quizzes", capability: "manageQuizzes" },
  { to: "/quizzes/results", label: "Quiz Results", capability: "manageQuizzes" },
  null,
  { to: "/cohorts", label: "Cohorts", capability: "manageCohorts" },
  { to: "/add-team", label: "Add Team", capability: "manageTeams" },
  { to: "/edit-team", label: "Edit Team", capability: "manageTeams" },
  { to: "/add-member", label: "Add Member", capability: "manageMembers" },
  { to: "/edit-member", label: "Edit Member" },
  null,
  { to: "/admin", label: "⚙ Admin", capability: "manageUsers" },
  { to: "/exports", label: "📥 Download / Exports", capability: "exportData" },
];

// Members get their own menu rather than a filtered coach menu. The pages
// behind these already scope themselves to the signed-in member (their team,
// their notes, their profile) — what was wrong was the framing: "Team Roster"
// and "Edit Member" read as administration, not as your own record.
const memberLinks = [
  { to: "/", label: "Dashboard", end: true },
  null,
  { to: "/team-roster", label: "My Team" },
  { to: "/workshops", label: "Workshops" },
  { to: "/discussions", label: "My Notes" },
  { to: "/uploads", label: "My Uploads", capability: "uploadOwnFiles" },
  null,
  { to: "/edit-member", label: "My Profile" },
];

// Drops links the user lacks, then collapses dividers that end up leading,
// trailing, or adjacent — otherwise a filtered menu shows stray separators.
function visibleLinks(links, can) {
  const kept = links.filter((l) => l === null || !l.capability || can(l.capability));
  const out = [];
  kept.forEach((link) => {
    if (link === null) {
      if (out.length === 0 || out[out.length - 1] === null) return;
      out.push(null);
    } else {
      out.push(link);
    }
  });
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

export default function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { can, roleLoading, role, isMember } = useAuth();
  const [authed, setAuthed] = useState(!!getToken());
  const [username, setUsername] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const token = !!getToken();
    setAuthed(token);
    if (token) {
      fetchCurrentUser()
        .then((user) => setUsername(user.login))
        .catch(() => setUsername(null));
    } else {
      setUsername(null);
    }
  }, [location.pathname]);

  // Close dropdown and mobile nav on route change
  useEffect(() => {
    setDropdownOpen(false);
    setNavOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

  function handleLogout() {
    logout();
    setAuthed(false);
    setUsername(null);
    navigate("/login");
  }

  // While the role resolves, show nothing rather than the full coach menu —
  // otherwise a member sees coach links flash on every page load
  const links = useMemo(
    () => (roleLoading ? [] : visibleLinks(isMember ? memberLinks : coachLinks, can)),
    [roleLoading, can, isMember]
  );

  // The menu is labelled by who is signed in, not always "Coach". Falls back
  // to a neutral label while the role is still resolving.
  const roleLabel = roleLoading ? "Menu" : ROLE_LABELS[role] || "Menu";

  const coachActive = links
    .filter(Boolean)
    .some((l) => l.end ? location.pathname === l.to : location.pathname.startsWith(l.to));

  return (
    <nav className="app-nav navbar navbar-expand-lg mb-4">
      <div className="container-fluid">
        <span className="navbar-brand d-flex flex-column lh-sm">
          <span className="brand-title">Umais Coaching Hub</span>
          <span className="brand-subtitle">Collaborative Coaching Workspace</span>
        </span>
        <button
          className="navbar-toggler app-nav-toggle"
          type="button"
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse${navOpen ? " show" : ""}`} id="mainNav">
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
              <div className="dropdown" ref={dropdownRef}>
                <button
                  className={`nav-chip nav-chip-btn ${coachActive ? "nav-chip-coach-active" : "nav-chip-idle"}`}
                  type="button"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen((o) => !o)}
                >
                  {roleLabel} ▾
                </button>
                <ul className={`dropdown-menu dropdown-menu-end coach-dropdown${dropdownOpen ? " show" : ""}`}>
                  {links.map((link, i) =>
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
                          onClick={() => setDropdownOpen(false)}
                        >
                          {link.label}
                        </NavLink>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            {authed ? (
              <>
                <span className="nav-chip nav-chip-idle" style={{ cursor: "default" }}>
                  {username ? `@${username}` : "Logged in"}
                </span>
                <button
                  className="nav-chip nav-chip-btn nav-chip-idle"
                  type="button"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `nav-chip ${isActive || location.pathname === "/auth-callback" ? "nav-chip-active" : "nav-chip-idle"}`
                }
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
