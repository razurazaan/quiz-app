import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import { formatDate, formatSeconds, gradeColor } from "../../utils/helpers";
import MathEditor from "../../components/common/MathEditor";

export default function ResultDetail() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/student/results/${id}`).then(r => setResult(r.data.result)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!result) return <div className="empty-state"><p>Result not found.</p></div>;

  const { exam } = result;
  const gradeLabel = gradeColor(result.grade);

  // Detect if an answer string contains LaTeX (has backslash commands or ^ _ symbols)
  const isMath = (str) => str && /[\\^_{}]/.test(str);

  return (
    <div className="animate-fade" style={{ maxWidth: 800, margin: "0 auto" }}>

      {/* Result banner */}
      <div className="card" style={{
        textAlign: "center", padding: 40, marginBottom: 24,
        background: result.isPassed
          ? "linear-gradient(135deg, var(--success-bg), var(--bg-card))"
          : "linear-gradient(135deg, var(--danger-bg), var(--bg-card))",
        border: `1px solid ${result.isPassed ? "var(--success)" : "var(--danger)"}`,
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 8 }}>
          {result.isPassed ? "🎉" : "📉"}
        </div>
        <h1 style={{ fontSize: "2rem", color: result.isPassed ? "var(--success)" : "var(--danger)" }}>
          {result.isPassed ? "Congratulations!" : "Better Luck Next Time"}
        </h1>
        <p style={{ marginTop: 4 }}>{exam?.title} · {exam?.subject}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 28, flexWrap: "wrap" }}>
          {[
            ["Score",      `${result.obtainedMarks} / ${result.totalMarks}`],
            ["Percentage", `${result.percentage}%`],
            ["Grade",      result.grade],
            ["Time Taken", result.timeTaken ? formatSeconds(result.timeTaken) : "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer review */}
      {exam?.allowReview && (
        <div>
          <h3 style={{ marginBottom: 16 }}>Answer Review</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.answers.map((a, i) => (
              <div key={i} className="card" style={{
                borderColor: a.isCorrect ? "var(--success)" : a.selectedAnswer ? "var(--danger)" : "var(--border)",
              }}>
                {/* Question text + marks badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className="badge badge-purple">Q{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <MathEditor value={a.questionText} readOnly />
                    </div>
                  </div>
                  <span className={`badge ${a.isCorrect ? "badge-success" : a.selectedAnswer ? "badge-danger" : "badge-warning"}`}>
                    {a.isCorrect ? `+${a.marksAwarded}` : a.selectedAnswer ? `${a.marksAwarded}` : "Skipped"}
                  </span>
                </div>

                {/* Your answer */}
                <div style={{ marginBottom: a.isCorrect ? 0 : 10 }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                    Your answer
                  </span>
                  {a.selectedAnswer ? (
                    isMath(a.selectedAnswer)
                      ? <MathEditor value={a.selectedAnswer} readOnly />
                      : <span style={{ color: a.isCorrect ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                          {a.selectedAnswer}
                        </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not answered</span>
                  )}
                </div>

                {/* Correct answer (only shown when wrong) */}
                {!a.isCorrect && a.correctAnswer && (
                  <div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                      Correct answer
                    </span>
                    {isMath(a.correctAnswer)
                      ? <MathEditor value={a.correctAnswer} readOnly />
                      : <span style={{ color: "var(--success)", fontWeight: 600 }}>{a.correctAnswer}</span>
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link to="/student/results">
          <button className="btn btn-secondary">← Back to Results</button>
        </Link>
        <Link to="/student/exams">
          <button className="btn btn-primary">Take Another Exam →</button>
        </Link>
      </div>
    </div>
  );
}
