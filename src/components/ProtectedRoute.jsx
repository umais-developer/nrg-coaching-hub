import { Navigate, useLocation } from "react-router-dom";
import { getToken, setPostLoginPath } from "../lib/githubAuth";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, capability }) {
  const location = useLocation();
  const { can, roleLoading } = useAuth();

  if (!getToken()) {
    setPostLoginPath(`${location.pathname}${location.search}`);
    return <Navigate to="/tools-setup" replace />;
  }

  // No capability required — token presence is the whole gate (unchanged)
  if (!capability) {
    return children;
  }

  // Wait for the role to resolve rather than guessing. Redirecting here would
  // bounce a legitimate coach mid-resolve; rendering would flash coach UI to a
  // member. Neither is acceptable, so render nothing for the moment it takes.
  if (roleLoading) {
    return (
      <p className="text-secondary" style={{ padding: "2rem 0" }}>
        Loading…
      </p>
    );
  }

  if (!can(capability)) {
    return <Navigate to="/" replace state={{ denied: capability }} />;
  }

  return children;
}
