---
name: github-pages
description: Build a static site on GitHub Pages where browser JavaScript lets a signed-in GitHub user upload files into a repository, using GitHub OAuth plus a tiny serverless function for the token exchange. This skill covers the full path from zero — creating the repo, enabling Pages, registering the OAuth app, picking and deploying the serverless function, and writing the frontend. Use whenever the user wants to upload, commit, save, or write files to a GitHub repo from a static frontend, from GitHub Pages, from a "no-backend" site, or whenever they ask how to authenticate users with GitHub from client-side JS to write to a repo. Also use for related tasks like building a CMS-style editor, a drop-zone that commits to a repo, a form whose submissions become files in a repo, or a multi-coach team management portal backed by repo JSON.
---

# GitHub Pages File Uploader (OAuth)

End goal: a static site hosted on GitHub Pages where visitors click "Sign in with GitHub," pick a file, and the file gets committed to a repository via the GitHub Contents API — with one tiny serverless function handling the OAuth token exchange.

This skill is comprehensive. It walks the user from "I have a GitHub account and nothing else" through to a working deployed uploader.

## Pipeline mode (recommended)

When the user asks for an end-to-end setup, run this skill as a guided pipeline instead of a static tutorial.

Pipeline phases:

1. Intake and prerequisites
2. Repo and Pages setup
3. Domain mapping (optional but common)
4. OAuth app setup
5. Server-side token exchange setup (Val Town default)
6. Frontend wiring (config + login callback + upload pages)
7. Verification gates (auth, CORS, commit/write, deployed URL)

The skill should explicitly ask for missing information, make decisions based on answers, apply updates, and then verify outcomes before claiming success.

## How to use this skill

**Interview the user first.** Don't dump the whole walkthrough on them. Figure out where they are and tailor the steps. Ask, in roughly this order, only the questions whose answers you don't already know:

1. Do they have an existing repo they want to upload *into*, or do they need to create one? (The target repo can be the same as or different from the repo hosting the Pages site.)
2. Do they have a GitHub Pages site already, or do they need to set one up?
3. Public or private target repo? (Affects OAuth scope.)
4. Which serverless platform do they want for the token-exchange function? Default recommendations:
   - **Val Town** if they want the absolute fastest path (paste code in a browser, get a URL).
   - **Cloudflare Workers** if they want something durable with no cold starts.
   - **Vercel** or **Netlify** if they've used those before.
   - Mention **Device Flow** as a zero-backend alternative if they're allergic to deploying a function.
5. Just them, or other users too? (Determines access control strategy: repo owner + collaborators, or open to any GitHub user.)
6. What's the use case shape — generic file picker, drag-and-drop images, form-submissions-as-markdown, CMS editor? (Affects the frontend.)
7. Are they using a custom domain (for example, `nrg.example.com`) or only the default GitHub Pages URL?
8. If custom domain: is DNS already mapped, and which DNS provider controls the zone (Cloudflare, Squarespace, GoDaddy, etc.)?
9. What callback route should be used for OAuth completion (for example, `/login.html`)?

If they do not know whether DNS is mapped, treat it as "unknown" and run verification checks before proceeding.

### Intake template (use before implementation)

Collect these values first:

- GitHub org/user and target repo (`owner/name`)
- Pages host repo (`owner/name`) and branch/folder source
- Pages URL (default GitHub URL)
- Custom domain (optional)
- DNS mapped status (`yes`, `no`, `unknown`)
- OAuth app name, client ID, client secret status
- Token exchange platform (default: Val Town)
- Allowed origin for CORS (exact origin only)
- OAuth scope (`public_repo` or `repo`)
- Callback path (`/login.html` recommended for multi-page apps)
- Access control policy: repo owner + collaborators (recommended), or open to any GitHub user

Then walk them through the relevant sections below in order. Skip sections that don't apply.

---

## Section 1 — Create the target repo (skip if they have one)

The repo where uploaded files will land.

