import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/student/dashboard"),
      api.get("/student/results"),
    ]).then(([dashRes, resRes]) => {
      setStats(dashRes.data.stats);
      setRecent(resRes.data.results.slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;

  const statCards = [
    { label: "Available Exams", value: stats?.availableExams,  icon: "📋", color: "var(--accent-light)", to: "/student/exams" },
    { label: "Exams Attempted", value: stats?.totalAttempts,   icon: "✍️",  color: "var(--info)"         },
    { label: "Passed",          value: stats?.passed,          icon: "✅", color: "var(--success)"       },
    { label: "Avg Score",       value: `${stats?.avgPercentage}%`, icon: "📈", color: "var(--warning)"  },
  ];

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 32 }}>
        <h2>Welcome, {user?.name} 🎓</h2>
        <p style={{ marginTop: 4 }}>
          {user?.department && `${user.department} · `}
          {user?.semester && `Semester ${user.semester} · `}
          {user?.studentId}
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card card-glow" style={{ cursor: s.to ? "pointer" : "default" }}
            onClick={() => s.to && (window.location.href = s.to)}>
            <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value ?? "—"}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* CTA banner */}
      {(stats?.availableExams ?? 0) > 0 && (
        <div style={{
          background: "linear-gradient(135deg, var(--accent-glow), transparent)",
          border: "1px solid var(--accent)", borderRadius: "var(--radius-lg)",
          padding: "24px 28px", marginBottom: 28, display: "flex",
          alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <h3 style={{ color: "var(--accent-light)" }}>
              {stats.availableExams} exam{stats.availableExams > 1 ? "s" : ""} available now!
            </h3>
            <p style={{ marginTop: 4, fontSize: "0.88rem" }}>Check available exams and start your quiz.</p>
          </div>
          <Link to="/student/exams">
            <button className="btn btn-primary">Take Exam →</button>
          </Link>
        </div>
      )}

      {/* Recent results */}
      <div className="card">
        <div className="section-header">
          <h3>Recent Results</h3>
          <Link to="/student/results"><button className="btn btn-secondary btn-sm">View All →</button></Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>No results yet. Take your first exam!</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Exam</th><th>Score</th><th>Grade</th><th>Result</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r._id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.exam?.title}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{r.exam?.subject}</div>
                  </td>
                  <td>{r.obtainedMarks}/{r.totalMarks} ({r.percentage}%)</td>
                  <td><span className={`badge badge-${r.grade === "F" ? "danger" : "success"}`}>{r.grade}</span></td>
                  <td><span className={`badge ${r.isPassed ? "badge-success" : "badge-danger"}`}>{r.isPassed ? "Pass" : "Fail"}</span></td>
                  <td style={{ fontSize: "0.84rem", color: "var(--text-muted)" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
