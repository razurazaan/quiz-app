import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatDate, formatDuration } from "../../utils/helpers";

export default function AvailableExams() {
  const [exams, setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/student/exams").then(r => setExams(r.data.exams)).finally(() => setLoading(false));
  }, []);

  const handleStart = (examId) => navigate(`/student/exams/${examId}`);

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 28 }}>
        <h2>Available Exams</h2>
        <p>{exams.length} exam{exams.length !== 1 ? "s" : ""} open right now</p>
      </div>

      {exams.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📋</div>
          <h3>No Exams Available</h3>
          <p>Check back later — your instructor hasn't scheduled any exams yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {exams.map(exam => (
            <div key={exam._id} className="card card-glow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <h3 style={{ color: "var(--text-primary)" }}>{exam.title}</h3>
                  {exam.myAttempts > 0 && (
                    <span className="badge badge-warning">Attempted {exam.myAttempts}×</span>
                  )}
                </div>
                <p style={{ fontSize: "0.88rem", marginBottom: 12 }}>{exam.description}</p>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {[
                    ["📚", exam.subject],
                    ["❓", `${exam.questions?.length} questions`],
                    ["⏱", formatDuration(exam.duration)],
                    ["🏆", `Pass: ${exam.passingMarks} marks`],
                    ["📅", `Till ${formatDate(exam.endDate)}`],
                    ["🔄", `${exam.maxAttempts - (exam.myAttempts||0)} attempt(s) left`],
                  ].map(([icon, text]) => (
                    <span key={text} style={{ fontSize: "0.81rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      {icon} {text}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {exam.canAttempt ? (
                  <button className="btn btn-primary" onClick={() => handleStart(exam._id)}>
                    {exam.myAttempts > 0 ? "Retake Exam →" : "Start Exam →"}
                  </button>
                ) : (
                  <button className="btn btn-secondary" disabled>
                    ✓ Completed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
