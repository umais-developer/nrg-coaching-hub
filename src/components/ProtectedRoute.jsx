import { Navigate, useLocation } from "react-router-dom";
import { getToken, setPostLoginPath } from "../lib/githubAuth";

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!getToken()) {
    setPostLoginPath(`${location.pathname}${location.search}`);
    return <Navigate to="/tools-setup" replace />;
  }

  return children;
}
