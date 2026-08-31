import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { loadAssignments, loadAttempt, loadQuiz, saveAttempt } from "../lib/quizStore";
import {
  ATTEMPT_STATUS,
  GRADING_MODES,
  QUESTION_TYPES,
  buildAttempt,
  daysUntilDue,
  effectiveGradingMode,
  isLate,
} from "../lib/quizzes";

export default function QuizTakePage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { memberIdentity } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Set when an attempt already exists, so a reload cannot overwrite a
  // submission. One attempt per assignment is the rule; a fresh attempt needs
  // a new assignment from the coach.
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!memberIdentity) return;
    const { coach, memberSlug } = memberIdentity;
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
        // An assignment addressed to someone else must not open, even though
        // the file is readable — the member boundary allows reading the
        // coach's assignment list as a whole.
        if (found.memberSlug !== memberSlug) {
          setError("That quiz was assigned to someone else.");
          setLoading(false);
          return;
        }
        setAssignment(found);

        const [loadedQuiz, existing] = await Promise.all([
          loadQuiz(coach, found.quizSlug),
          loadAttempt(coach, memberSlug, assignmentId),
        ]);
        if (cancelled) return;
        if (!loadedQuiz) {
          setError("The quiz for this assignment is missing.");
        } else {
          setQuiz(loadedQuiz);
        }
        if (existing) setAlreadySubmitted(true);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, memberIdentity]);

  const setAnswer = useCallback((questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const unanswered = useMemo(() => {
    if (!quiz) return [];
    return (quiz.questions || []).filter((q) => {
      const value = answers[q.id];
      return value === undefined || String(value).trim() === "";
    });
  }, [quiz, answers]);

  const submit = async () => {
    if (!quiz || !assignment || !memberIdentity) return;
    setSubmitting(true);
    setError("");
    try {
      const { coach, memberSlug } = memberIdentity;
      // Re-check immediately before writing: the guard above runs at load time,
      // and a second tab could have submitted since.
      const existing = await loadAttempt(coach, memberSlug, assignmentId);
      if (existing) {
        setAlreadySubmitted(true);
        setSubmitting(false);
        return;
      }
      const attempt = buildAttempt({ assignment, quiz, answers });
      await saveAttempt(
        coach,
        memberSlug,
        attempt,
        `Quiz attempt: ${quiz.title} — ${memberSlug}`
      );
      // Hand the attempt over so the result page can render it immediately,
      // rather than racing the Contents API for a file written a moment ago.
      navigate(`/quizzes/result/${assignmentId}`, { state: { attempt } });
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-secondary">Loading quiz…</p>;

  if (error && !quiz) {
    return (
      <>
        <div className="page-header ph-teal animate-in">
          <h1>Quiz</h1>
        </div>
        <div className="section-card p-4">
          <p style={{ color: "#b91c1c" }} className="mb-3">{error}</p>
          <button className="btn btn-outline-dark" onClick={() => navigate("/")}>
            Back to dashboard
          </button>
        </div>
      </>
    );
  }

  if (alreadySubmitted) {
    return (
      <>
        <div className="page-header ph-teal animate-in">
          <div className="page-header-eyebrow">📝 Quiz</div>
          <h1>{quiz.title}</h1>
        </div>
        <div className="section-card p-4">
          <p className="mb-3">
            You have already submitted this quiz. Each assignment can be attempted once —
            ask your coach to reassign it if you need another go.
          </p>
          <button
            className="btn btn-primary-brand"
            onClick={() => navigate(`/quizzes/result/${assignmentId}`)}
          >
            View my result
          </button>
        </div>
      </>
    );
  }

  const mode = effectiveGradingMode(quiz);
  const overdue = isLate(assignment.dueDate);
  const days = daysUntilDue(assignment.dueDate);

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quiz</div>
        <h1>{quiz.title}</h1>
        {quiz.description && <p className="text-secondary mb-0">{quiz.description}</p>}
      </div>

      <div className="section-card p-4 mb-4 animate-in animate-in-2">
        <div className="d-flex flex-wrap gap-4" style={{ fontSize: "0.85rem" }}>
          <div>
            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>Questions</div>
            <strong>{(quiz.questions || []).length}</strong>
          </div>
          <div>
            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>To pass</div>
            <strong>{quiz.passingScore}%</strong>
          </div>
          <div>
            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>Grading</div>
            <strong>{mode === GRADING_MODES.AUTO ? "Automatic" : "By your coach"}</strong>
          </div>
          {assignment.dueDate && (
            <div>
              <div className="text-secondary" style={{ fontSize: "0.72rem" }}>Due</div>
              <strong style={{ color: overdue ? "#b91c1c" : undefined }}>
                {assignment.dueDate}
                {overdue ? " · overdue" : days === 0 ? " · today" : ""}
              </strong>
            </div>
          )}
        </div>
        {overdue && (
          <p className="mb-0 mt-3" style={{ fontSize: "0.8rem", color: "#b45309" }}>
            This quiz is past its due date. You can still submit it — it will be marked late.
          </p>
        )}
        <p className="text-secondary mb-0 mt-3" style={{ fontSize: "0.8rem" }}>
          You can attempt this quiz once. Answer everything before submitting.
        </p>
      </div>

      {(quiz.questions || []).map((question, index) => (
        <div key={question.id} className="section-card p-4 mb-3 animate-in">
          <div
            className="mono mb-2"
            style={{ fontSize: "0.72rem", color: "var(--ink-500)", fontWeight: 700 }}
          >
            Question {index + 1} of {quiz.questions.length} ·{" "}
            {question.points} point{question.points === 1 ? "" : "s"}
          </div>
          <p style={{ fontWeight: 600, marginBottom: "1rem" }}>{question.prompt}</p>

          {question.type === QUESTION_TYPES.MULTIPLE_CHOICE ? (
            (question.options || []).map((option) => (
              <div key={option.id} className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name={`q-${question.id}`}
                  id={`q-${question.id}-${option.id}`}
                  checked={answers[question.id] === option.id}
                  onChange={() => setAnswer(question.id, option.id)}
                />
                <label className="form-check-label" htmlFor={`q-${question.id}-${option.id}`}>
                  {option.text}
                </label>
              </div>
            ))
          ) : (
            <textarea
              className="form-control"
              rows={3}
              value={answers[question.id] || ""}
              onChange={(e) => setAnswer(question.id, e.target.value)}
              placeholder="Type your answer"
            />
          )}
        </div>
      ))}

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {confirming ? (
        <div className="section-card p-4 animate-in" style={{ borderLeft: "3px solid #b45309" }}>
          <p className="mb-3" style={{ fontSize: "0.9rem" }}>
            {unanswered.length > 0 ? (
              <>
                <strong>{unanswered.length} question{unanswered.length === 1 ? " is" : "s are"} unanswered.</strong>{" "}
                Unanswered questions are marked wrong. Submit anyway?
              </>
            ) : (
              <>Submit your answers? You cannot change them afterwards.</>
            )}
          </p>
          <div className="d-flex gap-2">
            <button className="btn btn-primary-brand" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Yes, submit"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Keep working
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-primary-brand" onClick={() => setConfirming(true)}>
            Submit Quiz
          </button>
          <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
            {unanswered.length === 0
              ? "All questions answered"
              : `${unanswered.length} unanswered`}
          </span>
        </div>
      )}
    </>
  );
}