1. Direct them to https://github.com/new
2. Name it (e.g. `my-uploads`). Public or private — their choice; affects the OAuth scope later (`public_repo` vs `repo`).
3. **Check "Add a README file"** so the repo has a default branch (`main`) with at least one commit. Without an initial commit the Contents API has nothing to write against.
4. Click "Create repository".

Note the `owner/name` — they'll need it.

---

## Section 2 — Create the Pages site (skip if they have one)

The static site that visitors load in their browser.

**Option A: same repo as the target.** Simplest. The uploader page lives in the same repo it's writing to. Fine for a personal tool.

**Option B: separate repo for the site.** Cleaner separation. Required if the uploader writes to multiple repos.

**Option C: `<username>.github.io` user site.** If they want the site at `https://<username>.github.io` (no `/repo/` path), the repo must be named exactly `<username>.github.io`. Otherwise the site lives at `https://<username>.github.io/<repo>/`.

**Steps to enable Pages on whichever repo will host the frontend:**

1. In that repo: **Settings → Pages**.
2. Under "Build and deployment," set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/ (root)`.
4. Save. After ~1 minute the page will show the live URL.

Tell the user the URL — they'll need it for the OAuth app and the function's CORS config.

### Section 2B — Custom domain mapping (decision-based)

Run this section whenever the user wants a branded URL.

Decision flow:

1. If mapped = `yes`: verify DNS resolution and HTTPS reachability.
2. If mapped = `no`: provide exact DNS records to add, then verify propagation.
3. If mapped = `unknown`: check first; if missing, continue with record setup.

Required GitHub-side steps:

1. In repo Settings -> Pages, set Custom domain.
2. Ensure HTTPS enforcement is enabled after certificate issuance.
3. Confirm `CNAME` file exists at repo root with the exact domain.

DNS guidance:

- For subdomains (recommended): add a `CNAME` record pointing to `<username>.github.io`.
- For apex/root domains: use provider-supported `A/ALIAS/ANAME` records per GitHub docs.
- Wait for propagation, then verify with DNS + HTTP checks before moving to OAuth.

Critical rule:

- Do not finalize OAuth URLs or CORS origin until the final serving origin is known.

---

## Section 3 — Register the OAuth App

1. Send them to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: anything (e.g. "My Uploader").
  - **Homepage URL**: final serving URL (custom domain if used), e.g. `https://nrg.example.com/`.
  - **Authorization callback URL**: exact callback route, e.g. `https://nrg.example.com/login.html`.
3. **Register application**.
4. On the next page: copy the **Client ID** — this is public, it goes in the frontend.
5. Click **Generate a new client secret** — copy it immediately, you won't see it again. This is **secret**, it goes in the serverless function's env vars, never in the frontend.

**Scope to request later** (set in the frontend, not here):
- `public_repo` — public repos only. Use this if possible.
- `repo` — required if the target repo is private. Broader access; users see this at the consent screen.

Update rule for migrations:

- If domain or callback path changes later, update OAuth app URLs immediately, then redeploy/refresh frontend config and retest.

---

## Section 4 — Deploy the token-exchange function

This is the only piece that can't run in the browser, because it needs the client secret. The function does exactly one thing: receives a `code` from the frontend, POSTs it plus the client secret to GitHub, returns the token. ~20 lines of code.

Default for this skill: **Val Town** unless the user asks for another platform.

Server-side login feature requirements (must enforce):

