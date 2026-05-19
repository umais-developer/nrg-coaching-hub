// Palette available when creating a team
export const TEAM_COLOR_OPTIONS = [
  { value: "teal",   label: "Teal",   hex: "#0f766e" },
  { value: "indigo", label: "Indigo", hex: "#4338ca" },
  { value: "amber",  label: "Amber",  hex: "#b45309" },
  { value: "rose",   label: "Rose",   hex: "#be185d" },
  { value: "sky",    label: "Sky",    hex: "#0284c7" },
  { value: "violet", label: "Violet", hex: "#6d28d9" },
  { value: "green",  label: "Green",  hex: "#16a34a" },
  { value: "orange", label: "Orange", hex: "#ea580c" },
];

export const COLOR_STYLES = {
  teal:   { badge: "rgba(15,118,110,0.12)", text: "#0d6460",  border: "#0f766e" },
  indigo: { badge: "rgba(67,56,202,0.12)",  text: "#3730a3",  border: "#4338ca" },
  amber:  { badge: "rgba(180,83,9,0.12)",   text: "#92400e",  border: "#b45309" },
  rose:   { badge: "rgba(190,24,93,0.12)",  text: "#9d174d",  border: "#be185d" },
  sky:    { badge: "rgba(2,132,199,0.12)",  text: "#0369a1",  border: "#0284c7" },
  violet: { badge: "rgba(109,40,217,0.12)", text: "#5b21b6",  border: "#6d28d9" },
  green:  { badge: "rgba(22,163,74,0.12)",  text: "#15803d",  border: "#16a34a" },
  orange: { badge: "rgba(234,88,12,0.12)",  text: "#9a3412",  border: "#ea580c" },
};

export function getColorStyles(color) {
  return COLOR_STYLES[color] || COLOR_STYLES.teal;
}

export function toSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
