// Quiz authoring, assignment, and grading logic.
//
// IMPORTANT — what this is and is not:
// Quizzes are a self-assessment tool, not an exam system. Two consequences
// follow from storing everything in a public repo, and both are deliberate:
//
//   1. Answer keys are readable. A quiz JSON contains its correct answers and
//      lives in a public repo, so a member can read them before attempting.
//   2. One attempt per assignment is a product rule, not an enforced one.
//      Members write their own attempt files with their own token, so nothing
//      stops an overwrite via the API.
//
// Closing either hole means moving the key and the grading step server-side
// (the Val Town function already used for note encryption is the natural home).
// Until then, treat scores as self-reported.

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "multiple-choice",
  TEXT: "text",
};

export const GRADING_MODES = {
  AUTO: "auto",
  COACH: "coach",
};

export const ATTEMPT_STATUS = {
  SUBMITTED: "submitted",
  AWAITING_GRADING: "awaiting-grading",
  GRADED: "graded",
};

export const DEFAULT_PASSING_SCORE = 80;

// ── Paths ───────────────────────────────────────────────────────────────────

export function quizzesDir(coach) {
  return `coaches/${coach}/quizzes`;
}

export function quizPath(coach, quizSlug) {
  return `${quizzesDir(coach)}/${quizSlug}.json`;
}

export function assignmentsPath(coach) {
  return `${quizzesDir(coach)}/assignments.json`;
}

export function attemptsDir(coach, memberSlug) {
  return `coaches/${coach}/members/${memberSlug}/quiz-attempts`;
}

export function attemptPath(coach, memberSlug, assignmentId) {
  return `${attemptsDir(coach, memberSlug)}/${assignmentId}.json`;
}

