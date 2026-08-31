import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTeams } from "../contexts/TeamsContext";
import {
  appendAssignments,
  indexAttemptsByAssignment,
  loadAssignments,
  loadAttempts,
  loadQuizzes,
} from "../lib/quizStore";
import { buildAssignment, isAssignmentOpen } from "../lib/quizzes";

export default function QuizAssignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { coachUsername } = useAuth();
  const { teams } = useTeams();

  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizSlug, setQuizSlug] = useState(searchParams.get("quiz") || "");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);

  const load = useCallback(async () => {
    if (!coachUsername) return;
    setLoading(true);
    try {
      const [quizList, asgs, atts] = await Promise.all([
        loadQuizzes(coachUsername),
        loadAssignments(coachUsername),
        loadAttempts(coachUsername),
      ]);
      setQuizzes(quizList);
      setAssignments(asgs);
      setAttempts(atts);
      setQuizSlug((current) => current || quizList[0]?.slug || "");
    } catch (e) {
      setStatus(`Failed to load: ${e.message}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [coachUsername]);

  useEffect(() => {
    load();
  }, [load]);

  const attemptsById = useMemo(() => indexAttemptsByAssignment(attempts), [attempts]);

  // Members already holding an unfinished assignment for this quiz. Assigning
  // again would give them two open copies of the same thing, so they are shown
  // as pending rather than offered for selection.
  const pendingBySlug = useMemo(() => {
    const pending = new Set();
    assignments
      .filter((a) => a.quizSlug === quizSlug)
      .forEach((a) => {
        if (isAssignmentOpen(a, attemptsById)) pending.add(a.memberSlug);
      });
    return pending;
  }, [assignments, quizSlug, attemptsById]);

  const toggle = (memberSlug) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberSlug)) next.delete(memberSlug);
      else next.add(memberSlug);
      return next;
    });
  };

  const toggleTeam = (team) => {
    const slugs = team.members.map((m) => m.slug).filter((s) => !pendingBySlug.has(s));
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = slugs.every((s) => next.has(s));
      slugs.forEach((s) => (allSelected ? next.delete(s) : next.add(s)));
      return next;
    });
  };

  const assign = async () => {
    if (!quizSlug || selected.size === 0) return;
    setSaving(true);
    setStatus("Assigning…");
    setOk(true);
    try {
      const memberTeam = {};
      (teams || []).forEach((team) =>
        (team.members || []).forEach((m) => {
          memberTeam[m.slug] = team.slug;
        })
      );

      const records = [...selected].map((memberSlug) =>
        buildAssignment({
          quizSlug,
          memberSlug,
          teamSlug: memberTeam[memberSlug] || null,
          dueDate: dueDate || null,
          assignedBy: coachUsername,
        })
      );

      const quiz = quizzes.find((q) => q.slug === quizSlug);
      await appendAssignments(
        coachUsername,
        records,
        `Assign quiz "${quiz?.title || quizSlug}" to ${records.length} member${
          records.length === 1 ? "" : "s"
        }`
      );
      navigate("/quizzes");
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary">Loading…</p>;

  const hasMembers = (teams || []).some((t) => (t.members || []).length > 0);

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">📝 Quizzes</div>
        <h1>Assign a Quiz</h1>
        <p className="text-secondary mb-0">
          Pick a quiz, set a due date, and choose who takes it.
        </p>
      </div>

      {quizzes.length === 0 ? (
        <div className="section-card p-4 text-center animate-in animate-in-2">
          <p className="text-secondary mb-0">
            No quizzes to assign yet — create one first.
          </p>
        </div>
      ) : (
        <>
          <div className="section-card p-4 mb-4 animate-in animate-in-2">
            <div className="row g-3">
              <div className="col-sm-7">
                <label className="form-label">Quiz</label>
                <select
                  className="form-select"
                  value={quizSlug}
                  onChange={(e) => setQuizSlug(e.target.value)}
                >
                  {quizzes.map((q) => (
                    <option key={q.slug} value={q.slug}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-5">
                <label className="form-label">Due date (optional)</label>
                <input
                  className="form-control"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <div className="text-secondary mt-1" style={{ fontSize: "0.75rem" }}>
                  Late submissions are flagged, never blocked.
                </div>
              </div>
            </div>
          </div>

          {!hasMembers ? (
            <div className="section-card p-4 text-center">
              <p className="text-secondary mb-0">
                No team members yet. Add members before assigning a quiz.
              </p>
            </div>
          ) : (
            (teams || []).map((team) => {
              const members = team.members || [];
              if (members.length === 0) return null;
              const selectable = members.filter((m) => !pendingBySlug.has(m.slug));
              const allSelected =
                selectable.length > 0 && selectable.every((m) => selected.has(m.slug));
              return (
                <div key={team.slug} className="section-card p-4 mb-3 animate-in">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2
                      className="h6 mb-0"
                      style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
                    >
                      {team.name}
                    </h2>
                    <button
                      className="btn btn-sm btn-outline-dark"
                      onClick={() => toggleTeam(team)}
                      disabled={selectable.length === 0}
                    >
                      {allSelected ? "Clear team" : "Select team"}
                    </button>
                  </div>
                  {members.map((member) => {
                    const pending = pendingBySlug.has(member.slug);
                    return (
                      <div key={member.slug} className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`m-${team.slug}-${member.slug}`}
                          checked={selected.has(member.slug)}
                          disabled={pending}
                          onChange={() => toggle(member.slug)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`m-${team.slug}-${member.slug}`}
                          style={{ opacity: pending ? 0.55 : 1 }}
                        >
                          {member.name}
                          {member.position && (
                            <span className="text-secondary" style={{ fontSize: "0.78rem" }}>
                              {" "}
                              · {member.position}
                            </span>
                          )}
                          {pending && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                marginLeft: "0.5rem",
                                color: "#b45309",
                              }}
                            >
                              already assigned — not yet submitted
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          <div className="d-flex gap-2 align-items-center mt-4">
            <button
              className="btn btn-primary-brand"
              onClick={assign}
              disabled={saving || selected.size === 0}
            >
              {saving
                ? "Assigning…"
                : `Assign to ${selected.size} member${selected.size === 1 ? "" : "s"}`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate("/quizzes")}
              disabled={saving}
            >
              Cancel
            </button>
            {status && (
              <span style={{ fontSize: "0.82rem", color: ok ? "var(--ink-500)" : "#b91c1c" }}>
                {status}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