1. Accept `POST` with `{ code }` only.
2. Read `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from env vars only.
3. Restrict CORS to one exact `ALLOWED_ORIGIN`.
4. Support `OPTIONS` for preflight.
5. Return GitHub token payload as JSON.
6. Never expose client secret in frontend code or committed files.

**Pick one of the following platforms.** The function logic is identical across all of them — only the wrapper differs.

### 4A — Val Town (fastest, browser-only setup)

Best when the user wants minimum friction and no CLI.

1. Sign up at https://www.val.town (free).
2. Click **New val → HTTP**.
3. Paste:

   ```ts
   export default async function (req: Request): Promise<Response> {
     const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "";
     const cors = {
       "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
     };
     if (req.method === "OPTIONS") return new Response(null, { headers: cors });
     if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

     const { code } = await req.json();
     if (!code) return new Response("Missing code", { status: 400, headers: cors });

     const res = await fetch("https://github.com/login/oauth/access_token", {
       method: "POST",
       headers: { "Content-Type": "application/json", Accept: "application/json" },
       body: JSON.stringify({
         client_id: Deno.env.get("GITHUB_CLIENT_ID"),
         client_secret: Deno.env.get("GITHUB_CLIENT_SECRET"),
         code,
       }),
     });
     const data = await res.json();
     return new Response(JSON.stringify(data), {
       headers: { ...cors, "Content-Type": "application/json" },
     });
   }
   ```

4. In the val's settings, add **Environment Variables**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `ALLOWED_ORIGIN`.
  - Prefer reading `ALLOWED_ORIGIN` from env instead of hardcoding the origin in source.
5. Copy the val's public URL — looks like `https://username-uploader.web.val.run`. That's the `WORKER_URL` for the frontend.

Val Town operational notes:

- Keep one stable val endpoint and rotate env secrets there when needed.
- If custom domain is introduced later, update `ALLOWED_ORIGIN` to the new origin before retesting OAuth.

### 4B — Cloudflare Workers (durable, no cold starts)

1. Sign up at https://workers.cloudflare.com (free tier: 100k requests/day).
2. Install Wrangler: `npm install -g wrangler` then `wrangler login`.
3. `wrangler init token-exchange` → pick "Hello World Worker," TypeScript or JS, no for the extras.
4. Replace `src/index.js` (or `index.ts`) with:

   ```js
   export default {
     async fetch(request, env) {
       const cors = {
         "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
         "Access-Control-Allow-Methods": "POST, OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type",
       };
       if (request.method === "OPTIONS") return new Response(null, { headers: cors });
       if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

       const { code } = await request.json();
       if (!code) return new Response("Missing code", { status: 400, headers: cors });

       const res = await fetch("https://github.com/login/oauth/access_token", {
         method: "POST",
         headers: { "Content-Type": "application/json", Accept: "application/json" },
         body: JSON.stringify({
           client_id: env.GITHUB_CLIENT_ID,
           client_secret: env.GITHUB_CLIENT_SECRET,
           code,
         }),
       });
       const data = await res.json();
       return new Response(JSON.stringify(data), {
         headers: { ...cors, "Content-Type": "application/json" },
       });
     },
   };
   ```

5. Add the public env var to `wrangler.toml`:

   ```toml
   [vars]
   ALLOWED_ORIGIN = "https://username.github.io"
   ```

6. Add the secrets (these prompt for the value, never written to disk):

   ```
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```

7. `wrangler deploy`. It prints a URL like `https://token-exchange.<subdomain>.workers.dev`. That's the `WORKER_URL`.

### 4C — Vercel

1. Sign up at https://vercel.com.
2. Make a folder, e.g. `mkdir token-exchange && cd token-exchange`.
3. Create `api/token.js`:

   ```js
   export default async function handler(req, res) {
     res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN);
     res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
     res.setHeader("Access-Control-Allow-Headers", "Content-Type");
     if (req.method === "OPTIONS") return res.status(204).end();
     if (req.method !== "POST") return res.status(405).end();

     const { code } = req.body;
     if (!code) return res.status(400).json({ error: "Missing code" });

     const r = await fetch("https://github.com/login/oauth/access_token", {
       method: "POST",
       headers: { "Content-Type": "application/json", Accept: "application/json" },
       body: JSON.stringify({
         client_id: process.env.GITHUB_CLIENT_ID,
         client_secret: process.env.GITHUB_CLIENT_SECRET,
         code,
       }),
     });
     res.status(200).json(await r.json());
   }
   ```

4. `npm install -g vercel` then `vercel` in the folder. Follow prompts to deploy.
5. In the Vercel dashboard for the project: **Settings → Environment Variables**. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`. Redeploy.
6. Endpoint is `https://<project>.vercel.app/api/token`. That's the `WORKER_URL`.

