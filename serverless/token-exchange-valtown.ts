// Val Town HTTP function — the only server component in this architecture.
//
// Three routes:
//   POST /          OAuth code -> token exchange (unchanged, original behavior)
//   POST /encrypt   { token, path, plaintext } -> { ciphertext }
//   POST /decrypt   { token, path }            -> { plaintext }
//
// WHY THE CRYPTO LIVES HERE, NOT IN THE BROWSER
// The frontend is a static bundle on GitHub Pages — anything shipped in it is
// public, and window.APP_CONFIG is even writable from the console. A key handed
// to the browser is a published key. So the key never leaves this function:
// callers send a path, we verify they own it, and we return plaintext.
//
// CORS IS NOT AUTHENTICATION. Access-Control-Allow-Origin is enforced by
// browsers; curl ignores it entirely. Every privileged route below therefore
// verifies the caller's GitHub token server-side. Do not remove those checks on
// the assumption that CORS restricts who can call this.
//
// Env vars:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  — OAuth app (token exchange)
//   ALLOWED_ORIGIN                          — exact frontend origin
//   NOTE_ENCRYPTION_KEY                     — base64 32 bytes (AES-256-GCM)
//   TARGET_REPO                             — "owner/repo" the notes live in
//
// Generate a key with:
//   crypto.getRandomValues(new Uint8Array(32)) -> base64
// BACK IT UP. Losing it means every encrypted note is unrecoverable.

const GITHUB_API = "https://api.github.com";

// Rate limit: per-login cap over a rolling window. A decryption endpoint
// without this is a quiet bulk-exfiltration path.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, number[]>();

// Small in-memory identity cache so each note read does not cost two GitHub
// API calls. Short TTL: revoking access should take effect quickly.
const IDENTITY_TTL_MS = 60_000;
const identityCache = new Map<string, { login: string; at: number }>();

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── crypto ──────────────────────────────────────────────────────────────────

