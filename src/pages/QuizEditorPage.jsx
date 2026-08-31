import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { loadQuiz, listQuizSlugs, saveQuiz } from "../lib/quizStore";
import {
  GRADING_MODES,
  QUESTION_TYPES,
  effectiveGradingMode,
  emptyQuestion,
  emptyQuiz,
  hasManualQuestions,
  makeQuestionId,
  nextOptionId,
  slugify,
  totalPoints,
  validateQuiz,
} from "../lib/quizzes";

export default function QuizEditorPage() {
  const { slug: editingSlug } = useParams();
  const navigate = useNavigate();
  const { coachUsername } = useAuth();
  const isEditing = Boolean(editingSlug);

  const [quiz, setQuiz] = useState(() => emptyQuiz());
  const [existingSlugs, setExistingSlugs] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  // Errors stay hidden until the first save attempt, so a half-typed quiz is
  // not covered in red while the coach is still writing it.
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!coachUsername) return;
    let cancelled = false;
    (async () => {
      try {
        const slugs = await listQuizSlugs(coachUsername);
        if (!cancelled) setExistingSlugs(slugs);
        if (isEditing) {
          const loaded = await loadQuiz(coachUsername, editingSlug);
          if (cancelled) return;
          if (!loaded) {
            setStatus(`Quiz "${editingSlug}" not found.`);
            setOk(false);
          } else {
            setQuiz(loaded);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus(`Failed to load: ${e.message}`);
          setOk(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachUsername, editingSlug, isEditing]);

  // A quiz's slug is its filename and its identity, so it is derived from the
  // title only while creating. Renaming an existing quiz would orphan its
  // assignments, which reference the slug.
  const slug = isEditing ? quiz.slug : slugify(quiz.title);
  const draft = useMemo(() => ({ ...quiz, slug }), [quiz, slug]);

  const errors = useMemo(() => {
    const list = validateQuiz(draft);
    if (!isEditing && slug && existingSlugs.includes(slug)) {
      list.push(`A quiz with the slug "${slug}" already exists.`);
    }
    return list;
  }, [draft, isEditing, slug, existingSlugs]);

  const update = useCallback((patch) => {
    setQuiz((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateQuestion = useCallback((index, patch) => {
    setQuiz((prev) => {
      const questions = prev.questions.slice();
      questions[index] = { ...questions[index], ...patch };
      return { ...prev, questions };
    });
  }, []);

  const addQuestion = useCallback((type) => {
    setQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, emptyQuestion(type, prev.questions.length)],
    }));
  }, []);

  const removeQuestion = useCallback((index) => {
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  }, []);

  const moveQuestion = useCallback((index, delta) => {
    setQuiz((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.questions.length) return prev;
      const questions = prev.questions.slice();
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...prev, questions };
    });
  }, []);

  const save = async () => {
    setShowErrors(true);
    if (errors.length > 0) {
      setStatus("Fix the problems listed below before saving.");
      setOk(false);
      return;
    }
    setSaving(true);
    setStatus("Saving…");
    setOk(true);
    try {
      const record = {
        ...draft,
        createdAt: draft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveQuiz(
        coachUsername,
        record,
        isEditing ? `Update quiz "${record.title}"` : `Add quiz "${record.title}"`
      );
      navigate("/quizzes");
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary">Loading quiz…</p>;

  const runsAs = effectiveGradingMode(draft);
  const modeForced = draft.gradingMode === GRADING_MODES.AUTO && runsAs === GRADING_MODES.COACH;

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quizzes</div>
        <h1>{isEditing ? "Edit Quiz" : "New Quiz"}</h1>
        <p className="text-secondary mb-0">
          Add questions, mark the correct answers, and choose how it gets graded.
        </p>
      </div>

      <div className="section-card p-4 mb-4 animate-in animate-in-2">
        <div className="mb-4">
          <label className="form-label">Title</label>
          <input
            className="form-control"
            value={quiz.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="AI Fundamentals — Module 1"
          />
          {slug && (
            <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
              {slug}.json{isEditing && " · slug is fixed once created"}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="form-label">Description (optional)</label>
          <input
            className="form-control"
            value={quiz.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What this quiz covers"
          />
        </div>

        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label">Grading</label>
            <select
              className="form-select"
              value={quiz.gradingMode}
              onChange={(e) => update({ gradingMode: e.target.value })}
            >
              <option value={GRADING_MODES.AUTO}>Auto-grade on submit</option>
              <option value={GRADING_MODES.COACH}>I'll grade it myself</option>
            </select>
            {modeForced && (
              <div className="mt-1" style={{ fontSize: "0.75rem", color: "#b45309" }}>
                This quiz has a text question set to manual grading, so it will run as
                coach-graded. Turn on “auto-grade this answer” on every text question to
                make it fully automatic.
              </div>
            )}
          </div>
          <div className="col-sm-6">
            <label className="form-label">Passing score (%)</label>
            <input
              className="form-control"
              type="number"
              min="0"
              max="100"
              value={quiz.passingScore}
              onChange={(e) => update({ passingScore: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
          Questions ({quiz.questions.length}) · {totalPoints(draft)} points
        </h2>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => addQuestion(QUESTION_TYPES.MULTIPLE_CHOICE)}
          >
            + Multiple choice
          </button>
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => addQuestion(QUESTION_TYPES.TEXT)}
          >
            + Text answer
          </button>
        </div>
      </div>

      {quiz.questions.map((question, index) => (
        <QuestionEditor
          key={question.id || index}
          index={index}
          total={quiz.questions.length}
          question={question}
          onChange={(patch) => updateQuestion(index, patch)}
          onRemove={() => removeQuestion(index)}
          onMove={(delta) => moveQuestion(index, delta)}
        />
      ))}

      {showErrors && errors.length > 0 && (
        <div className="section-card p-3 mb-3" style={{ borderLeft: "3px solid #b91c1c" }}>
          <strong style={{ fontSize: "0.85rem" }}>Fix before saving:</strong>
          <ul className="mb-0 mt-2" style={{ fontSize: "0.82rem" }}>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="d-flex gap-2 align-items-center mt-4">
        <button className="btn btn-primary-brand" onClick={save} disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Quiz"}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/quizzes")} disabled={saving}>
          Cancel
        </button>
        {status && (
          <span style={{ fontSize: "0.82rem", color: ok ? "var(--ink-500)" : "#b91c1c" }}>
            {status}
          </span>
        )}
      </div>
    </>
  );
}

function QuestionEditor({ question, index, total, onChange, onRemove, onMove }) {
  const isChoice = question.type === QUESTION_TYPES.MULTIPLE_CHOICE;

  const setOption = (optionId, text) => {
    onChange({
      options: question.options.map((o) => (o.id === optionId ? { ...o, text } : o)),
    });
  };

  const addOption = () => {
    const id = nextOptionId(question.options);
    onChange({ options: [...question.options, { id, text: "" }] });
  };

  const removeOption = (optionId) => {
    const options = question.options.filter((o) => o.id !== optionId);
    // Never leave the correct answer pointing at a deleted option
    const correctOptionId =
      question.correctOptionId === optionId ? options[0]?.id : question.correctOptionId;
    onChange({ options, correctOptionId });
  };

  return (
    <div className="section-card p-4 mb-3 animate-in">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span
          className="mono"
          style={{ fontSize: "0.72rem", color: "var(--ink-500)", fontWeight: 700 }}
        >
          {makeQuestionId(index)} · {isChoice ? "Multiple choice" : "Text answer"}
        </span>
        <div className="d-flex gap-1">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onRemove}
            style={{ color: "#b91c1c" }}
            title="Remove question"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">Question</label>
        <textarea
          className="form-control"
          rows={2}
          value={question.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="What are you asking?"
        />
      </div>

      {isChoice ? (
        <div className="mb-3">
          <label className="form-label">
            Options — select the correct answer
          </label>
          {question.options.map((option) => (
            <div key={option.id} className="d-flex align-items-center gap-2 mb-2">
              <input
                type="radio"
                name={`correct-${question.id}-${index}`}
                checked={question.correctOptionId === option.id}
                onChange={() => onChange({ correctOptionId: option.id })}
                title="Mark as the correct answer"
              />
              <span
                className="mono"
                style={{ fontSize: "0.72rem", color: "var(--ink-500)", width: "1rem" }}
              >
                {option.id}
              </span>
              <input
                className="form-control"
                value={option.text}
                onChange={(e) => setOption(option.id, e.target.value)}
                placeholder={`Option ${option.id}`}
              />
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => removeOption(option.id)}
                disabled={question.options.length <= 2}
                title={
                  question.options.length <= 2
                    ? "A question needs at least two options"
                    : "Remove option"
                }
                style={{ color: "#b91c1c" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn btn-sm btn-outline-dark mt-1" onClick={addOption}>
            + Add option
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id={`auto-${question.id}-${index}`}
              checked={Boolean(question.autoGradeText)}
              onChange={(e) => onChange({ autoGradeText: e.target.checked })}
            />
            <label className="form-check-label" htmlFor={`auto-${question.id}-${index}`}>
              Auto-grade this answer
            </label>
            <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
              Compares the typed answer to the expected one, ignoring case and extra
              spaces. Best for one or two words — leave off for anything longer and
              grade it yourself.
            </div>
          </div>
          <label className="form-label">
            {question.autoGradeText ? "Expected answer" : "Expected answer (for your reference)"}
          </label>
          <input
            className="form-control"
            value={question.correctAnswer || ""}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            placeholder="What a correct answer looks like"
          />
        </div>
      )}

      <div style={{ maxWidth: "8rem" }}>
        <label className="form-label">Points</label>
        <input
          className="form-control"
          type="number"
          min="1"
          value={question.points}
          onChange={(e) => onChange({ points: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