### 4D — Netlify

1. Sign up at https://www.netlify.com.
2. Make a folder. Create `netlify/functions/token.js`:

   ```js
   export const handler = async (event) => {
     const cors = {
       "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN,
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
     };
     if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
     if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors };

     const { code } = JSON.parse(event.body || "{}");
     if (!code) return { statusCode: 400, headers: cors, body: "Missing code" };

     const r = await fetch("https://github.com/login/oauth/access_token", {
       method: "POST",
       headers: { "Content-Type": "application/json", Accept: "application/json" },
       body: JSON.stringify({
         client_id: process.env.GITHUB_CLIENT_ID,
         client_secret: process.env.GITHUB_CLIENT_SECRET,
         code,
       }),
     });
     return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: await r.text() };
   };
   ```

3. Add a `netlify.toml`:

   ```toml
   [build]
     functions = "netlify/functions"
   ```

4. `npm install -g netlify-cli` then `netlify deploy --prod`.
5. Set env vars in the Netlify dashboard: **Site settings → Environment variables**.
6. Endpoint: `https://<site>.netlify.app/.netlify/functions/token`.

### 4E — Device Flow (no backend at all)

If the user really refuses to deploy anything: GitHub's Device Flow works fully from the browser. The UX:

1. Frontend POSTs to `https://github.com/login/device/code` with `client_id` and `scope` → gets back a `user_code` and a `verification_uri`.
2. Page displays the code and tells the user to open `https://github.com/login/device` in another tab and type it in.
3. Page polls `https://github.com/login/oauth/access_token` every ~5 seconds with the `device_code` until the user approves and a token comes back.

Clunkier UX, and the OAuth app must have "Enable Device Flow" checked in its settings, but no client secret is ever needed. Offer this only if backend hosting is a hard blocker.

---

## Section 5 — The frontend (`index.html`)

Single file, no build step. Goes in the root of the Pages-hosting repo on `main`.

```html
<!doctype html>
<meta charset="utf-8" />
<title>GitHub Uploader</title>
<style>
  body { font-family: system-ui; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  label { display: block; margin: 0.75rem 0 0.25rem; }
  input, button { font: inherit; padding: 0.5rem; }
  #log { white-space: pre-wrap; background: #f4f4f4; padding: 1rem; margin-top: 1rem; }
</style>

<h1>GitHub uploader</h1>

<div id="signed-out" hidden>
  <button id="signin">Sign in with GitHub</button>
</div>

<div id="signed-in" hidden>
  <p>Signed in as <b id="who"></b>. <button id="signout">Sign out</button></p>
  <label>Repo (owner/name)<input id="repo" placeholder="octocat/hello-world" /></label>
  <label>Branch<input id="branch" value="main" /></label>
  <label>Path in repo<input id="path" placeholder="uploads/myfile.txt" /></label>
  <label>File<input id="file" type="file" /></label>
  <label>Commit message<input id="msg" value="Upload via web" /></label>
  <button id="upload">Upload</button>
</div>

<pre id="log"></pre>

<script type="module">
  // ---- CONFIG -----------------------------------------------------------
  const CLIENT_ID  = "YOUR_OAUTH_CLIENT_ID";
  const WORKER_URL = "https://your-function-url.example.com/";
  const SCOPE      = "public_repo"; // or "repo" for private
  // -----------------------------------------------------------------------

  const log = (...a) => { document.getElementById("log").textContent += a.join(" ") + "\n"; };
  const $ = id => document.getElementById(id);

  // 1. Handle the OAuth redirect, if any.
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const r = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (data.access_token) {
        sessionStorage.setItem("gh_token", data.access_token);
      } else {
        log("Token exchange failed:", JSON.stringify(data));
      }
    } catch (e) {
      log("Token exchange error:", e.message);
    }
    history.replaceState({}, "", url.pathname); // clean ?code= out
  }

  // 2. Render the right view based on whether we have a token.
  const token = sessionStorage.getItem("gh_token");
  if (!token) {
    $("signed-out").hidden = false;
    $("signin").onclick = () => {
      const redirect = encodeURIComponent(location.origin + location.pathname);
      location.href =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${CLIENT_ID}&scope=${SCOPE}&redirect_uri=${redirect}`;
    };
  } else {
    $("signed-in").hidden = false;
    $("signout").onclick = () => { sessionStorage.removeItem("gh_token"); location.reload(); };

    const me = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    $("who").textContent = me.login || "(unknown)";

    $("upload").onclick = async () => {
      const repo   = $("repo").value.trim();
      const branch = $("branch").value.trim();
      const path   = $("path").value.trim();
      const msg    = $("msg").value.trim();
      const file   = $("file").files[0];
      if (!repo || !path || !file) { log("Repo, path, and file required."); return; }

      // Read file → base64 (small files only; see "gotchas" for big ones).
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      // If file already exists at that path on that branch, we need its sha to update.
      let sha;
      const head = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (head.ok) sha = (await head.json()).sha;

      const put = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: msg, content: b64, branch, ...(sha && { sha }) }),
        },
      );
      const result = await put.json();
      if (put.ok) {
        log("Uploaded:", result.content.html_url);
      } else {
        log("Upload failed:", JSON.stringify(result, null, 2));
      }
    };
  }
