import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { loadAssignments, loadAttempt, loadQuiz } from "../lib/quizStore";
import { ATTEMPT_STATUS, QUESTION_TYPES, isPassing } from "../lib/quizzes";

// Whether a question was ultimately right, preferring the coach's mark over
// the automatic one so an overridden grade displays what the coach decided.
function questionOutcome(attempt, questionId) {
  const coach = attempt?.coachGrade?.perQuestion?.[questionId];
  if (coach && typeof coach.correct === "boolean") {
    return { correct: coach.correct, comment: coach.comment || "", byCoach: true };
  }
  const auto = attempt?.autoScore?.perQuestion?.[questionId];
  if (auto && typeof auto.correct === "boolean") {
    return { correct: auto.correct, comment: "", byCoach: false };
  }
  return { correct: null, comment: "", byCoach: false };
}

export default function QuizResultPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { memberIdentity, coachUsername, isMember } = useAuth();

  const [attempt, setAttempt] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // A member reads from their coach's folder; a coach reads their own.
    const coach = memberIdentity?.coach || coachUsername;
    const memberSlug = memberIdentity?.memberSlug;
    if (!coach) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await loadAssignments(coach);
        const found = all.find((a) => a.assignmentId === assignmentId);
        if (cancelled) return;
        if (!found) {
          setError("That quiz assignment could not be found.");
          setLoading(false);
          return;
        }
        // Members may only open their own results
        if (memberSlug && found.memberSlug !== memberSlug) {
          setError("That result belongs to someone else.");
          setLoading(false);
          return;
        }
        setAssignment(found);
        const [loadedQuiz, loadedAttempt] = await Promise.all([
          loadQuiz(coach, found.quizSlug),
          loadAttempt(coach, found.memberSlug, assignmentId),
        ]);
        if (cancelled) return;
        setQuiz(loadedQuiz);
        setAttempt(loadedAttempt);
        if (!loadedAttempt) setError("This quiz has not been submitted yet.");
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, memberIdentity, coachUsername]);

  if (loading) return <p className="text-secondary">Loading result…</p>;

  if (error || !attempt || !quiz) {
    return (
      <>
        <div className="page-header ph-teal animate-in">
          <h1>Quiz Result</h1>
        </div>
        <div className="section-card p-4">
          <p style={{ color: "#b91c1c" }} className="mb-3">
            {error || "Result not available."}
          </p>
          <button className="btn btn-outline-dark" onClick={() => navigate("/")}>
            Back to dashboard
          </button>
        </div>
      </>
    );
  }

  const awaiting = attempt.status === ATTEMPT_STATUS.AWAITING_GRADING;
  const passed = attempt.passed;
  const bannerColor = awaiting ? "#b45309" : passed ? "#16a34a" : "#b91c1c";

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quiz Result</div>
        <h1>{quiz.title}</h1>
        <p className="text-secondary mb-0">
          Submitted {new Date(attempt.submittedAt).toLocaleString()}
          {attempt.isLate && " · marked late"}
        </p>
      </div>

      <div
        className="section-card p-4 mb-4 animate-in animate-in-2"
        style={{ borderLeft: `3px solid ${bannerColor}` }}
      >
        {awaiting ? (
          <>
            <h2 className="h5 mb-1" style={{ fontFamily: "'Sora',sans-serif" }}>
              Submitted — awaiting grading
            </h2>
            <p className="text-secondary mb-0" style={{ fontSize: "0.85rem" }}>
              Your coach will grade this and your result will appear here.
            </p>
          </>
        ) : (
          <>
            <h2 className="h3 mb-1" style={{ fontFamily: "'Sora',sans-serif", color: bannerColor }}>
              {attempt.finalPercent}%
            </h2>
            <p className="mb-0" style={{ fontWeight: 600 }}>
              {passed ? "Passed" : "Not passed"} · {attempt.passingScore}% needed
            </p>
            {!passed && isMember && (
              <p className="text-secondary mb-0 mt-2" style={{ fontSize: "0.85rem" }}>
                Ask your coach to reassign this quiz if you would like another attempt.
              </p>
            )}
          </>
        )}
        {attempt.coachComment && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
              Coach's comment
            </div>
            <p className="mb-0" style={{ fontSize: "0.9rem" }}>{attempt.coachComment}</p>
          </div>
        )}
      </div>

      {(quiz.questions || []).map((question, index) => {
        const outcome = questionOutcome(attempt, question.id);
        const answer = attempt.answers?.[question.id];
        const chosen =
          question.type === QUESTION_TYPES.MULTIPLE_CHOICE
            ? (question.options || []).find((o) => o.id === answer)
            : null;
        const correctOption =
          question.type === QUESTION_TYPES.MULTIPLE_CHOICE
            ? (question.options || []).find((o) => o.id === question.correctOptionId)
            : null;
        const color =
          outcome.correct === null ? "#6b7280" : outcome.correct ? "#16a34a" : "#b91c1c";

        return (
          <div key={question.id} className="section-card p-4 mb-3 animate-in">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
              <span
                className="mono"
                style={{ fontSize: "0.72rem", color: "var(--ink-500)", fontWeight: 700 }}
              >
                Question {index + 1} · {question.points} point
                {question.points === 1 ? "" : "s"}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.45rem",
                  borderRadius: "999px",
                  background: `${color}18`,
                  color,
                  whiteSpace: "nowrap",
                }}
              >
                {outcome.correct === null
                  ? "Not graded"
                  : outcome.correct
                    ? "Correct"
                    : "Incorrect"}
              </span>
            </div>

            <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>{question.prompt}</p>

            <div style={{ fontSize: "0.85rem" }}>
              <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                Your answer
              </div>
              <p className="mb-2">
                {answer === undefined || String(answer).trim() === "" ? (
                  <em className="text-secondary">No answer given</em>
                ) : (
                  chosen?.text || String(answer)
                )}
              </p>

              {outcome.correct === false && (
                <>
                  <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    Correct answer
                  </div>
                  <p className="mb-0" style={{ color: "#16a34a" }}>
                    {correctOption?.text || question.correctAnswer || "—"}
                  </p>
                </>
              )}

              {outcome.comment && (
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border,#e5e7eb)" }}>
                  <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    Coach's note
                  </div>
                  <p className="mb-0">{outcome.comment}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button className="btn btn-outline-dark mt-2" onClick={() => navigate("/")}>
        Back to dashboard
      </button>
    </>
  );
}
