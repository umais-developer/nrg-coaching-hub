import { APP_CONFIG } from "../config";

const TOKEN_KEY = "coaching_gh_token";
const POST_LOGIN_KEY = "coaching_post_login_path";
const OAUTH_STATE_KEY = "coaching_oauth_state";
const COACH_KEY = "coaching_gh_login";

export function getConfig() {
  const cfg = APP_CONFIG || {};
  const required = ["CLIENT_ID", "TOKEN_EXCHANGE_URL", "TARGET_REPO"];
  const missing = required.filter((key) => !cfg[key] || String(cfg[key]).startsWith("REPLACE_"));

  return {
    CLIENT_ID: cfg.CLIENT_ID,
    TOKEN_EXCHANGE_URL: cfg.TOKEN_EXCHANGE_URL,
    TARGET_REPO: cfg.TARGET_REPO,
    TARGET_BRANCH: cfg.TARGET_BRANCH || "main",
    OAUTH_SCOPE: cfg.OAUTH_SCOPE || "public_repo",
    OAUTH_CALLBACK_PATH: cfg.OAUTH_CALLBACK_PATH || "/login.html",
    missing
  };
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Set only from the loaded coaches/users.json, never from user input, and only
// for the admin role. Gates cross-coach READS; writes are never widened.
let adminReadAccess = false;

export function setAdminReadAccess(enabled) {
  adminReadAccess = Boolean(enabled);
}

// A team member's records live under THEIR COACH's folder, not their own, so
// the plain own-folder rule would block them from their own uploads. This
// grants exactly one extra path — that member's uploads directory — and
// nothing else. Set only from the resolved role, never from user input.
let memberWriteScope = null;

export function setMemberWriteScope(scope) {
  memberWriteScope =
    scope && scope.coach && scope.memberSlug
      ? { coach: String(scope.coach), memberSlug: String(scope.memberSlug) }
      : null;
}

function memberUploadPrefix() {
  if (!memberWriteScope) return null;
  return `coaches/${memberWriteScope.coach}/members/${memberWriteScope.memberSlug}/uploads/`;
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(COACH_KEY);
  adminReadAccess = false;
  memberWriteScope = null;
}

// The signed-in coach's GitHub login, cached so the data layer can enforce the
// per-coach path boundary without depending on React state.
export function getCoachLogin() {
  return sessionStorage.getItem(COACH_KEY);
}

export function setCoachLogin(login) {
  if (login) sessionStorage.setItem(COACH_KEY, login);
}

function assertSafePath(repoPath) {
  const path = String(repoPath || "");
  // Reject traversal outright rather than trying to normalize it away
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw new Error(`Refusing to access unsafe path: ${path}`);
  }
  return path;
}

// Every per-coach file lives under coaches/<login>/. A coach may only read or
// write inside their own folder: notes and uploads are private to the coaching
// relationship, so crossing that prefix is a boundary violation regardless of
// what the GitHub token technically permits on the repo.
export function assertOwnedPath(repoPath) {
  const login = getCoachLogin();
  if (!login) {
    throw new Error("Not authenticated — cannot resolve the current coach.");
  }
  const path = assertSafePath(repoPath);
  const prefix = `coaches/${login}/`;
  if (path.toLowerCase().startsWith(prefix.toLowerCase())) {
    return path;
  }
  // A member's own uploads folder sits under their coach's directory — the one
  // place outside their own prefix they may write
  const uploads = memberUploadPrefix();
  if (uploads && path.toLowerCase().startsWith(uploads.toLowerCase())) {
    return path;
  }
  throw new Error(
    `Access denied: "${path}" is outside your coach folder (${prefix}).`
  );
}

// Read-side boundary. Same rule as assertOwnedPath, with one exception: an
// admin may READ any coach's folder for the cross-coach view. Writes keep using
// assertOwnedPath, so an admin can never write into someone else's folder.
export function assertReadablePath(repoPath) {
  const login = getCoachLogin();
  if (!login) {
    throw new Error("Not authenticated — cannot resolve the current coach.");
  }
  const path = assertSafePath(repoPath);
  const prefix = `coaches/${login}/`;
  if (path.toLowerCase().startsWith(prefix.toLowerCase())) {
    return path;
  }
  // Admins read across coaches, but still only inside coaches/<someone>/ —
  // never arbitrary repo paths
  if (adminReadAccess && /^coaches\/[A-Za-z0-9-]+\//.test(path)) {
    return path;
  }
  // A member reads their own records and notes from their coach's folder
  if (memberWriteScope) {
    const memberRoot = `coaches/${memberWriteScope.coach}/members/${memberWriteScope.memberSlug}/`;
    const teamsFile = `coaches/${memberWriteScope.coach}/teams.json`;
    const scheduleFile = `coaches/${memberWriteScope.coach}/schedule.json`;
    const lower = path.toLowerCase();
    if (
      lower.startsWith(memberRoot.toLowerCase()) ||
      lower === teamsFile.toLowerCase() ||
      lower === scheduleFile.toLowerCase()
    ) {
      return path;
    }
  }
  throw new Error(
    `Access denied: "${path}" is outside your coach folder (${prefix}).`
  );
}