</script>
```

**To deploy:**

1. Save as `index.html` in the Pages-hosting repo on `main`.
2. Wait ~1 minute for Pages to rebuild.
3. Visit the Pages URL. Sign in. Upload a small text file to a test repo. Confirm it appears in the repo's commits.

For multi-page workshop portals, prefer a shared config file containing:

- `CLIENT_ID`
- `TOKEN_EXCHANGE_URL`
- `TARGET_REPO`
- `OAUTH_SCOPE`
- `OAUTH_CALLBACK_PATH` (for example `/login.html`)

This keeps login/callback behavior consistent across `index.html`, `login.html`, uploads, notes, and discussions pages.

Cache note:

- If callback or domain settings are updated, cache-bust config script includes (for example `config.js?v=YYYYMMDD`) to avoid stale browser config.

---

## Section 5B — Access Control: Repo Owner + Collaborators (recommended)

By default, anyone who signs in with a GitHub account can upload. To restrict access to a team:

**Backend (token-exchange function):** No changes needed. The function accepts valid tokens and returns them.

**Frontend:** After sign-in, validate that the user is the repo owner or a collaborator:

```javascript
// Call this after the OAuth callback, before rendering the upload UI
async function validateUserIsContributor() {
  const cfg = getConfig(); // assumes TARGET_REPO is in config
  const user = await fetchCurrentUser(); // call GET /user with token
  const token = getToken(); // from sessionStorage
  const [repoOwner] = cfg.TARGET_REPO.split("/");
  
  // Owner of repo always has access
  if (user.login === repoOwner) {
    return user;
  }
  
  // Check if user is a collaborator
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
    return user; // User is a collaborator
  } else if (response.status === 404) {
    throw new Error(`Access denied: @${user.login} is not a collaborator on ${cfg.TARGET_REPO}`);
  } else {
    throw new Error("Failed to validate access.");
  }
}
```

**Managing access:** Go to your target repo's **Settings → Collaborators and teams** and add team members. They'll be allowed immediately on next sign-in.

**For single-user tools:** Add only yourself as the collaborator (the owner always has access, so this is redundant but explicit).

**For team portals:** Add each team member individually, or create a GitHub team and add the team to the repo.

---

## Section 6 — Troubleshooting checklist

If something doesn't work, walk through these in order:

1. **Pages URL 404s** → Settings → Pages, confirm source branch is `main` and root, wait another minute.
2. **"Redirect URI mismatch" on sign-in** → the OAuth app's callback URL must match `location.origin + location.pathname` from the frontend character-for-character, including trailing slash.
3. **CORS error from the function** → `ALLOWED_ORIGIN` env var must exactly match the Pages origin: `https://username.github.io` (no path, no trailing slash).
4. **Token exchange returns `bad_verification_code`** → the code from GitHub is single-use and expires in 10 minutes. Usually means the page reloaded or the code was used twice; sign in again.
5. **`401` from the upload PUT** → token is missing or scope is wrong. Sign out, sign in again. For private repos make sure `SCOPE = "repo"`.
6. **`404` from the upload PUT to a repo that exists** → the user authenticating doesn't have write access to that repo, or the repo is private and the scope is only `public_repo`.
7. **`409` from the upload PUT** → file at that path already exists and the request didn't include its `sha`. The template handles this with the HEAD fetch; if a user pasted an older snippet they may be missing it.
8. **Worker secret values blank** → on Cloudflare, `wrangler secret put` only stages on deploy; run `wrangler deploy` after adding them.
9. **Works on default Pages URL but fails on custom domain** → OAuth Homepage/Callback and token-exchange `ALLOWED_ORIGIN` still reference the old origin.
10. **Login succeeds but returns to wrong page** → `redirect_uri` and callback path do not match exactly (`/` vs `/login.html`).

