import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getToken, fetchCurrentUser } from "../lib/githubAuth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [coachUsername, setCoachUsername] = useState(null);
  const [coachDisplayName, setCoachDisplayName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCoachUsername(null);
      setCoachDisplayName(null);
      setLoading(false);
      return;
    }
    // Already resolved — avoid re-fetching on every navigation
    if (coachUsername) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCurrentUser()
      .then((user) => {
        setCoachUsername(user.login);
        setCoachDisplayName(user.name || user.login);
      })
      .catch(() => {
        setCoachUsername(null);
        setCoachDisplayName(null);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <AuthContext.Provider value={{ coachUsername, coachDisplayName, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
