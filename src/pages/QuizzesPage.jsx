import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { useAuth } from "../contexts/AuthContext";
import { loadAllQuizzes, loadAssignments } from "../lib/quizStore";
import {
  GRADING_MODES,
  effectiveGradingMode,
  totalPoints,
  assignmentsForQuiz,
} from "../lib/quizzes";

const MODE_COLORS = {
  [GRADING_MODES.AUTO]: "#16a34a",
  [GRADING_MODES.COACH]: "#b45309",
};

function ModePill({ quiz }) {
  const mode = effectiveGradingMode(quiz);
  const color = MODE_COLORS[mode];
  // A quiz can ask for auto grading but still need a coach pass, so show the
  // mode it will actually run in rather than what was requested.
  const overridden = quiz.gradingMode === GRADING_MODES.AUTO && mode === GRADING_MODES.COACH;
  return (
    <span
      title={overridden ? "Contains a text question that needs manual grading" : undefined}
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
      {mode === GRADING_MODES.AUTO ? "Auto-graded" : "Coach-graded"}
    </span>
  );
}

export default function QuizzesPage() {
  // Read from whoever's workspace is on screen — an admin may be viewing
  // another coach — but authoring stays gated on the signed-in user, matching
  // how TeamsContext separates dataOwner from writes.
  const { dataOwner, isReadOnly } = useTeams();
  const { coachUsername } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!dataOwner) return;
    setLoading(true);
    setError("");
    try {
      const [list, asgs] = await Promise.all([
        loadAllQuizzes(),
        loadAssignments(dataOwner),
      ]);
      setQuizzes(list);
      setAssignments(asgs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      quizzes.map((quiz) => ({
        quiz,
        assignedCount: assignmentsForQuiz(assignments, quiz.slug).length,
      })),
    [quizzes, assignments]
  );

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quizzes</div>
        <h1>Quizzes</h1>
        <p className="text-secondary mb-0">
          Create quizzes, assign them to your team members, and review results.
        </p>
      </div>

      {isReadOnly ? (
        <p className="text-secondary mb-4" style={{ fontSize: "0.82rem" }}>
          Viewing {dataOwner}'s quizzes — read-only.
        </p>
      ) : (
        <div className="d-flex gap-2 mb-4 animate-in animate-in-2">
          <Link className="btn btn-primary-brand" to="/quizzes/new">
            + New Quiz
          </Link>
          <Link className="btn btn-outline-dark" to="/quizzes/assign">
            Assign a Quiz
          </Link>
        </div>
      )}

      {loading && <p className="text-secondary">Loading quizzes…</p>}
      {error && <p style={{ color: "#b91c1c" }}>Could not load quizzes: {error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="section-card p-4 text-center animate-in animate-in-3">
          <p className="text-secondary mb-0">
            No quizzes yet. Create one to get started.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="section-card p-0 animate-in animate-in-3" style={{ overflowX: "auto" }}>
          <table className="table mb-0" style={{ minWidth: "44rem" }}>
            <thead>
              <tr>
                <th style={th}>Quiz</th>
                <th style={th}>Author</th>
                <th style={th}>Questions</th>
                <th style={th}>Points</th>
                <th style={th}>Pass</th>
                <th style={th}>Grading</th>
                <th style={th}>Assigned</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ quiz, assignedCount }) => (
                <tr key={quiz.slug}>
                  <td style={td}>
                    <strong>{quiz.title}</strong>
                    {quiz.description && (
                      <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
                        {quiz.description}
                      </div>
                    )}
                    <div className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-500)" }}>
                      {quiz.slug}
                    </div>
                  </td>
                  <td style={td}>
                    {quiz.owner === coachUsername ? (
                      <span style={{ fontWeight: 600 }}>You</span>
                    ) : (
                      <span className="text-secondary">{quiz.owner}</span>
                    )}
                  </td>
                  <td style={td}>{(quiz.questions || []).length}</td>
                  <td style={td}>{totalPoints(quiz)}</td>
                  <td style={td}>{quiz.passingScore}%</td>
                  <td style={td}>
                    <ModePill quiz={quiz} />
                  </td>
                  <td style={td}>{assignedCount || "—"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {!isReadOnly && (
                      <>
                        {quiz.owner === coachUsername && (
                          <Link to={`/quizzes/edit/${quiz.slug}`} className="me-3">
                            Edit
                          </Link>
                        )}
                        <Link
                          to={`/quizzes/assign?quiz=${encodeURIComponent(quiz.slug)}&owner=${encodeURIComponent(quiz.owner)}`}
                        >
                          Assign
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-secondary mt-4" style={{ fontSize: "0.78rem" }}>
        Every coach's quizzes are listed here and any of them can be assigned to your
        own members, so the same quiz need only be written once. Only its author can
        edit a quiz. Quizzes are stored in this repository, which is public — correct
        answers are readable outside the app, so treat them as self-assessment rather
        than secure testing.
      </p>
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