---

## Section 7 — Deployment and verification gates

Treat setup as incomplete until all gates pass:

1. Pages gate: site responds with `200` at the final public URL.
2. Domain gate (if custom): DNS resolves to GitHub Pages target and HTTPS is valid.
3. OAuth gate: sign-in redirects correctly and returns an access token.
4. CORS gate: token-exchange function accepts frontend origin and blocks non-allowed origins.
5. Write gate: test upload creates or updates a file in target repo with a commit.
6. Runtime config gate: deployed frontend serves current config values.

If any gate fails, do not continue to "done" messaging; fix and rerun the failed gate.

---

## Section 8 — Agent behavior for this skill

When running as an automated assistant:

1. Ask only for missing inputs from the intake template.
2. Choose defaults when user is unsure:
  - Token exchange platform: Val Town
  - Callback path: `/login.html`
  - Scope: `public_repo` unless private repo access is required
3. Apply updates in dependency order: domain -> OAuth/CORS -> frontend config -> verification.
4. Summarize exactly what changed (URLs, callback, origin, env vars, files).
5. Call out manual steps clearly when user login/approval is required.

This makes the skill a repeatable pipeline for GitHub Pages deployments that need authenticated GitHub API writes from the browser.

---

## Section 9 — Evolved pattern: Multi-coach SPA with repo-backed JSON data

This section documents the patterns that emerge when the basic uploader grows into a full team-management portal (e.g. NRG Coaching Hub). Apply these when the app needs structured data records (teams, members, rosters) rather than raw file uploads.

### 9A — Per-user data scoping

Store each user's structured data under `<data-root>/<github-username>/`. Resolve the username after OAuth with `GET /user`, then read/write only from that user's path.

```
coaches/<github-username>/teams.json        ← team + member roster
coaches/<github-username>/members/<slug>/notes/<date>_<ts>.txt
coaches/<github-username>/members/<slug>/uploads/<ts>_<file>
```

Benefits:
- No auth needed on reads (GitHub public repo); each coach only edits their own path.
- Merges and conflicts are isolated per coach.
- `teamsPath = "coaches/" + username + "/teams.json"` is derived at runtime from the OAuth user.

### 9B — React Context for structured data (`TeamsContext` pattern)

Wrap the per-user JSON load in a React Context so all pages share the same data:

