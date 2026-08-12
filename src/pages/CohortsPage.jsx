import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTeams } from "../contexts/TeamsContext";
import { TEAM_COLOR_OPTIONS, getColorStyles, toSlug } from "../lib/teamColors";
import { COHORT_STATUS_LABELS, formatDateRange, getCohortStatus } from "../lib/cohorts";

const STATUS_COLORS = {
  upcoming: "#0284c7",
  active: "#16a34a",
  completed: "#6b7280",
};

function StatusPill({ cohort }) {
  const status = getCohortStatus(cohort);
  if (!status) return null;
  const color = STATUS_COLORS[status];
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
      }}
    >
      {COHORT_STATUS_LABELS[status]}
    </span>
  );
}

export default function CohortsPage() {
  const { teams, cohorts, saveAll } = useTeams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Slug of the cohort being edited; "" means we're creating a new one
  const [editingSlug, setEditingSlug] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState("indigo");

  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(true);
  const [saving, setSaving] = useState(false);

  // A cohort's slug is its identity and never changes, so keep the original
  // when editing and only derive a new one when creating.
  const slug = editingSlug || toSlug(name);
  const preview = getColorStyles(color);

  // Team counts per cohort — drives both the list and the delete guard
  const teamsByCohort = useMemo(() => {
    const map = {};
    (teams || []).forEach((t) => {
      if (!t.cohort) return;
      (map[t.cohort] = map[t.cohort] || []).push(t);
    });
    return map;
  }, [teams]);

  function resetForm() {
    setEditingSlug("");
    setName("");
    setStartDate("");
    setEndDate("");
    setColor("indigo");
    setStatus("");
    setOk(true);
  }

  function startEditing(cohort) {
    setEditingSlug(cohort.slug);
    setName(cohort.name);
    setStartDate(cohort.startDate || "");
    setEndDate(cohort.endDate || "");
    setColor(cohort.color || "indigo");
    setStatus("");
    setOk(true);
  }

  // Deep link support: /cohorts?slug=pod-1a-us opens that cohort for editing
  useEffect(() => {
    const target = searchParams.get("slug");
    if (!target || !cohorts.length) return;
    const found = cohorts.find((c) => c.slug === target);
    if (found && found.slug !== editingSlug) {
      startEditing(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, cohorts]);

  const onSave = async () => {
    if (!name.trim()) {
      setStatus("Cohort name is required.");
      setOk(false);
      return;
    }
    if (!slug) {
      setStatus("Could not generate a slug from that name.");
      setOk(false);
      return;
    }
    if (cohorts.some((c) => c.slug === slug && c.slug !== editingSlug)) {
      setStatus(`A cohort with slug "${slug}" already exists.`);
      setOk(false);
      return;
    }
    if (!startDate) {
      setStatus("Start date is required.");
      setOk(false);
      return;
    }
    if (!endDate) {
      setStatus("End date is required.");
      setOk(false);
      return;
    }
    // ISO yyyy-mm-dd sorts lexicographically, so a string compare is correct here
    if (endDate < startDate) {
      setStatus("End date must be on or after the start date.");
      setOk(false);
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    setOk(false);
    try {
      const record = { name: name.trim(), slug, startDate, endDate, color };
      const updated = editingSlug
        ? cohorts.map((c) => (c.slug === editingSlug ? record : c))
        : [...cohorts, record];

      await saveAll({
        cohorts: updated,
        message: `chore: ${editingSlug ? "update" : "add"} cohort "${name.trim()}"`,
      });

      setOk(true);
      setStatus(`Cohort "${name.trim()}" ${editingSlug ? "updated" : "added"}!`);
      if (!editingSlug) {
        resetForm();
        setStatus(`Cohort "${name.trim()}" added!`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (cohort) => {
    // Never orphan a team — block the delete and name what is blocking it
    const assigned = teamsByCohort[cohort.slug] || [];
    if (assigned.length) {
      setStatus(
        `Cannot delete "${cohort.name}" — ${assigned.length} team${assigned.length === 1 ? " is" : "s are"} still assigned: ${assigned.map((t) => t.name).join(", ")}.`
      );
      setOk(false);
      return;
    }
    if (!window.confirm(`Delete cohort "${cohort.name}"? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setStatus("Deleting...");
    setOk(false);
    try {
      await saveAll({
        cohorts: cohorts.filter((c) => c.slug !== cohort.slug),
        message: `chore: delete cohort "${cohort.name}"`,
      });
      if (editingSlug === cohort.slug) {
        resetForm();
        setSearchParams({});
      }
      setOk(true);
      setStatus(`Cohort "${cohort.name}" deleted.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setOk(false);
    } finally {
      setSaving(false);
    }
  };

  const sortedCohorts = useMemo(
    () =>
      cohorts
        .slice()
        .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""))),
    [cohorts]
  );

  return (
    <>
      <div className="page-header ph-teal animate-in">
        <div className="page-header-eyebrow">🗓 Cohorts</div>
        <h1 style={{ fontSize: "2rem" }}>Cohorts</h1>
        <p className="text-secondary mb-0">
          A cohort is a program run with a start and end date. Every team can be assigned to one.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-lg-6 animate-in animate-in-2">
          <div className="section-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                {editingSlug ? "Edit Cohort" : "New Cohort"}
              </h2>
              {editingSlug && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    resetForm();
                    setSearchParams({});
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {status && (
              <p className={`alert ${ok ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</p>
            )}

            <div className="mb-4">
              <label className="form-label">Cohort Name</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pod 1A-US"
              />
              {slug && (
                <div className="mono mt-1" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                  slug: <strong>{slug}</strong>
                  {editingSlug && " (not editable)"}
                </div>
              )}
            </div>

            <div className="row g-3 mb-4">
              <div className="col-sm-6">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">Cohort Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                {TEAM_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "999px",
                      border: `2px solid ${color === opt.value ? opt.hex : "transparent"}`,
                      background: `${opt.hex}22`,
                      color: opt.hex,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      outline: "none",
                      transition: "all 150ms ease"
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary-brand"
              type="button"
              onClick={onSave}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingSlug
                ? "✓ Save Changes"
                : "✓ Save Cohort To Repository"}
            </button>
          </div>
        </div>

        <div className="col-lg-6 animate-in animate-in-3">
          <div className="section-card p-4 h-100">
            <h2
              className="h6 mb-3"
              style={{
                fontFamily: "'Sora',sans-serif",
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.7rem"
              }}
            >
              Preview
            </h2>
            {name ? (
              <article className="section-card p-3" style={{ borderTop: `3px solid ${preview.border}` }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>
                    {name}
                  </h3>
                  <StatusPill cohort={{ startDate, endDate }} />
                </div>
                <div className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>
                  {formatDateRange(startDate, endDate)}
                </div>
              </article>
            ) : (
              <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                Enter a cohort name to see a preview.
              </p>
            )}

            <div style={{ borderTop: "1px solid var(--line)", marginTop: "1.5rem", paddingTop: "1rem" }}>
              <h3
                className="h6 mb-3"
                style={{
                  fontFamily: "'Sora',sans-serif",
                  color: "var(--ink-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.7rem"
                }}
              >
                Existing cohorts
              </h3>
              {sortedCohorts.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.88rem" }}>
                  No cohorts yet. Teams without a cohort appear under “Unknown” on the roster.
                </p>
              ) : (
                sortedCohorts.map((c) => {
                  const s = getColorStyles(c.color);
                  const assigned = teamsByCohort[c.slug] || [];
                  return (
                    <div
                      key={c.slug}
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderRadius: "8px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderLeft: `3px solid ${s.border}`,
                        marginBottom: "0.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap"
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{c.name}</span>
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                          <StatusPill cohort={c} />
                          <span className="team-badge" style={{ background: s.badge, color: s.text }}>
                            {assigned.length} {assigned.length === 1 ? "team" : "teams"}
                          </span>
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-500)" }}>
                        {formatDateRange(c.startDate, c.endDate)}
                      </div>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => startEditing(c)}
                          disabled={saving}
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: "var(--ink-500)",
                            cursor: "pointer"
                          }}
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(c)}
                          disabled={saving}
                          title={
                            assigned.length
                              ? `${assigned.length} team(s) still assigned to this cohort`
                              : "Delete this cohort"
                          }
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: assigned.length ? "var(--ink-300)" : "#be185d",
                            cursor: "pointer"
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
