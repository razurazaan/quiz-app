import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { formatDate, formatSeconds, gradeColor } from "../../utils/helpers";

export default function MyResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/student/results").then(r => setResults(r.data.results)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;

  const passed = results.filter(r => r.isPassed).length;
  const avgPct = results.length ? (results.reduce((s,r) => s + r.percentage, 0) / results.length).toFixed(1) : 0;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 28 }}>
        <h2>My Results</h2>
        <p>{results.length} exam{results.length !== 1 ? "s" : ""} attempted</p>
      </div>

      {results.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          {[
            { label: "Attempted", value: results.length,    color: "var(--accent-light)" },
            { label: "Passed",    value: passed,            color: "var(--success)" },
            { label: "Failed",    value: results.length - passed, color: "var(--danger)" },
            { label: "Avg Score", value: `${avgPct}%`,      color: "var(--warning)" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">🏆</div>
          <h3>No Results Yet</h3>
          <p>You haven't taken any exams yet.</p>
          <Link to="/student/exams">
            <button className="btn btn-primary" style={{ marginTop: 16 }}>Browse Exams →</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map(r => (
            <div key={r._id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <h3 style={{ color: "var(--text-primary)", fontSize: "1rem" }}>{r.exam?.title}</h3>
                  <span className={`badge badge-${gradeColor(r.grade)}`}>{r.grade}</span>
                  <span className={`badge ${r.isPassed ? "badge-success" : "badge-danger"}`}>
                    {r.isPassed ? "✓ Pass" : "✗ Fail"}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem" }}>{r.exam?.subject}</p>
                <div style={{ marginTop: 10 }}>
                  {/* Score bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${r.percentage}%`, height: "100%",
                        background: r.isPassed ? "var(--success)" : "var(--danger)", borderRadius: 3,
                      }} />
                    </div>
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)", minWidth: 50 }}>
                      {r.percentage}%
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Score: {r.obtainedMarks}/{r.totalMarks}
                    </span>
                    {r.timeTaken && (
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        ⏱ {formatSeconds(r.timeTaken)}
                      </span>
                    )}
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      📅 {formatDate(r.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <Link to={`/student/results/${r._id}`}>
                <button className="btn btn-secondary btn-sm">View Details →</button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
