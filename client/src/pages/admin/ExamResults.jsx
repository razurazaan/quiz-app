import { useState, useEffect } from "react";
import api from "../../api/axios";
import { formatDate, formatSeconds, gradeColor } from "../../utils/helpers";

export default function ExamResults() {
  const [results, setResults] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [exams,   setExams]   = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/exams").then(r => setExams(r.data.exams));
    api.get("/admin/results").then(r => { setResults(r.data.results); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedExam) {
      api.get("/admin/results").then(r => setResults(r.data.results));
      setStats(null);
    } else {
      api.get(`/admin/results/exam/${selectedExam}`).then(r => {
        setResults(r.data.results); setStats(r.data.stats);
      });
    }
  }, [selectedExam]);

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h2>Exam Results</h2>
          <p>{results.length} submission{results.length !== 1 ? "s" : ""}</p>
        </div>
        <select className="form-select" style={{ width: 260 }} value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">All Exams</option>
          {exams.map(ex => <option key={ex._id} value={ex._id}>{ex.title}</option>)}
        </select>
      </div>

      {/* Stats cards (when exam filtered) */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {[
            { label: "Total Submissions", value: stats.total,           color: "var(--accent-light)" },
            { label: "Passed",            value: stats.passed,          color: "var(--success)" },
            { label: "Failed",            value: stats.failed,          color: "var(--danger)" },
            { label: "Avg Percentage",    value: `${stats.avgPercentage}%`, color: "var(--warning)" },
            { label: "Highest Score",     value: stats.highest,         color: "var(--info)" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loader-center"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Result</th>
                <th>Time Taken</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No results yet</td></tr>
              ) : (
                results.map(r => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>{r.student?.name}</div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{r.student?.studentId}</div>
                    </td>
                    <td>
                      <div style={{ color: "var(--text-primary)", fontSize: "0.88rem" }}>{r.exam?.title}</div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{r.exam?.subject}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {r.obtainedMarks} / {r.totalMarks}
                    </td>
                    <td>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <div style={{
                          width: 60, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${r.percentage}%`, height: "100%",
                            background: r.isPassed ? "var(--success)" : "var(--danger)", borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: "0.85rem" }}>{r.percentage}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${gradeColor(r.grade)}`}>{r.grade}</span>
                    </td>
                    <td>
                      <span className={`badge ${r.isPassed ? "badge-success" : "badge-danger"}`}>
                        {r.isPassed ? "✓ Pass" : "✗ Fail"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      {r.timeTaken ? formatSeconds(r.timeTaken) : "—"}
                    </td>
                    <td style={{ fontSize: "0.84rem" }}>{formatDate(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
