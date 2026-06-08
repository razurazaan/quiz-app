import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";
import { formatDate, formatDuration, statusColor, truncate } from "../../utils/helpers";

export default function ManageExams() {
  const [exams, setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    api.get("/admin/exams").then(r => setExams(r.data.exams)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this exam and all its results?")) return;
    await api.delete(`/admin/exams/${id}`);
    toast.success("Exam deleted");
    load();
  };

  const handlePublish = async (id) => {
    await api.put(`/admin/exams/${id}/publish`);
    toast.success("Exam published!");
    load();
  };

  const filtered = filter === "all" ? exams : exams.filter(e => e.status === filter);

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h2>Manage Exams</h2>
          <p>{exams.length} exam{exams.length !== 1 ? "s" : ""} total</p>
        </div>
        <Link to="/admin/create-exam"><button className="btn btn-primary">✚ Create Exam</button></Link>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all","draft","published","ongoing","completed"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`}
            style={{ textTransform: "capitalize" }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📋</div>
          <p>No exams found.</p>
          <Link to="/admin/create-exam"><button className="btn btn-primary" style={{ marginTop: 16 }}>Create First Exam</button></Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map(exam => (
            <div key={exam._id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ color: "var(--text-primary)" }}>{exam.title}</h3>
                  <span className={`badge badge-${statusColor(exam.status)}`}>{exam.status}</span>
                </div>
                <p style={{ marginTop: 4, fontSize: "0.85rem" }}>{truncate(exam.description, 80)}</p>
                <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
                  {[
                    ["📚", exam.subject],
                    ["❓", `${exam.questions?.length ?? 0} questions`],
                    ["⏱", formatDuration(exam.duration)],
                    ["📅", formatDate(exam.startDate)],
                    ["🏆", `Pass: ${exam.passingMarks}/${exam.totalMarks}`],
                  ].map(([icon, text]) => (
                    <span key={text} style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      {icon} {text}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                {exam.status === "draft" && (
                  <button className="btn btn-success btn-sm" onClick={() => handlePublish(exam._id)}>
                    🚀 Publish
                  </button>
                )}
                <Link to={`/admin/exams/${exam._id}/results`}>
                  <button className="btn btn-secondary btn-sm">📊 Results</button>
                </Link>
                <Link to={`/admin/exams/${exam._id}/edit`}>
                  <button className="btn btn-secondary btn-sm">✏️ Edit</button>
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(exam._id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
