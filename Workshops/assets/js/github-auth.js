const TOKEN_KEY = "nrg_gh_token";
const POST_LOGIN_KEY = "nrg_post_login_path";
const OAUTH_STATE_KEY = "nrg_oauth_state";

export function getConfig() {
  const cfg = window.APP_CONFIG || {};
  const required = ["CLIENT_ID", "TOKEN_EXCHANGE_URL", "TARGET_REPO"];
  const missing = required.filter((key) => !cfg[key] || cfg[key].startsWith("REPLACE_"));

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

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function buildRedirectUri() {
  const cfg = getConfig();
  return `${location.origin}${cfg.OAUTH_CALLBACK_PATH}`;
}

function createState() {
  const raw = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem(OAUTH_STATE_KEY, raw);
  return raw;
}

export function startSignIn(returnToPath) {
  const cfg = getConfig();
  if (cfg.missing.length) {
    throw new Error(`Missing config values: ${cfg.missing.join(", ")}`);
  }

  const state = createState();
  sessionStorage.setItem(POST_LOGIN_KEY, returnToPath || "/");

  const params = new URLSearchParams({
    client_id: cfg.CLIENT_ID,
    redirect_uri: buildRedirectUri(),
    scope: cfg.OAUTH_SCOPE,
    state
  });

  location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function validateUserIsContributor() {
  const cfg = getConfig();
  const user = await fetchCurrentUser();
  const token = getToken();
  const [repoOwner] = cfg.TARGET_REPO.split("/");
  
  // Owner of repo always has access
  if (user.login === repoOwner) {
    return user;
  }
  
  try {
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
      return user; // User is a collaborator, access granted
    } else if (response.status === 404) {
      throw new Error(`User @${user.login} is not a collaborator on ${cfg.TARGET_REPO}. Please contact the repo owner for access.`);
    } else {
      throw new Error("Failed to validate access. Please try again.");
    }
  } catch (error) {
    throw new Error(`Access validation failed: ${error.message}`);
  }
}

export async function completeOAuthIfNeeded() {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  if (!code) {
    return { changed: false };
  }

  const state = url.searchParams.get("state");
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
  
  // Validate that the user is a contributor/collaborator on the target repo
  try {
    await validateUserIsContributor();
  } catch (error) {
    // Clear the token if validation fails
    sessionStorage.removeItem(TOKEN_KEY);
    throw error;
  }

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history.replaceState({}, "", `${url.pathname}${url.search}`);

  const target = sessionStorage.getItem(POST_LOGIN_KEY) || "/";
  sessionStorage.removeItem(POST_LOGIN_KEY);
  return { changed: true, target };
}

export function requireAuth() {
  if (getToken()) {
    return;
  }

  const returnTo = `${location.pathname}${location.search}`;
  sessionStorage.setItem(POST_LOGIN_KEY, returnTo);
  location.href = "login.html";
}

function encodePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function ghRequest(path, options = {}) {
  const cfg = getConfig();
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
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

export async function listMemberNoteFiles() {
  const cfg = getConfig();
  const tree = await ghRequest(
    `/repos/${cfg.TARGET_REPO}/git/trees/${encodeURIComponent(cfg.TARGET_BRANCH)}?recursive=1`
  );

  return (tree.tree || []).filter(
    (node) =>
      node.type === "blob" &&
      /^members\/[^/]+\/notes\/.*\.txt$/i.test(node.path)
  );
}

export async function readTextFile(repoPath) {
  const cfg = getConfig();
  const encodedPath = encodePath(repoPath);
  const file = await ghRequest(
    `/repos/${cfg.TARGET_REPO}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.TARGET_BRANCH)}`
  );

  const base64 = (file.content || "").replace(/\n/g, "");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
