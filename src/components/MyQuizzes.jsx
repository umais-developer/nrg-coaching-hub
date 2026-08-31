import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  indexAttemptsByAssignment,
  loadAssignments,
  loadAttempts,
  loadQuizzes,
} from "../lib/quizStore";
import {
  ATTEMPT_STATUS,
  assignmentsForMember,
  daysUntilDue,
  isAssignmentOpen,
  isLate,
} from "../lib/quizzes";

function DuePill({ dueDate }) {
  if (!dueDate) return null;
  const days = daysUntilDue(dueDate);
  const overdue = isLate(dueDate);
  const color = overdue ? "#b91c1c" : days <= 2 ? "#b45309" : "#0f766e";
  const label = overdue
    ? "Overdue"
    : days === 0
      ? "Due today"
      : days === 1
        ? "Due tomorrow"
        : `Due in ${days} days`;
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
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ResultPill({ attempt }) {
  if (attempt.status === ATTEMPT_STATUS.AWAITING_GRADING) {
    return (
      <span style={pill("#b45309")}>Submitted — awaiting grading</span>
    );
  }
  const color = attempt.passed ? "#16a34a" : "#b91c1c";
  return (
    <span style={pill(color)}>
      {attempt.finalPercent}% · {attempt.passed ? "Passed" : "Not passed"}
    </span>
  );
}

function pill(color) {
  return {
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.15rem 0.45rem",
    borderRadius: "999px",
    background: `${color}18`,
    color,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  };
}

export default function MyQuizzes() {
  const { memberIdentity } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!memberIdentity) return;
    const { coach, memberSlug } = memberIdentity;
    setLoading(true);
    setError("");
    try {
      const [quizList, asgs, atts] = await Promise.all([
        loadQuizzes(coach),
        loadAssignments(coach),
        loadAttempts(coach, memberSlug),
      ]);
      setQuizzes(quizList);
      setAssignments(assignmentsForMember(asgs, memberSlug));
      setAttempts(atts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [memberIdentity]);

  useEffect(() => {
    load();
  }, [load]);

  const attemptsById = useMemo(() => indexAttemptsByAssignment(attempts), [attempts]);
  const quizBySlug = useMemo(() => {
    const map = {};
    quizzes.forEach((q) => {
      map[q.slug] = q;
    });
    return map;
  }, [quizzes]);

  // Newest first, so a reassignment sits above the attempt it replaced.
  const rows = useMemo(
    () =>
      assignments
        .slice()
        .sort((a, b) => String(b.assignedAt).localeCompare(String(a.assignedAt)))
        .map((assignment) => ({
          assignment,
          quiz: quizBySlug[assignment.quizSlug],
          attempt: attemptsById[assignment.assignmentId] || null,
        }))
        // An assignment whose quiz was deleted has nothing to render
        .filter((row) => row.quiz),
    [assignments, quizBySlug, attemptsById]
  );

  // A member whose GitHub login is not yet linked to a member record has no
  // identity to look quizzes up by. Say so rather than rendering nothing —
  // silence here reads as a broken page.
  if (!memberIdentity) {
    return (
      <div className="section-card p-4 mb-4 animate-in animate-in-2">
        <h2 className="h6 mb-2" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
          📝 My Quizzes
        </h2>
        <p className="text-secondary mb-0" style={{ fontSize: "0.85rem" }}>
          Your account is not linked to a team member record yet, so quizzes cannot be
          shown. Ask your coach to link it from the Admin page.
        </p>
      </div>
    );
  }

  const open = rows.filter((r) => isAssignmentOpen(r.assignment, attemptsById));
  const done = rows.filter((r) => !isAssignmentOpen(r.assignment, attemptsById));

  return (
    <div className="section-card p-4 mb-4 animate-in animate-in-2">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
          📝 My Quizzes
        </h2>
        {open.length > 0 && (
          <span style={pill("#0f766e")}>
            {open.length} to do
          </span>
        )}
      </div>

      {loading && <p className="text-secondary mb-0">Loading quizzes…</p>}
      {error && <p style={{ color: "#b91c1c" }} className="mb-0">Could not load quizzes: {error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-secondary mb-0">
          No quizzes assigned yet. Your coach will assign them here.
        </p>
      )}

      {open.map(({ assignment, quiz }) => (
        <div
          key={assignment.assignmentId}
          className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-3"
          style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}
        >
          <div>
            <strong style={{ fontSize: "0.9rem" }}>{quiz.title}</strong>
            <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
              {(quiz.questions || []).length} questions · {quiz.passingScore}% to pass
              {assignment.reassignedFrom && " · reassigned"}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <DuePill dueDate={assignment.dueDate} />
            <Link
              className="btn btn-sm btn-primary-brand"
              to={`/quizzes/take/${assignment.assignmentId}`}
            >
              Start
            </Link>
          </div>
        </div>
      ))}

      {done.map(({ assignment, quiz, attempt }) => (
        <div
          key={assignment.assignmentId}
          className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-3"
          style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}
        >
          <div>
            <strong style={{ fontSize: "0.9rem" }}>{quiz.title}</strong>
            <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
              Submitted {new Date(attempt.submittedAt).toLocaleDateString()}
              {attempt.isLate && " · late"}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <ResultPill attempt={attempt} />
            <Link
              className="btn btn-sm btn-outline-dark"
              to={`/quizzes/result/${assignment.assignmentId}`}
            >
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