export function isOwnedPath(repoPath) {
  try {
    assertOwnedPath(repoPath);
    return true;
  } catch {
    return false;
  }
}

export function isReadablePath(repoPath) {
  try {
    assertReadablePath(repoPath);
    return true;
  } catch {
    return false;
  }
}

export function setPostLoginPath(path) {
  sessionStorage.setItem(POST_LOGIN_KEY, path || "/");
}

function buildRedirectUri() {
  const cfg = getConfig();
  return `${window.location.origin}${cfg.OAUTH_CALLBACK_PATH}`;
}

function createState() {
  const raw = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem(OAUTH_STATE_KEY, raw);
  return raw;
}

export function startSignIn(returnToPath = "/") {
  const cfg = getConfig();
  if (cfg.missing.length) {
    throw new Error(`Missing config values: ${cfg.missing.join(", ")}`);
  }

  const state = createState();
  setPostLoginPath(returnToPath);

  const params = new URLSearchParams({
    client_id: cfg.CLIENT_ID,
    redirect_uri: buildRedirectUri(),
    scope: cfg.OAUTH_SCOPE,
    state
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function validateUserIsContributor() {
  const cfg = getConfig();
  const user = await fetchCurrentUser();
  const token = getToken();
  const [repoOwner] = cfg.TARGET_REPO.split("/");

  if (user.login === repoOwner) {
    setCoachLogin(user.login);
    return user;
  }

  const response = await fetch(
    `https://api.github.com/repos/${cfg.TARGET_REPO}/collaborators/${user.login}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (response.status === 204) {
    setCoachLogin(user.login);
    return user;
  }

  if (response.status === 404) {
    throw new Error(
      `User @${user.login} is not a collaborator on ${cfg.TARGET_REPO}. Please contact the repo owner for access.`
    );
  }

  throw new Error("Failed to validate access. Please try again.");
}

export async function completeOAuthIfNeeded(search) {
  const query = new URLSearchParams((search || "").replace(/^\?/, ""));
  const code = query.get("code");
  if (!code) {
    return { changed: false };
  }

  const state = query.get("state");
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  if (!state || !expected || state !== expected) {
    throw new Error("OAuth state validation failed. Please sign in again.");
  }

  const cfg = getConfig();
  const tokenRes = await fetch(cfg.TOKEN_EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: buildRedirectUri() })
  });

  const payload = await tokenRes.json();
  if (!tokenRes.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Token exchange failed.");
  }

  sessionStorage.setItem(TOKEN_KEY, payload.access_token);
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  try {
    await validateUserIsContributor();
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw error;
  }

  const target = sessionStorage.getItem(POST_LOGIN_KEY) || "/";
  sessionStorage.removeItem(POST_LOGIN_KEY);
  return { changed: true, target };
}

function encodePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function ghRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "GitHub API request failed");
  }

  return data;
}

export async function fetchCurrentUser() {
  return ghRequest("/user");
}

export async function getExistingFileSha(repoPath) {
  const cfg = getConfig();
  const encodedPath = encodePath(repoPath);
  try {
    const data = await ghRequest(
      `/repos/${cfg.TARGET_REPO}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.TARGET_BRANCH)}`
    );
    return data.sha;
  } catch (error) {
    if (String(error.message).includes("Not Found")) {
      return null;
    }
    throw error;
  }
}

function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function putFile({ repoPath, content, message }) {
  const cfg = getConfig();
  // Every write funnels through here, so one boundary check covers them all
  assertOwnedPath(repoPath);
  const sha = await getExistingFileSha(repoPath);

  const body = {
    message,
    content,
    branch: cfg.TARGET_BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  const encodedPath = encodePath(repoPath);
  return ghRequest(`/repos/${cfg.TARGET_REPO}/contents/${encodedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function saveTextFile({ repoPath, text, message }) {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return putFile({ repoPath, content: encoded, message });
}

export async function saveUploadedFile({ repoPath, file, message }) {
  const buf = await file.arrayBuffer();
  const content = toBase64(buf);
  return putFile({ repoPath, content, message });
}

// ── Roles / user management ─────────────────────────────────────────────────

export const USERS_PATH = "coaches/users.json";

// The authoritative role store. A missing file is not an error — it means no
// roles have been assigned yet, and everyone falls back to the default role.
export async function loadUsersFile() {
  const cfg = getConfig();
  const url = `https://api.github.com/repos/${cfg.TARGET_REPO}/contents/${USERS_PATH}?ref=${encodeURIComponent(cfg.TARGET_BRANCH)}`;
  const token = getToken();
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { users: [] };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = decodeURIComponent(escape(atob((data.content || "").replace(/\n/g, ""))));
  const json = JSON.parse(text);
  return { users: json.users || [] };
}

// users.json sits outside any coach folder, so it cannot go through putFile's
// assertOwnedPath. Only the admin UI calls this.
export async function saveUsersFile(users, message) {
  const cfg = getConfig();
  const text = JSON.stringify({ users }, null, 2) + "\n";
  const content = btoa(unescape(encodeURIComponent(text)));
  const sha = await getExistingFileSha(USERS_PATH);
  const body = { message, content, branch: cfg.TARGET_BRANCH };
  if (sha) body.sha = sha;
  return ghRequest(`/repos/${cfg.TARGET_REPO}/contents/${encodePath(USERS_PATH)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

// Repo-level permission for the signed-in user: "admin" | "maintain" | "write"
// | "triage" | "read". Adding a collaborator requires "admin" on the repo —
// OAuth scope cannot substitute for it. Fails closed: any error means no.
export async function fetchRepoPermission(login) {
  const cfg = getConfig();
  const [repoOwner] = cfg.TARGET_REPO.split("/");
  if (login && login.toLowerCase() === repoOwner.toLowerCase()) return "admin";
  try {
    const data = await ghRequest(
      `/repos/${cfg.TARGET_REPO}/collaborators/${encodeURIComponent(login)}/permission`
    );
    return data.permission || null;
  } catch {
    // Non-admins often cannot read this endpoint at all — treat as not-admin
    return null;
  }
}

export async function listCollaborators() {
  const cfg = getConfig();
  const data = await ghRequest(`/repos/${cfg.TARGET_REPO}/collaborators?per_page=100`);
  return (data || []).map((c) => ({
    login: c.login,
    permission: c.role_name || (c.permissions?.admin ? "admin" : c.permissions?.push ? "write" : "read"),
  }));
}

// Adds a repo collaborator. Requires the CALLER to have admin on the repo.
// 201 = invitation created (the person must accept it — you cannot force-add),
// 204 = already a collaborator. 403/404 = caller lacks admin.
export async function inviteCollaborator(username, permission = "push") {
  const cfg = getConfig();
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  if (!/^[A-Za-z0-9-]+$/.test(String(username || ""))) {
    throw new Error(`Invalid GitHub username: ${username}`);
  }
  const res = await fetch(
    `https://api.github.com/repos/${cfg.TARGET_REPO}/collaborators/${encodeURIComponent(username)}`,
    {
      method: "PUT",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ permission })
    }
  );

  if (res.status === 204) return { status: "already", message: `@${username} already has access.` };
  if (res.status === 201) {
    return { status: "invited", message: `Invitation sent to @${username}. They must accept it before they can sign in.` };
  }
  if (res.status === 403 || res.status === 404) {
    throw new Error(
      `Could not invite @${username}. Adding collaborators requires admin permission on ${cfg.TARGET_REPO}, or the username does not exist.`
    );
  }
  const data = await res.json().catch(() => ({}));
  throw new Error(data.message || `Failed to invite @${username} (HTTP ${res.status}).`);
}

// Discovers every coach with data, straight from the git tree — no registry
// file to keep in sync. The tree is already fetched for note listing.
export async function listAllCoaches() {
  const cfg = getConfig();
  const tree = await ghRequest(
    `/repos/${cfg.TARGET_REPO}/git/trees/${encodeURIComponent(cfg.TARGET_BRANCH)}?recursive=1`
  );
  const found = new Set();
  (tree.tree || []).forEach((node) => {
    const m = /^coaches\/([A-Za-z0-9-]+)\/teams\.json$/.exec(node.path || "");
    if (m) found.add(m[1]);
  });
  return [...found].sort();
}

export async function listCoachNoteFiles(coachUsername) {
  const cfg = getConfig();
  // GitHub logins are alphanumeric with hyphens; reject anything else rather
  // than interpolating unvalidated input into a RegExp
  if (!/^[A-Za-z0-9-]+$/.test(String(coachUsername || ""))) {
    throw new Error(`Invalid coach username: ${coachUsername}`);
  }
  const tree = await ghRequest(
    `/repos/${cfg.TARGET_REPO}/git/trees/${encodeURIComponent(cfg.TARGET_BRANCH)}?recursive=1`
  );

  const pattern = new RegExp(`^coaches/${coachUsername}/members/[^/]+/notes/.*\\.txt$`, "i");
  return (tree.tree || []).filter(
    (node) => node.type === "blob" && pattern.test(node.path)
  );
}

// Notes belong to the coaching relationship that produced them, so this lists
// only the signed-in coach's own notes. It previously returned every coach's
// notes across the repo, which let any coach read another's private notes.
export async function listMemberNoteFiles() {
  const login = getCoachLogin();
  if (!login) throw new Error("Not authenticated — cannot list notes.");
  return listCoachNoteFiles(login);
}

export async function readTextFile(repoPath) {
  const cfg = getConfig();
  // Reading a note's contents is the point at which private text is exposed,
  // so enforce the coach boundary here and not only at the listing layer.
  // Admins may read across coaches; everyone else is confined to their own folder.
  assertReadablePath(repoPath);
  const encodedPath = encodePath(repoPath);
  const file = await ghRequest(
    `/repos/${cfg.TARGET_REPO}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.TARGET_BRANCH)}`
  );

  const base64 = (file.content || "").replace(/\n/g, "");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
