import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getToken,
  fetchCurrentUser,
  setCoachLogin,
  setAdminReadAccess,
  setMemberWriteScope,
  loadUsersFile,
  fetchRepoPermission,
} from "../lib/githubAuth";
import { ROLES, can as canDo, resolveUser, isLinkedMember } from "../lib/roles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [coachUsername, setCoachUsername] = useState(null);
  const [coachDisplayName, setCoachDisplayName] = useState(null);
  const [loading, setLoading] = useState(true);

  // Role resolution is a second async step. Kept separate from `loading` so
  // pages can wait for it specifically and never flash coach UI to a member.
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  // Repo-level admin, which is what GitHub requires to add a collaborator.
  // Separate from the app role: an app admin without repo admin cannot invite.
  const [canInvite, setCanInvite] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCoachUsername(null);
      setCoachDisplayName(null);
      setCurrentUser(null);
      setUsers([]);
      setAdminReadAccess(false);
      setMemberWriteScope(null);
      setLoading(false);
      setRoleLoading(false);
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
        // Cache for the data layer's path-boundary check (assertOwnedPath),
        // which runs outside React and cannot read this context
        setCoachLogin(user.login);
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

  const loadRole = useCallback(async () => {
    if (!coachUsername) {
      setCurrentUser(null);
      setAdminReadAccess(false);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      const { users: list } = await loadUsersFile();
      setUsers(list);
      const resolved = resolveUser(list, coachUsername);
      setCurrentUser(resolved);
      // Widen the boundary only from the authoritative file — never from
      // anything user-supplied
      setAdminReadAccess(resolved?.role === ROLES.ADMIN);
      setMemberWriteScope(
        isLinkedMember(resolved) ? { coach: resolved.coach, memberSlug: resolved.memberSlug } : null
      );
    } catch {
      // If the roles file cannot be read, fall back to the default role rather
      // than locking the user out of an app that worked a moment ago
      setUsers([]);
      setCurrentUser(resolveUser([], coachUsername));
      setAdminReadAccess(false);
      setMemberWriteScope(null);
    } finally {
      setRoleLoading(false);
    }

    // Fails closed — no permission, no invite UI
    try {
      const permission = await fetchRepoPermission(coachUsername);
      setCanInvite(permission === "admin");
    } catch {
      setCanInvite(false);
    }
  }, [coachUsername]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  const coachInitials = coachDisplayName
    ? coachDisplayName.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("")
    : null;

  const role = currentUser?.role || null;
  const can = useCallback((capability) => canDo(currentUser, capability), [currentUser]);

  // Memoized: consumers put this in effect dependency arrays, and a fresh
  // object literal each render would re-run those effects on every parent
  // render — refetching, and racing itself.
  const memberIdentity = useMemo(
    () =>
      isLinkedMember(currentUser)
        ? { coach: currentUser.coach, memberSlug: currentUser.memberSlug }
        : null,
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        coachUsername,
        coachDisplayName,
        coachInitials,
        loading,
        // roles
        role,
        roleLoading,
        currentUser,
        users,
        can,
        isAdmin: role === ROLES.ADMIN,
        isCoach: role === ROLES.COACH,
        isMember: role === ROLES.MEMBER,
        // A member is only usable once a coach has linked their GitHub login
        // to a member record
        memberIdentity,
        canInvite,
        reloadRole: loadRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