function b64encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64decode(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ""));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("NOTE_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error("NOTE_ENCRYPTION_KEY is not configured");
  }
  const bytes = b64decode(raw);
  if (bytes.length !== 32) {
    throw new Error("NOTE_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// Output layout: base64( iv[12] || ciphertext+tag ). A fresh IV per note is
// mandatory — reusing an IV under the same key breaks GCM badly.
async function encryptText(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return b64encode(out);
}

async function decryptText(payload: string): Promise<string> {
  const key = await getKey();
  const bytes = b64decode(payload);
  if (bytes.length <= 12) {
    throw new Error("Ciphertext is too short to contain an IV");
  }
  const iv = bytes.subarray(0, 12);
  const cipher = bytes.subarray(12);
  // Throws if the GCM auth tag fails — i.e. the data was tampered with
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// ── caller identity ─────────────────────────────────────────────────────────

async function resolveCaller(token: string): Promise<string | null> {
  if (!token || typeof token !== "string") return null;

  const cached = identityCache.get(token);
  if (cached && Date.now() - cached.at < IDENTITY_TTL_MS) {
    return cached.login;
  }

  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null;
  const user = await res.json();
  const login = user?.login;
  if (!login) return null;

  identityCache.set(token, { login, at: Date.now() });
  return login;
}

async function isCollaborator(token: string, repo: string, login: string): Promise<boolean> {
  const [owner] = repo.split("/");
  if (login.toLowerCase() === owner.toLowerCase()) return true;
  const res = await fetch(`${GITHUB_API}/repos/${repo}/collaborators/${login}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  return res.status === 204;
}

// Reads a repo file with the CALLER's token. Using their token rather than a
// privileged one means we can never read something they could not read anyway.
async function readRepoFile(token: string, repo: string, path: string): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const b64 = (data.content || "").replace(/\n/g, "");
  return new TextDecoder().decode(b64decode(b64));
}

// Role comes from coaches/users.json in the repo, never from the request body —
// a client-supplied "I am an admin" claim proves nothing to a server.
async function resolveRole(
  token: string,
  repo: string,
  login: string,
): Promise<{ role: string; coach?: string; memberSlug?: string }> {
  const text = await readRepoFile(token, repo, "coaches/users.json");
  if (!text) return { role: "coach" }; // unlisted defaults to coach, matching the app
  try {
    const users = JSON.parse(text)?.users || [];
    const entry = users.find(
      (u: { githubLogin?: string }) =>
        String(u.githubLogin || "").toLowerCase() === login.toLowerCase(),
    );
    if (!entry || !["admin", "coach", "member"].includes(entry.role)) return { role: "coach" };
    return { role: entry.role, coach: entry.coach, memberSlug: entry.memberSlug };
  } catch {
    return { role: "coach" };
  }
}

// ── path authorization ──────────────────────────────────────────────────────
// Mirrors assertOwnedPath / assertReadablePath in src/lib/githubAuth.js. It is
// re-implemented here deliberately: a client-side check proves nothing to a
// server, so this must stand on its own.

function isSafePath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return /^coaches\/[A-Za-z0-9-]+\//.test(path);
}

function isNotePath(path: string): boolean {
  return /^coaches\/[A-Za-z0-9-]+\/members\/[^/]+\/notes\/[^/]+\.txt$/i.test(path);
}

function pathCoach(path: string): string | null {
  const m = /^coaches\/([A-Za-z0-9-]+)\//.exec(path);
  return m ? m[1] : null;
}

function pathMemberSlug(path: string): string | null {
  const m = /^coaches\/[A-Za-z0-9-]+\/members\/([^/]+)\/notes\//i.exec(path);
  return m ? m[1] : null;
}

function authorizePath(
  path: string,
  login: string,
  role: { role: string; coach?: string; memberSlug?: string },
  action: "encrypt" | "decrypt",
): { ok: true } | { ok: false; reason: string } {
  if (!isSafePath(path)) return { ok: false, reason: "Unsafe or malformed path" };
  if (!isNotePath(path)) return { ok: false, reason: "Not a note path" };

  const coach = pathCoach(path);
  const slug = pathMemberSlug(path);

  // A coach works only inside their own folder
  if (coach && coach.toLowerCase() === login.toLowerCase()) return { ok: true };

  // Admins may read across coaches, but never write
  if (role.role === "admin") {
    if (action === "decrypt") return { ok: true };
    return { ok: false, reason: "Admins have read-only access" };
  }

  // A member may read only notes about themselves, in their own coach's folder
  if (role.role === "member") {
    if (action !== "decrypt") return { ok: false, reason: "Members cannot write notes" };
    if (!role.coach || !role.memberSlug) {
      return { ok: false, reason: "Member is not linked to a member record" };
    }
    if (coach?.toLowerCase() !== role.coach.toLowerCase()) {
      return { ok: false, reason: "Note belongs to a different coach" };
    }
    if (slug !== role.memberSlug) {
      return { ok: false, reason: "Note is about a different member" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "Path is outside your own folder" };
}

// The Visibility header gates member access. Checked HERE rather than in the
// browser so a member can never obtain the plaintext of a private note about
// themselves — previously the client fetched every note just to read this.
function isNoteShared(noteText: string): boolean {
  const head = String(noteText || "").split(/\r?\n\r?\n/)[0] || "";
  return /^Visibility:\s*shared\s*$/im.test(head);
}

// ── rate limiting + audit ───────────────────────────────────────────────────

function rateLimited(login: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(login) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(login, hits);
  return hits.length > RATE_LIMIT_MAX;
}

// Records who touched what. Deliberately never logs the token or the plaintext.
function audit(entry: {
  login: string;
  path: string;
  action: string;
  allowed: boolean;
  reason?: string;
}) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), type: "note-access", ...entry }),
  );
}

// ── routes ──────────────────────────────────────────────────────────────────

async function handleCrypto(
  req: Request,
  cors: Record<string, string>,
  action: "encrypt" | "decrypt",
) {
  const repo = Deno.env.get("TARGET_REPO");
  if (!repo) return jsonResponse({ error: "TARGET_REPO is not configured" }, 500, cors);
  if (!Deno.env.get("NOTE_ENCRYPTION_KEY")) {
    return jsonResponse({ error: "NOTE_ENCRYPTION_KEY is not configured" }, 500, cors);
  }

  let payload: { token?: string; path?: string; plaintext?: string; ciphertext?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const token = payload?.token;
  const path = String(payload?.path || "");
  if (!token) return jsonResponse({ error: "Missing token" }, 401, cors);

  const login = await resolveCaller(token);
  if (!login) return jsonResponse({ error: "Invalid or expired GitHub token" }, 401, cors);

  if (rateLimited(login)) {
    audit({ login, path, action, allowed: false, reason: "rate limited" });
    return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429, cors);
  }

  if (!(await isCollaborator(token, repo, login))) {
    audit({ login, path, action, allowed: false, reason: "not a collaborator" });
    return jsonResponse({ error: "Not a collaborator on this repository" }, 403, cors);
  }

  const role = await resolveRole(token, repo, login);
  const verdict = authorizePath(path, login, role, action);
  if (!verdict.ok) {
    audit({ login, path, action, allowed: false, reason: verdict.reason });
    return jsonResponse({ error: `Access denied: ${verdict.reason}` }, 403, cors);
  }

  try {
    if (action === "encrypt") {
      if (typeof payload.plaintext !== "string") {
        return jsonResponse({ error: "Missing plaintext" }, 400, cors);
      }
      const ciphertext = await encryptText(payload.plaintext);
      audit({ login, path, action, allowed: true });
      return jsonResponse({ ciphertext }, 200, cors);
    }

    // decrypt: members only ever see notes explicitly marked shared
    if (role.role === "member") {
      const noteText = await readRepoFile(token, repo, path);
      if (noteText === null) return jsonResponse({ error: "Note not found" }, 404, cors);
      if (!isNoteShared(noteText)) {
        audit({ login, path, action, allowed: false, reason: "note is private" });
        return jsonResponse({ error: "This note has not been shared with you." }, 403, cors);
      }
    }

    if (typeof payload.ciphertext !== "string") {
      return jsonResponse({ error: "Missing ciphertext" }, 400, cors);
    }
    const plaintext = await decryptText(payload.ciphertext);
    audit({ login, path, action, allowed: true });
    return jsonResponse({ plaintext }, 200, cors);
  } catch (error) {
    audit({ login, path, action, allowed: false, reason: "crypto failure" });
    return jsonResponse(
      { error: `Unable to ${action}: ${(error as Error).message}` },
      400,
      cors,
    );
  }
}

export default async function (req: Request): Promise<Response> {
  const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://username.github.io";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  const { pathname } = new URL(req.url);
  if (pathname.endsWith("/encrypt")) return handleCrypto(req, cors, "encrypt");
  if (pathname.endsWith("/decrypt")) return handleCrypto(req, cors, "decrypt");

  // ── default route: OAuth token exchange (original behavior, unchanged) ────
  const payload = await req.json();
  const code = payload?.code;
  const redirectUri = payload?.redirect_uri;
  if (!code || !redirectUri) {
    return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: Deno.env.get("GITHUB_CLIENT_ID"),
      client_secret: Deno.env.get("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri
    })
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
