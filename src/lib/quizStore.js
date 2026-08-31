// Data access for quizzes, assignments, and attempts.
//
// Every read goes through readTextFile and every write through saveTextFile, so
// the path boundaries in githubAuth.js apply unchanged: coaches stay inside
// their own folder, admins may read across coaches, and members may write only
// their own quiz-attempts.

import {
  readTextFile,
  saveTextFile,
  listRepoTree,
} from "./githubAuth";
import {
  assignmentsPath,
  attemptPath,
  quizPath,
  quizzesDir,
} from "./quizzes";

// A missing file is a normal state (no quizzes authored yet), not an error.
// Anything else — a permission failure, malformed JSON — must surface.
function isNotFound(error) {
  if (error?.status === 404) return true;
  // ghRequest attaches .status, but readTextFile may surface a plain Error
  // whose message is GitHub's human text ("Not Found").
  return /^not found$/i.test(String(error?.message || "").trim());
}

async function readJson(repoPath, fallback) {
  try {
    const text = await readTextFile(repoPath);
    return JSON.parse(text);
  } catch (error) {
    if (isNotFound(error)) return fallback;
    if (error instanceof SyntaxError) {
      throw new Error(`${repoPath} is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

async function writeJson(repoPath, value, message) {
  return saveTextFile({
    repoPath,
    text: `${JSON.stringify(value, null, 2)}\n`,
    message,
  });
}

// ── Quizzes ─────────────────────────────────────────────────────────────────

export async function listQuizSlugs(coach) {
  if (!/^[A-Za-z0-9-]+$/.test(String(coach || ""))) {
    throw new Error(`Invalid coach username: ${coach}`);
  }
  const tree = await listRepoTree();
  const dir = quizzesDir(coach);
  const pattern = new RegExp(`^${dir}/([^/]+)\\.json$`, "i");
  return (tree || [])
    .filter((node) => node.type === "blob")
    .map((node) => pattern.exec(node.path || ""))
    .filter(Boolean)
    // assignments.json lives in the same folder but is not a quiz
    .map((m) => m[1])
    .filter((slug) => slug !== "assignments")
    .sort();
}

export async function loadQuiz(coach, slug) {
  return readJson(quizPath(coach, slug), null);
}

export async function loadQuizzes(coach) {
  const slugs = await listQuizSlugs(coach);
  const quizzes = await Promise.all(slugs.map((slug) => loadQuiz(coach, slug)));
  return quizzes.filter(Boolean);
}

export async function saveQuiz(coach, quiz, message) {
  return writeJson(
    quizPath(coach, quiz.slug),
    quiz,
    message || `Save quiz "${quiz.title}"`
  );
}

// ── Assignments ─────────────────────────────────────────────────────────────

export async function loadAssignments(coach) {
  const data = await readJson(assignmentsPath(coach), { assignments: [] });
  return Array.isArray(data?.assignments) ? data.assignments : [];
}

export async function saveAssignments(coach, assignments, message) {
  return writeJson(
    assignmentsPath(coach),
    { assignments },
    message || "Update quiz assignments"
  );
}

// Appends assignments and writes once. Re-reads immediately before writing so a
// concurrent assignment from another tab is merged rather than overwritten —
// a single shared file per coach makes last-write-wins the default otherwise.
export async function appendAssignments(coach, newAssignments, message) {
  const existing = await loadAssignments(coach);
  const known = new Set(existing.map((a) => a.assignmentId));
  const merged = existing.concat(newAssignments.filter((a) => !known.has(a.assignmentId)));
  await saveAssignments(coach, merged, message);
  return merged;
}

// ── Attempts ────────────────────────────────────────────────────────────────

export async function loadAttempt(coach, memberSlug, assignmentId) {
  return readJson(attemptPath(coach, memberSlug, assignmentId), null);
}

// The Contents API is eventually consistent: a file read immediately after
// writing it can still 404 for a moment. Reading straight after a submit —
// the result page right after the redirect — hits that window and would
// otherwise report the quiz as never submitted. Retries briefly before
// accepting absence as real.
export async function loadAttemptWithRetry(
  coach,
  memberSlug,
  assignmentId,
  { attempts = 4, delayMs = 700 } = {}
) {
  for (let i = 0; i < attempts; i += 1) {
    const found = await loadAttempt(coach, memberSlug, assignmentId);
    if (found) return found;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export async function saveAttempt(coach, memberSlug, attempt, message) {
  return writeJson(
    attemptPath(coach, memberSlug, attempt.assignmentId),
    attempt,
    message || `Quiz attempt: ${attempt.quizSlug} — ${memberSlug}`
  );
}

// Lists every attempt file for one coach, optionally narrowed to one member.
// Returns {memberSlug, assignmentId, path} without reading contents, so a
// history view can page through without fetching everything at once.
export async function listAttemptFiles(coach, memberSlug = null) {
  if (!/^[A-Za-z0-9-]+$/.test(String(coach || ""))) {
    throw new Error(`Invalid coach username: ${coach}`);
  }
  if (memberSlug && !/^[A-Za-z0-9._-]+$/.test(String(memberSlug))) {
    throw new Error(`Invalid member slug: ${memberSlug}`);
  }
  const tree = await listRepoTree();
  const memberPart = memberSlug || "[^/]+";
  const pattern = new RegExp(
    `^coaches/${coach}/members/(${memberPart})/quiz-attempts/([^/]+)\\.json$`,
    "i"
  );
  return (tree || [])
    .filter((node) => node.type === "blob")
    .map((node) => {
      const m = pattern.exec(node.path || "");
      return m ? { memberSlug: m[1], assignmentId: m[2], path: node.path } : null;
    })
    .filter(Boolean);
}

export async function loadAttempts(coach, memberSlug = null) {
  const files = await listAttemptFiles(coach, memberSlug);
  const attempts = await Promise.all(
    files.map(async (file) => {
      const data = await readJson(file.path, null);
      return data ? { ...data, memberSlug: data.memberSlug || file.memberSlug } : null;
    })
  );
  return attempts.filter(Boolean);
}

// Keyed by assignmentId — the shape the dashboard needs to tell an open
// assignment from a completed one.
export function indexAttemptsByAssignment(attempts) {
  const byId = {};
  (attempts || []).forEach((a) => {
    if (a?.assignmentId) byId[a.assignmentId] = a;
  });
  return byId;
}