```jsx
// TeamsContext.jsx (key parts)
export function TeamsProvider({ children }) {
  const { coachUsername } = useAuth();
  const [teams, setTeams] = useState([]);

  const teamsPath = coachUsername ? `coaches/${coachUsername}/teams.json` : null;

  const load = useCallback(async () => {
    if (!coachUsername) return;
    const url = `https://api.github.com/repos/${TARGET_REPO}/contents/${teamsPath}?ref=${TARGET_BRANCH}`;
    const res = await fetch(url, { headers, cache: "no-store" });   // ← cache:no-store is critical
    const data = await res.json();
    const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
    setTeams(JSON.parse(text).teams || []);
  }, [coachUsername]);

  // Expose direct state setter for optimistic updates (see 9C)
  const updateTeams = useCallback((newTeams) => setTeams(newTeams), []);

  const allMembers = useMemo(() =>
    teams.flatMap(t => (t.members || []).map(m => ({ ...m, team: t.name, teamSlug: t.slug, teamColor: t.color }))),
    [teams]
  );

  return (
    <TeamsContext.Provider value={{ teams, allMembers, loading, error, reload: load, updateTeams, teamsPath }}>
      {children}
    </TeamsContext.Provider>
  );
}
```

### 9C — Optimistic updates (database-feel without a database)

Instead of re-fetching from GitHub after a write (which can return cached/stale data), update React state directly from the data you just committed:

```jsx
// In AddMemberPage, AddTeamPage, EditMemberPage
const { teams, updateTeams, teamsPath } = useTeams();

const onSave = async () => {
  const updatedTeams = /* build new teams array locally */;

  await saveTextFile({
    repoPath: teamsPath,
    text: JSON.stringify({ teams: updatedTeams }, null, 2) + "\n",
    message: `chore: update member "${name}"`,
  });

  updateTeams(updatedTeams);  // ← instant UI update, no re-fetch
  navigate("/team-roster");
};
```

Result: the UI reflects changes the instant the GitHub commit succeeds. No logout/login required.

### 9D — cache: no-store on ALL GitHub API reads

**Critical:** add `cache: "no-store"` to every `fetch()` call against `api.github.com`.

Without it, the browser may serve a cached response for `getExistingFileSha()`. A stale SHA causes a `409 Conflict` on the next PUT — the most common confusing failure mode in this architecture.

```js
// In ghRequest() — covers all API reads
const response = await fetch(`https://api.github.com${path}`, {
  ...options,
  cache: "no-store",    // ← prevents stale SHA 409 errors
  headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", ...options.headers }
});

// In TeamsContext.load() — direct fetch also needs it
const res = await fetch(url, { headers, cache: "no-store" });
```

### 9E — React-controlled nav dropdown (SPA-safe)

Bootstrap's `data-bs-toggle="dropdown"` relies on DOM events. In a React SPA, clicking a `NavLink` triggers React Router's client-side navigation — no DOM reload — so Bootstrap never fires its close handler.

Fix: manage dropdown state entirely in React.

```jsx
const [dropdownOpen, setDropdownOpen] = useState(false);
const dropdownRef = useRef(null);

// Close on route change
useEffect(() => { setDropdownOpen(false); }, [location.pathname]);

