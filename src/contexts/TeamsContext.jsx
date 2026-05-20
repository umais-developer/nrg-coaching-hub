import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APP_CONFIG } from "../config";
import { getToken } from "../lib/githubAuth";
import { useAuth } from "./AuthContext";

const TeamsContext = createContext(null);

export function TeamsProvider({ children }) {
  const { coachUsername, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const teamsPath = coachUsername ? `coaches/${coachUsername}/teams.json` : null;

  const load = useCallback(async () => {
    if (!coachUsername) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { TARGET_REPO, TARGET_BRANCH } = APP_CONFIG;
      const url = `https://api.github.com/repos/${TARGET_REPO}/contents/coaches/${coachUsername}/teams.json?ref=${encodeURIComponent(TARGET_BRANCH)}`;
      const token = getToken();
      const headers = { Accept: "application/vnd.github+json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.status === 404) {
        // New coach — no teams file yet, start with empty
        setTeams([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = decodeURIComponent(
        escape(atob((data.content || "").replace(/\n/g, "")))
      );
      const json = JSON.parse(text);
      setTeams(json.teams || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [coachUsername]);

  useEffect(() => {
    if (!authLoading) {
      load();
    }
  }, [load, authLoading]);

  // Flat list of every member with their team info attached
  const allMembers = useMemo(
    () => teams.flatMap((t) =>
      (t.members || []).map((m) => ({ ...m, team: t.name, teamSlug: t.slug, teamColor: t.color }))
    ),
    [teams]
  );

  function getMemberBySlug(slug) {
    return allMembers.find((m) => m.slug === slug) || null;
  }

  const updateTeams = useCallback((newTeams) => {
    setTeams(newTeams);
  }, []);

  return (
    <TeamsContext.Provider value={{ teams, allMembers, loading, error, reload: load, updateTeams, getMemberBySlug, teamsPath }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used inside <TeamsProvider>");
  return ctx;
}
