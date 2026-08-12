import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  inviteCollaborator,
  listAllCoaches,
  listCollaborators,
  loadUsersFile,
  saveUsersFile,
} from "../lib/githubAuth";
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  removeUser,
  resolveUser,
  setUserRole,
  wouldRemoveLastAdmin,
} from "../lib/roles";

const ROLE_COLORS = {
  [ROLES.ADMIN]: "#6d28d9",
  [ROLES.COACH]: "#0f766e",
  [ROLES.MEMBER]: "#0284c7",
};

function RolePill({ role, unlisted }) {
  const color = ROLE_COLORS[role] || "#6b7280";
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 700,
        padding: "0.15rem 0.45rem",
        borderRadius: "999px",
        background: `${color}18`,
        color,
        letterSpacing: "0.02em",
      }}
      title={unlisted ? "Not listed in users.json — using the default role" : undefined}
    >
      {ROLE_LABELS[role] || role}
      {unlisted ? " (default)" : ""}
    </span>
  );
}

export default function AdminPage() {
  const { coachUsername, canInvite, reloadRole } = useAuth();

  const [users, setUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteLogin, setInviteLogin] = useState("");
  const [inviteRole, setInviteRole] = useState(ROLES.COACH);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ users: list }, collabs, coachList] = await Promise.all([
        loadUsersFile(),
        listCollaborators().catch(() => []),
        listAllCoaches().catch(() => []),
      ]);
      setUsers(list);
      setCollaborators(collabs);
      setCoaches(coachList);
    } catch (e) {
      setStatus(`Failed to load: ${e.message}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Everyone we know about: listed users plus collaborators not yet assigned
  const rows = useMemo(() => {
    const byLogin = new Map();
    users.forEach((u) => {
      byLogin.set(u.githubLogin.toLowerCase(), { ...u, listed: true });
    });
    collaborators.forEach((c) => {
      const key = c.login.toLowerCase();
      if (byLogin.has(key)) {
        byLogin.get(key).repoPermission = c.permission;
      } else {
        const resolved = resolveUser([], c.login);
        byLogin.set(key, {
          githubLogin: c.login,
          role: resolved.role,
          listed: false,
          repoPermission: c.permission,
        });
      }
    });
    return [...byLogin.values()].sort((a, b) => a.githubLogin.localeCompare(b.githubLogin));
  }, [users, collaborators]);

  const persist = async (nextUsers, message) => {
    setSaving(true);
    setStatus("Saving...");
    setOk(false);
    try {
      await saveUsersFile(nextUsers, message);
      setUsers(nextUsers);
      setOk(true);
      setStatus(message);
      // The signed-in user may have just changed their own role
      reloadRole();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
    } finally {
      setSaving(false);
    }
  };

  const onChangeRole = async (login, nextRole) => {
    // Without this the last admin could demote themselves and lock everyone
    // out of user management, with no way back inside the app
    if (wouldRemoveLastAdmin(users, login, nextRole)) {
      setStatus(
        `Cannot change @${login} to ${ROLE_LABELS[nextRole]} — they are the only admin. Promote someone else first.`
      );
      setOk(false);
      return;
    }
    await persist(setUserRole(users, login, nextRole), `chore: set @${login} role to ${nextRole}`);
  };

  const onUnassign = async (login) => {
    if (wouldRemoveLastAdmin(users, login, ROLES.COACH)) {
      setStatus(`Cannot unassign @${login} — they are the only admin.`);
      setOk(false);
      return;
    }
    if (!window.confirm(`Remove the explicit role for @${login}? They will fall back to the default (Coach).`)) {
      return;
    }
    await persist(removeUser(users, login), `chore: remove role entry for @${login}`);
  };

  const onLinkMember = async (login, coach, memberSlug) => {
    await persist(
      setUserRole(users, login, ROLES.MEMBER, { coach, memberSlug }),
      `chore: link @${login} to ${coach}/${memberSlug}`
    );
  };

  const onInvite = async () => {
    const login = inviteLogin.trim();
    if (!login) {
      setStatus("Enter a GitHub username to invite.");
      setOk(false);
      return;
    }
    setSaving(true);
    setStatus("Sending invitation...");
    setOk(false);
    try {
      const result = await inviteCollaborator(login);
      // Pre-assign the role so it applies the moment they accept
      if (inviteRole !== ROLES.COACH) {
        await saveUsersFile(
          setUserRole(users, login, inviteRole),
          `chore: pre-assign ${inviteRole} role to @${login}`
        );
        setUsers(setUserRole(users, login, inviteRole));
      }
      setOk(true);
      setStatus(result.message);
      setInviteLogin("");
      load();
    } catch (e) {
      setStatus(e.message);
      setOk(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header ph-slate animate-in">
        <div className="page-header-eyebrow">⚙ Admin</div>
        <h1 style={{ fontSize: "2rem" }}>Users &amp; Access</h1>
        <p className="text-secondary mb-0">
          Assign roles and invite collaborators. Roles control what the app shows and allows.
        </p>
      </div>

      {/* Deliberately prominent and permanent: overstating this protection
          would be worse than not having it */}
      <div
        className="animate-in animate-in-2"
        style={{
          border: "1px solid rgba(180,83,9,0.35)",
          background: "rgba(180,83,9,0.08)",
          borderRadius: "10px",
          padding: "0.85rem 1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#92400e", marginBottom: "0.25rem" }}>
          ⚠ This repository is public — roles are not a security boundary
        </div>
        <p className="mb-0" style={{ fontSize: "0.82rem", color: "var(--ink-700)" }}>
          Roles decide what this app shows and lets people do. They do <strong>not</strong> protect
          data. Every roster and every coaching note in this repository is readable by anyone with
          the URL, signed in or not. Assume anything typed here is public. To make these
          restrictions real, the repository must be private (GitHub Pro or Team is required for
          Pages on a private repo) or reads must move behind a server-side proxy.
        </p>
      </div>

      {status && (
        <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 animate-in animate-in-2`}>
          {status}
        </p>
      )}

      <div className="row g-3">
        <div className="col-lg-7 animate-in animate-in-3">
          <div className="section-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                People
              </h2>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={load} disabled={loading}>
                ↻ Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>No collaborators found.</p>
            ) : (
              rows.map((row) => {
                const isSelf = row.githubLogin.toLowerCase() === String(coachUsername).toLowerCase();
                return (
                  <div
                    key={row.githubLogin}
                    style={{
                      padding: "0.65rem 0.75rem",
                      borderRadius: "8px",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: "0.5rem" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>@{row.githubLogin}</span>
                        {isSelf && (
                          <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-400)", marginLeft: "0.4rem" }}>
                            (you)
                          </span>
                        )}
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginTop: "0.25rem", flexWrap: "wrap" }}>
                          <RolePill role={row.role} unlisted={!row.listed} />
                          {row.repoPermission && (
                            <span className="mono" style={{ fontSize: "0.65rem", color: "var(--ink-400)" }}>
                              repo: {row.repoPermission}
                            </span>
                          )}
                          {row.role === ROLES.MEMBER && (
                            <span className="mono" style={{ fontSize: "0.65rem", color: row.memberSlug ? "var(--ink-500)" : "#be185d" }}>
                              {row.memberSlug ? `${row.coach}/${row.memberSlug}` : "⚠ not linked to a member record"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: "auto" }}
                          value={row.role}
                          disabled={saving}
                          onChange={(e) => onChangeRole(row.githubLogin, e.target.value)}
                        >
                          {Object.values(ROLES).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {row.listed && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={saving}
                            onClick={() => onUnassign(row.githubLogin)}
                            title="Remove the explicit entry; falls back to the default role"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {row.role === ROLES.MEMBER && (
                      <MemberLink
                        row={row}
                        coaches={coaches}
                        saving={saving}
                        onLink={onLinkMember}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="col-lg-5 animate-in animate-in-4">
          <div className="section-card p-4 mb-3">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
              Invite a collaborator
            </h2>

            {canInvite ? (
              <>
                <div className="mb-3">
                  <label className="form-label">GitHub username</label>
                  <input
                    className="form-control"
                    value={inviteLogin}
                    onChange={(e) => setInviteLogin(e.target.value)}
                    placeholder="e.g. octocat"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Role once they accept</label>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {Object.values(ROLES).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <div className="mono mt-1" style={{ fontSize: "0.7rem", color: "var(--ink-500)" }}>
                    {ROLE_DESCRIPTIONS[inviteRole]}
                  </div>
                </div>
                <button className="btn btn-primary-brand" type="button" onClick={onInvite} disabled={saving}>
                  {saving ? "Sending…" : "✉ Send Invitation"}
                </button>
                <p className="mb-0 mt-3" style={{ fontSize: "0.78rem", color: "var(--ink-500)" }}>
                  GitHub sends an invitation the person must accept. They will not appear as a
                  collaborator, and cannot sign in, until they do.
                </p>
              </>
            ) : (
              <p className="mb-0" style={{ fontSize: "0.85rem", color: "var(--ink-500)" }}>
                Inviting collaborators requires <strong>admin permission on the repository</strong>,
                which your GitHub account does not have. Ask the repository owner to invite them, or
                to grant you the admin role on the repo. (Raising the OAuth scope does not help —
                scopes limit permissions, they never grant them.)
              </p>
            )}
          </div>

          <div className="section-card p-4">
            <h2 className="h6 mb-3" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
              Roles
            </h2>
            {Object.values(ROLES).map((r) => (
              <div key={r} style={{ marginBottom: "0.6rem" }}>
                <RolePill role={r} />
                <div style={{ fontSize: "0.78rem", color: "var(--ink-500)", marginTop: "0.2rem" }}>
                  {ROLE_DESCRIPTIONS[r]}
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: "0.75rem", paddingTop: "0.75rem" }}>
              <p className="mb-0" style={{ fontSize: "0.78rem", color: "var(--ink-500)" }}>
                Collaborators with no entry keep full <strong>Coach</strong> access, so adding roles
                never locks out someone who could work before.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// A member role is inert until it points at a specific member record — slugs
// are unique only within one coach's file, so both parts are required.
function MemberLink({ row, coaches, saving, onLink }) {
  const [coach, setCoach] = useState(row.coach || "");
  const [slug, setSlug] = useState(row.memberSlug || "");

  return (
    <div className="row g-2 mt-2 align-items-end">
      <div className="col-sm-5">
        <label className="form-label" style={{ fontSize: "0.72rem" }}>Coach</label>
        <select
          className="form-select form-select-sm"
          value={coach}
          onChange={(e) => setCoach(e.target.value)}
        >
          <option value="">— select —</option>
          {coaches.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="col-sm-5">
        <label className="form-label" style={{ fontSize: "0.72rem" }}>Member slug</label>
        <input
          className="form-control form-control-sm"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. aaron-medina"
        />
      </div>
      <div className="col-sm-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary w-100"
          disabled={saving || !coach || !slug}
          onClick={() => onLink(row.githubLogin, coach, slug)}
        >
          Link
        </button>
      </div>
    </div>
  );
}
