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
      // Use the GitHub Contents API instead of raw.githubusercontent.com so we
      // always get the most recent commit without CDN cache lag.
      const url = `https://api.github.com/repos/${TARGET_REPO}/contents/${TEAMS_REPO_PATH}?ref=${encodeURIComponent(TARGET_BRANCH)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Contents API returns base64-encoded content
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
