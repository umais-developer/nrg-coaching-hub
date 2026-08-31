import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import { loadAssignments, loadAttempt, loadQuiz, saveAttempt } from "../lib/quizStore";
import { QUESTION_TYPES, applyCoachGrade, percentOf } from "../lib/quizzes";

export default function QuizGradePage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { coachUsername } = useAuth();
  const { allMembers } = useTeams();

  const [assignment, setAssignment] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [marks, setMarks] = useState({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!coachUsername) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await loadAssignments(coachUsername);
        const found = all.find((a) => a.assignmentId === assignmentId);
        if (cancelled) return;
        if (!found) {
          setError("That assignment could not be found.");
          setLoading(false);
          return;
        }
        setAssignment(found);
        const [loadedQuiz, loadedAttempt] = await Promise.all([
          loadQuiz(coachUsername, found.quizSlug),
          loadAttempt(coachUsername, found.memberSlug, assignmentId),
        ]);
        if (cancelled) return;
        setQuiz(loadedQuiz);
        setAttempt(loadedAttempt);
        if (!loadedAttempt) {
          setError("This quiz has not been submitted yet.");
        } else {
          // Seed the form with whatever is already decided: a previous coach
          // grade first, otherwise the automatic result, so the coach only
          // touches what needs a human.
          const seeded = {};
          (loadedQuiz?.questions || []).forEach((q) => {
            const prior = loadedAttempt.coachGrade?.perQuestion?.[q.id];
            const auto = loadedAttempt.autoScore?.perQuestion?.[q.id];
            if (prior && typeof prior.correct === "boolean") {
              seeded[q.id] = { correct: prior.correct, comment: prior.comment || "" };
            } else if (auto && typeof auto.correct === "boolean") {
              seeded[q.id] = { correct: auto.correct, comment: "" };
            } else {
              seeded[q.id] = { correct: null, comment: "" };
            }
          });
          setMarks(seeded);
          setComment(loadedAttempt.coachComment || "");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, coachUsername]);

  const setMark = useCallback((questionId, patch) => {
    setMarks((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }, []);

  const memberName = useMemo(() => {
    const member = (allMembers || []).find((m) => m.slug === assignment?.memberSlug);
    return member?.name || assignment?.memberSlug || "";
  }, [allMembers, assignment]);

  // Live preview of the score as the coach marks, so the outcome is visible
  // before saving rather than after.
  const preview = useMemo(() => {
    if (!quiz) return null;
    let earned = 0;
    let possible = 0;
    (quiz.questions || []).forEach((q) => {
      const points = Number(q.points) || 0;
      possible += points;
      if (marks[q.id]?.correct === true) earned += points;
    });
    const percent = percentOf(earned, possible);
    return { earned, possible, percent, passed: percent >= (attempt?.passingScore || 80) };
  }, [quiz, marks, attempt]);

  const ungraded = useMemo(
    () => (quiz?.questions || []).filter((q) => marks[q.id]?.correct === null),
    [quiz, marks]
  );

  const save = async () => {
    if (!quiz || !attempt || !assignment) return;
    setSaving(true);
    setError("");
    try {
      const graded = applyCoachGrade({
        attempt,
        quiz,
        perQuestion: marks,
        comment,
        gradedBy: coachUsername,
      });
      await saveAttempt(
        coachUsername,
        assignment.memberSlug,
        graded,
        `Grade quiz: ${quiz.title} — ${assignment.memberSlug}`
      );
      navigate("/quizzes/results");
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary">Loading attempt…</p>;

  if (error && !attempt) {
    return (
      <>
        <div className="page-header ph-teal animate-in">
          <h1>Grade Quiz</h1>
        </div>
        <div className="section-card p-4">
          <p style={{ color: "#b91c1c" }} className="mb-3">{error}</p>
          <button className="btn btn-outline-dark" onClick={() => navigate("/quizzes/results")}>
            Back to results
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Grading</div>
        <h1>{quiz.title}</h1>
        <p className="text-secondary mb-0">
          {memberName} · submitted {new Date(attempt.submittedAt).toLocaleString()}
          {attempt.isLate && " · late"}
        </p>
      </div>

      <div className="section-card p-4 mb-4 animate-in animate-in-2">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
              Score as marked
            </div>
            <strong style={{ fontSize: "1.25rem" }}>
              {preview.percent}%{" "}
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: preview.passed ? "#16a34a" : "#b91c1c",
                }}
              >
                {preview.passed ? "Passing" : "Not passing"}
              </span>
            </strong>
            <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
              {preview.earned} of {preview.possible} points · {attempt.passingScore}% to pass
            </div>
          </div>
          {ungraded.length > 0 && (
            <span style={{ fontSize: "0.8rem", color: "#b45309" }}>
              {ungraded.length} question{ungraded.length === 1 ? "" : "s"} still unmarked
            </span>
          )}
        </div>
      </div>

      {(quiz.questions || []).map((question, index) => {
        const answer = attempt.answers?.[question.id];
        const chosen =
          question.type === QUESTION_TYPES.MULTIPLE_CHOICE
            ? (question.options || []).find((o) => o.id === answer)
            : null;
        const correctOption =
          question.type === QUESTION_TYPES.MULTIPLE_CHOICE
            ? (question.options || []).find((o) => o.id === question.correctOptionId)
            : null;
        const mark = marks[question.id] || {};
        const autoGraded = attempt.autoScore?.perQuestion?.[question.id]?.correct;

        return (
          <div key={question.id} className="section-card p-4 mb-3 animate-in">
            <div
              className="mono mb-2"
              style={{ fontSize: "0.72rem", color: "var(--ink-500)", fontWeight: 700 }}
            >
              Question {index + 1} · {question.points} point
              {question.points === 1 ? "" : "s"}
              {typeof autoGraded === "boolean" && (
                <span style={{ fontWeight: 500 }}>
                  {" "}· auto-marked {autoGraded ? "correct" : "incorrect"}
                </span>
              )}
            </div>
            <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>{question.prompt}</p>

            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
              Their answer
            </div>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              {answer === undefined || String(answer).trim() === "" ? (
                <em className="text-secondary">No answer given</em>
              ) : (
                chosen?.text || String(answer)
              )}
            </p>

            {(correctOption || question.correctAnswer) && (
              <>
                <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                  Expected
                </div>
                <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem", color: "#16a34a" }}>
                  {correctOption?.text || question.correctAnswer}
                </p>
              </>
            )}

            <div className="d-flex gap-2 mb-2">
              <button
                className={`btn btn-sm ${mark.correct === true ? "btn-primary-brand" : "btn-outline-dark"}`}
                onClick={() => setMark(question.id, { correct: true })}
              >
                Correct
              </button>
              <button
                className={`btn btn-sm ${mark.correct === false ? "btn-dark" : "btn-outline-dark"}`}
                onClick={() => setMark(question.id, { correct: false })}
              >
                Incorrect
              </button>
            </div>

            <input
              className="form-control"
              value={mark.comment || ""}
              onChange={(e) => setMark(question.id, { comment: e.target.value })}
              placeholder="Note on this answer (optional — the member sees this)"
            />
          </div>
        );
      })}

      <div className="section-card p-4 mb-3">
        <label className="form-label">Overall comment (optional)</label>
        <textarea
          className="form-control"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Feedback on the whole quiz — the member sees this."
        />
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div className="d-flex gap-2 align-items-center">
        <button className="btn btn-primary-brand" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Grade"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/quizzes/results")}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
