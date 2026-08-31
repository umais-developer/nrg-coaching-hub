// Role and capability logic.
//
// IMPORTANT — what this is and is not:
// Roles decide what the APP SHOWS and LETS YOU DO. They are not a security
// boundary. The target repo is public, so every roster and note is readable by
// anyone with the URL, and any collaborator's token can write any path via the
// GitHub API directly. Real confidentiality requires a private repo (plus
// OAUTH_SCOPE "repo") or a server-side proxy. Treat these checks as UI intent,
// not enforcement.

export const ROLES = {
  ADMIN: "admin",
  COACH: "coach",
  MEMBER: "member",
};

// Collaborators with no entry in users.json keep full coach access — this is
// what preserves today's behavior for existing users, so adding the roles file
// never locks anyone out.
export const DEFAULT_ROLE = ROLES.COACH;

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.COACH]: "Coach",
  [ROLES.MEMBER]: "Team Member",
};

export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: "Read-only view across every coach, plus user management.",
  [ROLES.COACH]: "Full access to their own cohorts, teams, members, and notes.",
  [ROLES.MEMBER]: "Their own profile, their team roster, own uploads, shared notes.",
};

export const CAPABILITIES = {
  MANAGE_COHORTS: "manageCohorts",
  MANAGE_TEAMS: "manageTeams",
  MANAGE_MEMBERS: "manageMembers",
  WRITE_NOTES: "writeNotes",
  READ_ALL_NOTES: "readAllNotes",
  EDIT_OWN_PROFILE: "editOwnProfile",
  UPLOAD_OWN_FILES: "uploadOwnFiles",
  VIEW_ALL_COACHES: "viewAllCoaches",
  MANAGE_USERS: "manageUsers",
  EXPORT_DATA: "exportData",
  MANAGE_QUIZZES: "manageQuizzes",
  GRADE_QUIZZES: "gradeQuizzes",
  TAKE_QUIZZES: "takeQuizzes",
};

// Admin is deliberately READ-ONLY across coaches — a holistic view, not a
// super-coach. It has no writeNotes/manageTeams so the "who wrote this" trail
// stays unambiguous. An admin who also coaches gets a separate coach entry.
const ROLE_CAPABILITIES = {
  [ROLES.ADMIN]: [
    CAPABILITIES.VIEW_ALL_COACHES,
    CAPABILITIES.MANAGE_USERS,
    CAPABILITIES.EXPORT_DATA,
  ],
  [ROLES.COACH]: [
    CAPABILITIES.MANAGE_COHORTS,
    CAPABILITIES.MANAGE_TEAMS,
    CAPABILITIES.MANAGE_MEMBERS,
    CAPABILITIES.WRITE_NOTES,
    CAPABILITIES.READ_ALL_NOTES,
    CAPABILITIES.UPLOAD_OWN_FILES,
    CAPABILITIES.EXPORT_DATA,
    CAPABILITIES.MANAGE_QUIZZES,
    CAPABILITIES.GRADE_QUIZZES,
  ],
  [ROLES.MEMBER]: [
    CAPABILITIES.EDIT_OWN_PROFILE,
    CAPABILITIES.UPLOAD_OWN_FILES,
    CAPABILITIES.TAKE_QUIZZES,
  ],
};

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

function sameLogin(a, b) {
  // GitHub logins are case-insensitive
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

// Resolves a GitHub login to its role entry. Unlisted logins fall back to the
// default role rather than being denied.
export function resolveUser(users, login) {
  if (!login) return null;
  const entry = (users || []).find((u) => sameLogin(u.githubLogin, login));
  if (!entry || !isValidRole(entry.role)) {
    return { githubLogin: login, role: DEFAULT_ROLE, unlisted: !entry };
  }
  return {
    githubLogin: entry.githubLogin,
    role: entry.role,
    // Only meaningful for members: which coach's file holds their record, and
    // which record it is. Both are needed because member slugs are unique only
    // within one coach's teams.json.
    coach: entry.coach || null,
    memberSlug: entry.memberSlug || null,
    unlisted: false,
  };
}

export function can(user, capability) {
  if (!user || !capability) return false;
  return (ROLE_CAPABILITIES[user.role] || []).includes(capability);
}

export function capabilitiesFor(role) {
  return (ROLE_CAPABILITIES[role] || []).slice();
}

// A member is only usable as a member once a coach has linked their GitHub
// login to a specific member record. Until then the app has no row for them.
export function isLinkedMember(user) {
  return Boolean(user && user.role === ROLES.MEMBER && user.coach && user.memberSlug);
}

export function countAdmins(users) {
  return (users || []).filter((u) => u.role === ROLES.ADMIN).length;
}

// Guards the sharpest failure mode: the last admin demoting themselves would
// leave nobody able to manage users, with no in-app way back.
export function wouldRemoveLastAdmin(users, login, nextRole) {
  const target = (users || []).find((u) => sameLogin(u.githubLogin, login));
  if (!target || target.role !== ROLES.ADMIN) return false;
  if (nextRole === ROLES.ADMIN) return false;
  return countAdmins(users) <= 1;
}

// Returns the updated users array with `login` set to `role`, adding an entry
// when absent. Never mutates the input.
export function setUserRole(users, login, role, extra = {}) {
  if (!isValidRole(role)) throw new Error(`Invalid role: ${role}`);
  const list = (users || []).slice();
  const idx = list.findIndex((u) => sameLogin(u.githubLogin, login));

  const base = { githubLogin: idx >= 0 ? list[idx].githubLogin : login, role };
  // coach/memberSlug only apply to members — drop them otherwise so the file
  // does not carry meaningless keys
  const record =
    role === ROLES.MEMBER
      ? {
          ...base,
          ...(extra.coach ? { coach: extra.coach } : {}),
          ...(extra.memberSlug ? { memberSlug: extra.memberSlug } : {}),
        }
      : base;

  if (idx >= 0) list[idx] = record;
  else list.push(record);
  return list;
}

export function removeUser(users, login) {
  return (users || []).filter((u) => !sameLogin(u.githubLogin, login));
}

// ── Note visibility ─────────────────────────────────────────────────────────
// Notes are private unless a coach explicitly shares them. Notes written before
// this existed carry no header and therefore stay private — they were written
// under an assumption of privacy and must not become visible retroactively.

export const NOTE_VISIBILITY_HEADER = "Visibility";

export function isNoteShared(noteText) {
  if (!noteText) return false;
  // Only inspect the header block, so the word cannot be matched from the body
  const head = String(noteText).split(/\r?\n\r?\n/)[0] || "";
  return /^Visibility:\s*shared\s*$/im.test(head);
}

// Notes live at coaches/<coach>/members/<memberSlug>/notes/<file>.txt
export function noteMemberSlug(path) {
  const m = /^coaches\/[^/]+\/members\/([^/]+)\/notes\//i.exec(String(path || ""));
  return m ? m[1] : null;
}

export function noteCoach(path) {
  const m = /^coaches\/([^/]+)\/members\//i.exec(String(path || ""));
  return m ? m[1] : null;
}

// A member may see a note only when it is about them AND was shared.
export function canMemberSeeNote({ path, text, memberIdentity }) {
  if (!memberIdentity) return false;
  const slug = noteMemberSlug(path);
  const coach = noteCoach(path);
  if (!slug || slug !== memberIdentity.memberSlug) return false;
  if (coach && memberIdentity.coach && coach.toLowerCase() !== memberIdentity.coach.toLowerCase()) {
    return false;
  }
  return isNoteShared(text);
}