// Close on outside click
useEffect(() => {
  if (!dropdownOpen) return;
  const handler = (e) => { if (!dropdownRef.current?.contains(e.target)) setDropdownOpen(false); };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [dropdownOpen]);

// In JSX: replace data-bs-toggle with onClick, replace Bootstrap show logic with class toggle
<button onClick={() => setDropdownOpen(o => !o)}>Coach ▾</button>
<ul className={`dropdown-menu${dropdownOpen ? " show" : ""}`}>
  {links.map(link => (
    <NavLink onClick={() => setDropdownOpen(false)} ...>{link.label}</NavLink>
  ))}
</ul>
```

Apply the same pattern to the mobile hamburger (`navOpen` state, toggled by the hamburger button, reset on route change).

### 9F — Member data model (extensible flat JSON)

Store member records as objects in a `members` array inside each team. Add optional fields freely — omit them rather than setting `null` so legacy records stay clean:

```json
{
  "name": "Jane Smith",
  "slug": "jane-smith",
  "position": "Sr. Software Engineer",
  "location": "Austin, TX",
  "workingHours": "9AM – 5PM CST",
  "inProgram": "Yes",
  "aiKnowledge": "Medium"
}
```

- `slug` is derived from `name` via `toSlug()` at creation time and **never changes** — it is the stable key used in file paths.
- Optional fields (`position`, `location`, `workingHours`, `inProgram`, `aiKnowledge`) are omitted when empty so old records display cleanly.
- An **Edit Member** page pre-populates all fields and saves back to `teams.json` via the same `saveTextFile` + `updateTeams` pattern.

### 9G — Notes path convention and tree search

Save coaching notes to:
```
coaches/<coach-username>/members/<member-slug>/notes/<YYYY-MM-DD>_<YYYYMMDDHHmmss>.txt
```

To list all notes across all coaches, search the git tree recursively:
```js
const tree = await ghRequest(`/repos/${TARGET_REPO}/git/trees/${TARGET_BRANCH}?recursive=1`);
return tree.tree.filter(node =>
  node.type === "blob" &&
  /^coaches\/[^/]+\/members\/[^/]+\/notes\/.*\.txt$/i.test(node.path)
);
```

Extract path segments by index (0-based split on `/`):
- Index `1` → coach username
- Index `3` → member slug
- `path.split("/").pop().slice(0, 10)` → meeting date

### 9H — Client-side CSV export (no server)

Generate CSV downloads entirely from React context data using the Blob + anchor pattern:

```js
function downloadCSV(filename, rows) {
  const escape = (val) => {
    const s = String(val ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(row => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

The `\uFEFF` UTF-8 BOM ensures Excel renders international characters (accented names, etc.) without an import wizard. No server, no library, no dependencies.

### 9I — Handling concurrent writes (the merge conflict problem)

When the app writes to a file via the GitHub Contents API and a separate commit has landed on the same file since the last read, the PUT returns `409 Conflict`. This happens in this architecture because:
- The app writes `teams.json` from the browser.
- Another session (or a direct git push) may have also modified the file.

Mitigation:
1. `cache: "no-store"` on `getExistingFileSha()` ensures the SHA is always fresh before a write.
2. For bulk operations (adding many records at once), edit the JSON locally and push via git — a single atomic commit — rather than making N sequential API calls through the browser UI.
3. When a conflict does occur in git, resolve by merging both sides of the JSON manually, then force-push or continue the rebase.


## Important gotchas — surface these proactively

- **Files >1 MB**: the Contents API caps at 1 MB per file. For larger files use the Git Data API: create blob → create tree → create commit → update ref. Mention this if the user's use case implies bigger files (images, video, datasets).
- **Base64 of binary**: the `btoa(String.fromCharCode(...))` trick fails for files large enough to blow the call-stack argument limit (~hundreds of KB on some browsers). For anything more than a few MB use a chunked encoder.
- **Token storage**: `sessionStorage` clears on tab close — right for OAuth. Don't use `localStorage` for tokens; XSS exposure is permanent.
- **CSRF / `state` parameter**: production code should generate a random `state`, stash it in `sessionStorage`, and verify it on return. The template omits this for brevity — flag it before the user ships to real users.
- **Scopes**: don't request `repo` when `public_repo` works. Users see scopes on the consent screen and will balk.
- **Rate limits**: authenticated GitHub API gets 5000 requests/hour per user. Fine for an uploader, flag it for bulk use cases.
- **Access control via GitHub collaborators**: the recommended pattern is to validate that the signed-in user is either the repo owner or a collaborator on the target repo. The repo owner always has access; other users must be added as collaborators in the target repo's **Settings → Collaborators**. The frontend can call `validateUserIsContributor()` to check this after sign-in. No hardcoding needed — changes to the collaborators list take effect immediately. For single-user tools, add only yourself; for team portals, add team members.

---

## Adapting to the user's actual ask

The template is the floor. Read what they want and adjust:

- **Drag-and-drop for images** → swap file input for a drop zone, default path to `images/${file.name}`, show a preview.
- **Form-submissions-as-markdown** → keep the OAuth and PUT bits, replace the upload UI with form fields, build content as markdown with frontmatter.
- **CMS-style editor** → add a list view that GETs `/repos/{owner}/{repo}/contents/{dir}`, a textarea for editing, reuse the same PUT for save.
- **Single-user-only** → add only the repo owner as the collaborator. For team portals, add each team member as a collaborator. Access validation happens automatically on sign-in via the `validateUserIsContributor()` check.

Get the OAuth + upload pipe working before adding features. Don't pad the deliverable.
