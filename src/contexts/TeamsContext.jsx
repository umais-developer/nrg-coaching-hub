import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APP_CONFIG } from "../config";

const TEAMS_REPO_PATH = "data/teams.json";
const TeamsContext = createContext(null);

export function TeamsProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { TARGET_REPO, TARGET_BRANCH } = APP_CONFIG;
      // Cache-bust so edits appear immediately after a commit
      const url = `https://raw.githubusercontent.com/${TARGET_REPO}/${TARGET_BRANCH}/${TEAMS_REPO_PATH}?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTeams(json.teams || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  return (
    <TeamsContext.Provider value={{ teams, allMembers, loading, error, reload: load, getMemberBySlug }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used inside <TeamsProvider>");
  return ctx;
}