// ── Slugs and ids ───────────────────────────────────────────────────────────

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Assignment ids must be unique per coach and safe as a filename, since the
// attempt file is named after the id.
export function makeAssignmentId(quizSlug, memberSlug, when = new Date()) {
  const stamp = when.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${quizSlug}__${memberSlug}__${stamp}`;
}

export function makeQuestionId(index) {
  return `q${index + 1}`;
}

// ── Construction ────────────────────────────────────────────────────────────

export function emptyQuestion(type = QUESTION_TYPES.MULTIPLE_CHOICE, index = 0) {
  const base = { id: makeQuestionId(index), type, prompt: "", points: 1 };
  if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    return {
      ...base,
      options: [
        { id: "a", text: "" },
        { id: "b", text: "" },
      ],
      correctOptionId: "a",
    };
  }
  return { ...base, correctAnswer: "", autoGradeText: false };
}

export function emptyQuiz() {
  return {
    slug: "",
    title: "",
    description: "",
    gradingMode: GRADING_MODES.AUTO,
    passingScore: DEFAULT_PASSING_SCORE,
    questions: [emptyQuestion(QUESTION_TYPES.MULTIPLE_CHOICE, 0)],
  };
}

export const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];

export function nextOptionId(options) {
  const used = new Set((options || []).map((o) => o.id));
  return OPTION_IDS.find((id) => !used.has(id)) || `o${(options || []).length + 1}`;
}

// ── Grading mode ────────────────────────────────────────────────────────────

// A text question can only be auto-graded when the coach opts in per question.
// Free text is compared by exact (normalized) match, which is brittle, so the
// default is coach grading.
export function hasManualQuestions(quiz) {
  return (quiz?.questions || []).some(
    (q) => q.type === QUESTION_TYPES.TEXT && !q.autoGradeText
  );
}

// The mode a quiz will actually run in. A quiz asking for coach grading always
// gets it; a quiz asking for auto grading still needs a coach pass when any
// question cannot be auto-graded.
export function effectiveGradingMode(quiz) {
  if (quiz?.gradingMode === GRADING_MODES.COACH) return GRADING_MODES.COACH;
  return hasManualQuestions(quiz) ? GRADING_MODES.COACH : GRADING_MODES.AUTO;
}

export function totalPoints(quiz) {
  return (quiz?.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
}

// ── Validation ──────────────────────────────────────────────────────────────

// Returns an array of human-readable problems; empty means valid. Kept pure so
// the authoring page can show issues live without saving.
export function validateQuiz(quiz) {
  const errors = [];
  if (!quiz) return ["Quiz is empty."];
  if (!String(quiz.title || "").trim()) errors.push("Title is required.");
  if (!String(quiz.slug || "").trim()) errors.push("Slug is required.");

  const pass = Number(quiz.passingScore);
  if (!Number.isFinite(pass) || pass < 0 || pass > 100) {
    errors.push("Passing score must be between 0 and 100.");
  }

  const questions = quiz.questions || [];
  if (questions.length === 0) errors.push("Add at least one question.");

  const seenIds = new Set();
  questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (seenIds.has(q.id)) errors.push(`${label}: duplicate question id "${q.id}".`);
    seenIds.add(q.id);

    if (!String(q.prompt || "").trim()) errors.push(`${label}: prompt is required.`);
    if (!Number.isFinite(Number(q.points)) || Number(q.points) <= 0) {
      errors.push(`${label}: points must be greater than zero.`);
    }

    if (q.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
      const options = q.options || [];
      if (options.length < 2) errors.push(`${label}: needs at least two options.`);
      if (options.some((o) => !String(o.text || "").trim())) {
        errors.push(`${label}: every option needs text.`);
      }
      if (!options.some((o) => o.id === q.correctOptionId)) {
        errors.push(`${label}: mark which option is correct.`);
      }
    } else if (q.type === QUESTION_TYPES.TEXT) {
      if (q.autoGradeText && !String(q.correctAnswer || "").trim()) {
        errors.push(`${label}: auto-graded text needs an expected answer.`);
      }
    } else {
      errors.push(`${label}: unknown question type "${q.type}".`);
    }
  });

  return errors;
}

// ── Grading ─────────────────────────────────────────────────────────────────

// Normalizes free text before comparison: case, surrounding space, and inner
// runs of whitespace. Deliberately does NOT strip punctuation — that would let
// meaningfully different answers collide.
function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Grades one question, or returns null when it needs a human.
export function gradeQuestion(question, answer) {
  if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    return answer === question.correctOptionId;
  }
  if (question.type === QUESTION_TYPES.TEXT && question.autoGradeText) {
    return normalizeText(answer) === normalizeText(question.correctAnswer);
  }
  return null;
}

export function percentOf(earned, possible) {
  if (!possible) return 0;
  return Math.round((earned / possible) * 1000) / 10;
}

export function isPassing(percent, passingScore = DEFAULT_PASSING_SCORE) {
  return Number(percent) >= Number(passingScore);
}

// Auto-grades every question that can be graded without a coach. `pending`
// lists the question ids still needing a human, so the caller can decide
// between GRADED and AWAITING_GRADING without re-deriving it.
export function autoGrade(quiz, answers) {
  const perQuestion = {};
  const pending = [];
  let earned = 0;
  let possible = 0;

  (quiz?.questions || []).forEach((q) => {
    const points = Number(q.points) || 0;
    possible += points;
    const correct = gradeQuestion(q, answers?.[q.id]);
    if (correct === null) {
      pending.push(q.id);
      perQuestion[q.id] = { correct: null, points, earned: 0 };
      return;
    }
    const gained = correct ? points : 0;
    earned += gained;
    perQuestion[q.id] = { correct, points, earned: gained };
  });

  return { perQuestion, pending, earned, possible, percent: percentOf(earned, possible) };
}

// ── Due dates ───────────────────────────────────────────────────────────────

// A due date is a calendar day; the assignment is late once that day has fully
// passed. Submission is never blocked — lateness is recorded, not enforced.
export function isLate(dueDate, when = new Date()) {
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return false;
  return when.getTime() > due.getTime();
}

export function daysUntilDue(dueDate, when = new Date()) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - when.getTime()) / 86400000);
}

// ── Attempts ────────────────────────────────────────────────────────────────

// Builds the attempt record written at submit time. `isLate` is computed once
// and stored, so later edits to the assignment's due date cannot retroactively
// change whether a past submission was late.
export function buildAttempt({ assignment, quiz, answers, submittedAt = new Date() }) {
  const mode = effectiveGradingMode(quiz);
  const auto = autoGrade(quiz, answers);
  const late = isLate(assignment.dueDate, submittedAt);
  const passingScore = Number(quiz.passingScore) || DEFAULT_PASSING_SCORE;

  const attempt = {
    assignmentId: assignment.assignmentId,
    quizSlug: assignment.quizSlug,
    memberSlug: assignment.memberSlug,
    submittedAt: submittedAt.toISOString(),
    dueDate: assignment.dueDate || null,
    isLate: late,
    answers: answers || {},
    passingScore,
    autoScore: {
      earned: auto.earned,
      possible: auto.possible,
      percent: auto.percent,
      perQuestion: auto.perQuestion,
    },
    coachGrade: null,
    coachComment: "",
  };

  if (mode === GRADING_MODES.AUTO && auto.pending.length === 0) {
    attempt.status = ATTEMPT_STATUS.GRADED;
    attempt.finalPercent = auto.percent;
    attempt.passed = isPassing(auto.percent, passingScore);
  } else {
    attempt.status = ATTEMPT_STATUS.AWAITING_GRADING;
    attempt.finalPercent = null;
    attempt.passed = null;
  }

  return attempt;
}

// Applies a coach's grade. Coach marks override the auto result for the
// questions they touch, so a coach can correct a wrong auto-grade.
export function applyCoachGrade({ attempt, quiz, perQuestion, comment, gradedBy, gradedAt = new Date() }) {
  let earned = 0;
  let possible = 0;

  (quiz?.questions || []).forEach((q) => {
    const points = Number(q.points) || 0;
    possible += points;
    const override = perQuestion?.[q.id];
    if (override && typeof override.correct === "boolean") {
      earned += override.correct ? points : 0;
      return;
    }
    const auto = attempt?.autoScore?.perQuestion?.[q.id];
    if (auto && auto.correct === true) earned += points;
  });

  const percent = percentOf(earned, possible);
  const passingScore = Number(attempt?.passingScore) || DEFAULT_PASSING_SCORE;

  return {
    ...attempt,
    status: ATTEMPT_STATUS.GRADED,
    coachGrade: {
      perQuestion: perQuestion || {},
      earned,
      possible,
      percent,
      gradedBy: gradedBy || null,
      gradedAt: gradedAt.toISOString(),
    },
    coachComment: comment ?? attempt?.coachComment ?? "",
    finalPercent: percent,
    passed: isPassing(percent, passingScore),
  };
}

// ── Assignments ─────────────────────────────────────────────────────────────

export function buildAssignment({
  quizSlug,
  memberSlug,
  teamSlug = null,
  dueDate = null,
  assignedBy,
  reassignedFrom = null,
  assignedAt = new Date(),
}) {
  return {
    assignmentId: makeAssignmentId(quizSlug, memberSlug, assignedAt),
    quizSlug,
    memberSlug,
    teamSlug,
    dueDate: dueDate || null,
    assignedAt: assignedAt.toISOString(),
    assignedBy: assignedBy || null,
    // Set when a coach reassigns after a failed attempt, so the history can
    // show the chain rather than a set of unrelated assignments.
    reassignedFrom,
  };
}

export function assignmentsForMember(assignments, memberSlug) {
  return (assignments || []).filter((a) => a.memberSlug === memberSlug);
}

export function assignmentsForQuiz(assignments, quizSlug) {
  return (assignments || []).filter((a) => a.quizSlug === quizSlug);
}

// An assignment is open until its attempt exists. Attempts are keyed by
// assignment id, so a reassignment always reopens the quiz.
export function isAssignmentOpen(assignment, attemptsById) {
  return !attemptsById?.[assignment.assignmentId];
}
