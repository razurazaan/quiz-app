export const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const formatSeconds = (secs) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
};

export const gradeColor = (grade) => ({
  "A+": "success", A: "success", B: "info", C: "warning", D: "warning", F: "danger"
}[grade] || "info");

export const statusColor = (status) => ({
  draft: "warning", published: "info", ongoing: "success", completed: "purple"
}[status] || "info");

export const getInitials = (name = "") =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

export const truncate = (str, n = 60) => str?.length > n ? str.slice(0, n) + "…" : str;
