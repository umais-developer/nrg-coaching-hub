// Cohort helpers — a cohort groups teams into a program run with a start/end date.
// Cohort dates are calendar dates (yyyy-mm-dd, no time), so they must never be
// shifted by a timezone: `new Date("2026-05-15")` parses as UTC midnight and
// renders as May 14 anywhere west of Greenwich. Parse the parts instead.

// Teams with no cohort (or a cohort that no longer exists) fall in here.
// Not a stored record — the slug is namespaced so it can never collide with toSlug() output.
export const UNKNOWN_COHORT = {
  name: "Unknown",
  slug: "__unknown__",
  color: "rose",
};

export function isUnknownCohort(cohort) {
  return !cohort || cohort.slug === UNKNOWN_COHORT.slug;
}

function parseISODate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d); // local midnight — no UTC round-trip
}

export function formatDate(value) {
  const date = parseISODate(value);
  if (!date) return "";
  // No timeZone option — the Date is already a bare local calendar date.
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateRange(startDate, endDate) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return "—";
}

// Today's calendar date in US Central, as yyyy-mm-dd.
// Program milestones are US-scheduled, so a cohort must flip to "completed" at
// midnight Central for every coach — not at their own local midnight.
// en-CA formats as yyyy-mm-dd; America/Chicago covers the CST/CDT switch.
export function todayInCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// ISO yyyy-mm-dd strings sort lexicographically, so plain < / > is correct here
// and sidesteps Date math and DST edge cases entirely.
export function getCohortStatus(cohort, today = todayInCST()) {
  const { startDate, endDate } = cohort || {};
  if (!startDate && !endDate) return null;
  if (startDate && today < startDate) return "upcoming";
  if (endDate && today > endDate) return "completed";
  return "active";
}

export const COHORT_STATUS_LABELS = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

export function findCohort(cohorts, slug) {
  if (!slug) return null;
  return (cohorts || []).find((c) => c.slug === slug) || null;
}

// Resolves the cohort a team belongs to, falling back to Unknown when the team
// has no cohort key or points at a cohort that has since been deleted.
export function getTeamCohort(team, cohorts) {
  return findCohort(cohorts, team?.cohort) || UNKNOWN_COHORT;
}

// Ordered [{ cohort, teams }] — newest cohort first, Unknown last and omitted when empty.
export function groupTeamsByCohort(teams, cohorts) {
  const all = teams || [];
  const sorted = (cohorts || [])
    .slice()
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));

  const groups = sorted.map((cohort) => ({
    cohort,
    teams: all.filter((t) => t.cohort === cohort.slug),
  }));

  const known = new Set(sorted.map((c) => c.slug));
  const orphaned = all.filter((t) => !t.cohort || !known.has(t.cohort));
  if (orphaned.length) {
    groups.push({ cohort: UNKNOWN_COHORT, teams: orphaned });
  }

  return groups;
}

export function countMembers(teams) {
  return (teams || []).reduce((sum, t) => sum + (t.members || []).length, 0);
}
