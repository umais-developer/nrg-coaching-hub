import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readTextFile, saveTextFile } from "../lib/githubAuth";
import { useAuth } from "./AuthContext";

const TeamsContext = createContext(null);

export function TeamsProvider({ children }) {
  const {
    coachUsername,
    loading: authLoading,
    roleLoading,
    isAdmin,
    memberIdentity,
  } = useAuth();
  const [teams, setTeams] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Admin only: which coach's workspace is being viewed. Null = their own.
  const [viewingCoach, setViewingCoach] = useState(null);

  // Whose data are we looking at?
  //  - a member's records live in THEIR COACH's file, not their own
  //  - an admin may be viewing another coach read-only
  //  - everyone else reads their own folder
  const dataOwner =
    (isAdmin && viewingCoach) || memberIdentity?.coach || coachUsername || null;

  const dataPath = dataOwner ? `coaches/${dataOwner}/teams.json` : null;

  // Writes only ever target the signed-in user's own folder. An admin viewing
  // someone else, or a member, must never get a writable path.
  const isReadOnly = Boolean((isAdmin && viewingCoach) || memberIdentity);
  const teamsPath = !isReadOnly && coachUsername ? `coaches/${coachUsername}/teams.json` : null;

  const load = useCallback(async () => {
    if (!dataPath || !dataOwner) {
      setTeams([]);
      setCohorts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Goes through the boundary-checked reader rather than a hand-built
      // fetch, so cross-coach access is governed by assertReadablePath
      const text = await readTextFile(dataPath);
      const json = JSON.parse(text);
      setTeams(json.teams || []);
      setCohorts(json.cohorts || []);
    } catch (e) {
      // A coach with no file yet is not an error — start empty
      if (String(e.message).includes("Not Found") || String(e.message).includes("404")) {
        setTeams([]);
        setCohorts([]);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [dataPath, dataOwner]);

  useEffect(() => {
    // Wait for the role too — it decides whose data we load
    if (!authLoading && !roleLoading) {
      load();
    }
  }, [load, authLoading, roleLoading]);

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
      if (isReadOnly) {
        throw new Error("Read-only view — you cannot modify another coach's workspace.");
      }
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
    [teamsPath, teams, cohorts, isReadOnly]
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
        // Whose workspace is on screen, and whether it can be edited
        dataOwner,
        isReadOnly,
        viewingCoach,
        setViewingCoach,
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
