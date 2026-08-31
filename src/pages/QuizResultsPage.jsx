import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import {
  appendAssignments,
  indexAttemptsByAssignment,
  loadAssignments,
  loadAttempts,
  loadQuizzes,
} from "../lib/quizStore";
import { ATTEMPT_STATUS, buildAssignment, isAssignmentOpen } from "../lib/quizzes";

function pill(color) {
  return {
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.15rem 0.45rem",
    borderRadius: "999px",
    background: `${color}18`,
    color,
    whiteSpace: "nowrap",
  };
}

function StatusCell({ attempt }) {
  if (!attempt) return <span style={pill("#6b7280")}>Not started</span>;
  if (attempt.status === ATTEMPT_STATUS.AWAITING_GRADING) {
    return <span style={pill("#b45309")}>Awaiting grading</span>;
  }
  const color = attempt.passed ? "#16a34a" : "#b91c1c";
  return (
    <span style={pill(color)}>
      {attempt.finalPercent}% · {attempt.passed ? "Passed" : "Failed"}
    </span>
  );
}

export default function QuizResultsPage() {
  const { coachUsername } = useAuth();
  const { dataOwner, isReadOnly, allMembers, teams } = useTeams();

  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [filterQuiz, setFilterQuiz] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  const load = useCallback(async () => {
    if (!dataOwner) return;
    setLoading(true);
    setError("");
    try {
      const [quizList, asgs, atts] = await Promise.all([
        loadQuizzes(dataOwner),
        loadAssignments(dataOwner),
        loadAttempts(dataOwner),
      ]);
      setQuizzes(quizList);
      setAssignments(asgs);
      setAttempts(atts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataOwner]);

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
  const memberName = useCallback(
    (slug) => (allMembers || []).find((m) => m.slug === slug)?.name || slug,
    [allMembers]
  );

  const rows = useMemo(
    () =>
      assignments
        .filter((a) => !filterQuiz || a.quizSlug === filterQuiz)
        .filter((a) => !filterTeam || a.teamSlug === filterTeam)
        .slice()
        .sort((a, b) => String(b.assignedAt).localeCompare(String(a.assignedAt)))
        .map((assignment) => ({
          assignment,
          quiz: quizBySlug[assignment.quizSlug],
          attempt: attemptsById[assignment.assignmentId] || null,
        })),
    [assignments, filterQuiz, filterTeam, quizBySlug, attemptsById]
  );

  const stats = useMemo(() => {
    const submitted = rows.filter((r) => r.attempt);
    const graded = submitted.filter((r) => r.attempt.status === ATTEMPT_STATUS.GRADED);
    const passed = graded.filter((r) => r.attempt.passed);
    return {
      assigned: rows.length,
      submitted: submitted.length,
      awaiting: submitted.length - graded.length,
      passed: passed.length,
      failed: graded.length - passed.length,
    };
  }, [rows]);

  // Reassigning creates a NEW assignment rather than clearing the old attempt,
  // so the history keeps every try. reassignedFrom links the chain.
  const reassign = async (row) => {
    if (isReadOnly || !coachUsername) return;
    setBusy(row.assignment.assignmentId);
    setError("");
    try {
      const next = buildAssignment({
        quizSlug: row.assignment.quizSlug,
        memberSlug: row.assignment.memberSlug,
        teamSlug: row.assignment.teamSlug,
        dueDate: row.assignment.dueDate,
        assignedBy: coachUsername,
        reassignedFrom: row.assignment.assignmentId,
      });
      const merged = await appendAssignments(
        coachUsername,
        [next],
        `Reassign quiz "${row.quiz?.title || row.assignment.quizSlug}" to ${row.assignment.memberSlug}`
      );
      setAssignments(merged);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  // A member should not hold two open copies of the same quiz at once.
  const hasOpenAssignment = useCallback(
    (row) =>
      assignments.some(
        (a) =>
          a.quizSlug === row.assignment.quizSlug &&
          a.memberSlug === row.assignment.memberSlug &&
          isAssignmentOpen(a, attemptsById)
      ),
    [assignments, attemptsById]
  );

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quizzes</div>
        <h1>Results & History</h1>
        <p className="text-secondary mb-0">
          Every attempt across your teams, including reassignments.
        </p>
      </div>

      <div className="stat-strip mb-4 animate-in animate-in-2">
        <div className="stat-pill">
          <span className="stat-pill-value">{stats.assigned}</span>
          <span className="stat-pill-label">Assigned</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{stats.submitted}</span>
          <span className="stat-pill-label">Submitted</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{stats.awaiting}</span>
          <span className="stat-pill-label">To Grade</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{stats.passed}</span>
          <span className="stat-pill-label">Passed</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-value">{stats.failed}</span>
          <span className="stat-pill-label">Failed</span>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-sm-6">
          <label className="form-label">Quiz</label>
          <select
            className="form-select"
            value={filterQuiz}
            onChange={(e) => setFilterQuiz(e.target.value)}
          >
            <option value="">All quizzes</option>
            {quizzes.map((q) => (
              <option key={q.slug} value={q.slug}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-6">
          <label className="form-label">Team</label>
          <select
            className="form-select"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
          >
            <option value="">All teams</option>
            {(teams || []).map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-secondary">Loading results…</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!loading && rows.length === 0 && (
        <div className="section-card p-4 text-center">
          <p className="text-secondary mb-0">Nothing assigned yet.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="section-card p-0" style={{ overflowX: "auto" }}>
          <table className="table mb-0" style={{ minWidth: "46rem" }}>
            <thead>
              <tr>
                <th style={th}>Member</th>
                <th style={th}>Quiz</th>
                <th style={th}>Assigned</th>
                <th style={th}>Due</th>
                <th style={th}>Status</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ assignment, quiz, attempt }) => {
                const row = { assignment, quiz, attempt };
                const needsGrading = attempt?.status === ATTEMPT_STATUS.AWAITING_GRADING;
                const failed = attempt?.status === ATTEMPT_STATUS.GRADED && !attempt.passed;
                const blocked = hasOpenAssignment(row);
                return (
                  <tr key={assignment.assignmentId}>
                    <td style={td}>
                      <strong>{memberName(assignment.memberSlug)}</strong>
                      {assignment.reassignedFrom && (
                        <div style={{ fontSize: "0.7rem", color: "#b45309" }}>reassigned</div>
                      )}
                    </td>
                    <td style={td}>{quiz?.title || assignment.quizSlug}</td>
                    <td style={td}>{String(assignment.assignedAt).slice(0, 10)}</td>
                    <td style={td}>
                      {assignment.dueDate || "—"}
                      {attempt?.isLate && (
                        <div style={{ fontSize: "0.7rem", color: "#b91c1c" }}>submitted late</div>
                      )}
                    </td>
                    <td style={td}>
                      <StatusCell attempt={attempt} />
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {attempt && (
                        <Link to={`/quizzes/result/${assignment.assignmentId}`} className="me-3">
                          View
                        </Link>
                      )}
                      {!isReadOnly && needsGrading && (
                        <Link to={`/quizzes/grade/${assignment.assignmentId}`} className="me-3">
                          Grade
                        </Link>
                      )}
                      {!isReadOnly && failed && !blocked && (
                        <button
                          className="btn btn-sm btn-outline-dark"
                          onClick={() => reassign(row)}
                          disabled={busy === assignment.assignmentId}
                        >
                          {busy === assignment.assignmentId ? "…" : "Reassign"}
                        </button>
                      )}
                      {!isReadOnly && failed && blocked && (
                        <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                          reassigned — open
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const th = {
  textAlign: "left",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ink-500)",
  fontWeight: 700,
};

const td = { fontSize: "0.875rem", verticalAlign: "top" };
