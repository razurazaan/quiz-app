import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { formatDate, statusColor } from "../../utils/helpers";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/dashboard").then(r => setStats(r.data.stats)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;

  const statCards = [
    { label: "Total Students",    value: stats?.totalStudents,  icon: "👥", color: "var(--accent-light)" },
    { label: "Total Exams",       value: stats?.totalExams,     icon: "📋", color: "var(--info)" },
    { label: "Total Attempts",    value: stats?.totalResults,   icon: "✍️",  color: "var(--success)" },
    { label: "Pass Rate",         value: `${stats?.passRate}%`, icon: "🏆", color: "var(--warning)" },
  ];

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2>Welcome back, {user?.name} 👋</h2>
        <p style={{ marginTop: 4 }}>Here's what's happening with your exams today.</p>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card card-glow" style={{ position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value ?? "—"}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Exams */}
      <div className="card">
        <div className="section-header">
          <h3>Recent Exams</h3>
          <Link to="/admin/exams"><button className="btn btn-secondary btn-sm">View All →</button></Link>
        </div>

        {stats?.recentExams?.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentExams.map(ex => (
                <tr key={ex._id}>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{ex.title}</td>
                  <td>
                    <span className={`badge badge-${statusColor(ex.status)}`}>
                      {ex.status}
                    </span>
                  </td>
                  <td>{formatDate(ex.startDate)}</td>
                  <td>
                    <Link to={`/admin/exams/${ex._id}`}>
                      <button className="btn btn-secondary btn-sm">View</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="icon">📋</div>
            <p>No exams yet. <Link to="/admin/create-exam">Create your first exam</Link></p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid-2" style={{ marginTop: 24 }}>
        <Link to="/admin/create-exam" style={{ textDecoration: "none" }}>
          <div className="card card-glow" style={{ cursor: "pointer", borderColor: "var(--accent)", textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✚</div>
            <h3 style={{ color: "var(--accent-light)" }}>Create New Exam</h3>
            <p style={{ marginTop: 4, fontSize: "0.88rem" }}>Design a new quiz with questions, timer & schedule</p>
          </div>
        </Link>
        <Link to="/admin/results" style={{ textDecoration: "none" }}>
          <div className="card card-glow" style={{ cursor: "pointer", textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📊</div>
            <h3>View All Results</h3>
            <p style={{ marginTop: 4, fontSize: "0.88rem" }}>Analyse student performance and grade reports</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
