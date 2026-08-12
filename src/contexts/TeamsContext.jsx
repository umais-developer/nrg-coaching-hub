import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APP_CONFIG } from "../config";
import { getToken, saveTextFile } from "../lib/githubAuth";
import { useAuth } from "./AuthContext";

const TeamsContext = createContext(null);

export function TeamsProvider({ children }) {
  const { coachUsername, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const teamsPath = coachUsername ? `coaches/${coachUsername}/teams.json` : null;

  const load = useCallback(async () => {
    if (!coachUsername) {
      setTeams([]);
      setCohorts([]);
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
        setCohorts([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = decodeURIComponent(
        escape(atob((data.content || "").replace(/\n/g, "")))
      );
      const json = JSON.parse(text);
      setTeams(json.teams || []);
      setCohorts(json.cohorts || []);
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
      (t.members || []).map((m) => ({
        ...m,
        team: t.name,
        teamSlug: t.slug,
        teamColor: t.color,
        cohort: t.cohort || null,
      }))
    ),
    [teams]
  );

  function getMemberBySlug(slug) {
    return allMembers.find((m) => m.slug === slug) || null;
  }

  const updateTeams = useCallback((newTeams) => {
    setTeams(newTeams);
  }, []);

  const updateCohorts = useCallback((newCohorts) => {
    setCohorts(newCohorts);
  }, []);

  // Single write path for teams.json. Both keys are always serialized together —
  // writing only one of them would silently drop the other from the file.
  // Optimistically updates context after the commit; never re-fetches.
  const saveAll = useCallback(
    async ({ teams: nextTeams, cohorts: nextCohorts, message }) => {
      if (!teamsPath) throw new Error("Not signed in — no teams file to save to.");
      const resolvedTeams = nextTeams ?? teams;
      const resolvedCohorts = nextCohorts ?? cohorts;
      await saveTextFile({
        repoPath: teamsPath,
        text: JSON.stringify({ cohorts: resolvedCohorts, teams: resolvedTeams }, null, 2) + "\n",
        message,
      });
      setTeams(resolvedTeams);
      setCohorts(resolvedCohorts);
    },
    [teamsPath, teams, cohorts]
  );

  return (
    <TeamsContext.Provider
      value={{
        teams,
        cohorts,
        allMembers,
        loading,
        error,
        reload: load,
        updateTeams,
        updateCohorts,
        saveAll,
        getMemberBySlug,
        teamsPath,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used inside <TeamsProvider>");
  return ctx;
}
