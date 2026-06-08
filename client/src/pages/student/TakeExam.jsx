import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useTimer } from "../../hooks/useTimer";
import toast from "react-hot-toast";
import MathEditor from "../../components/common/MathEditor";

const MCQ_LABELS = ["A", "B", "C", "D"];
const normalizeQuestionType = (type) => type === "true_false" ? "true_false" : "mcq";
const ensureMcqOptions = (options = []) => MCQ_LABELS.map(label => {
  const existing = options.find(option => option.label === label);
  return { label, text: existing?.text || "" };
});

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [answers, setAnswers]       = useState({});
  const [current, setCurrent]       = useState(0);
  const [startedAt]                 = useState(new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const [timerDuration, setTimerDuration] = useState(0);

  const submittingRef = useRef(false);

  const handleExpire = useCallback(() => {
    if (submittingRef.current) return;
    toast.error("⏰ Time's up! Submitting automatically…");
    submitExam("timed_out");
  }, []);

  const timer = useTimer(timerDuration, handleExpire);

  useEffect(() => {
    api.get(`/student/exams/${id}`)
      .then(r => {
        setExam(r.data.exam);
        setTimerDuration(r.data.exam.duration * 60);
      })
      .catch(err => {
        toast.error(err.response?.data?.message || "Could not load exam");
        navigate("/student/exams");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);


  const startTimer = () => {
    timer.reset();
    timer.start();
  };

  const selectAnswer = (qId, answer) => setAnswers(p => ({ ...p, [qId]: answer }));

  const submitExam = async (status = "completed") => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({ questionId, selectedAnswer })),
        startedAt,
        status,
      };
      const res = await api.post(`/student/exams/${id}/submit`, payload);
      toast.success("Exam submitted!");
      navigate(`/student/results/${res.data.result._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!exam)   return null;

  const q           = exam.questions[current];
  const questionType = normalizeQuestionType(q.questionType);
  const mcqOptions = ensureMcqOptions(q.options || []);
  const answered    = Object.keys(answers).length;
  const total       = exam.questions.length;
  const progressPct = (answered / total) * 100;

  // ─── Confirmation screen ───────────────────────────────────────────────────
  if (!confirmed) {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto" }} className="animate-fade">
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📝</div>
          <h2>{exam.title}</h2>
          <p style={{ marginTop: 8 }}>{exam.subject}</p>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: "28px 0",
            background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: 20,
          }}>
            {[
              ["Questions",     total],
              ["Duration",      `${exam.duration} min`],
              ["Total Marks",   exam.totalMarks],
              ["Passing Marks", exam.passingMarks],
              ["Negative Mkg",  exam.negativeMarking > 0 ? `-${exam.negativeMarking}` : "None"],
              ["Max Attempts",  exam.maxAttempts],
            ].map(([label, val]) => (
              <div key={label} style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 24 }}>
            Once you start, the timer will begin. Make sure you're in a quiet environment.
          </p>
          <button className="btn btn-primary" style={{ padding: "13px 40px", fontSize: "1rem" }}
            onClick={() => { setConfirmed(true); startTimer(); }}>
            Start Exam →
          </button>
        </div>
      </div>
    );
  }

  // ─── Active exam ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", maxWidth: 1100, margin: "0 auto" }}>

      {/* Left: Question area */}
      <div style={{ flex: 1 }}>

        {/* Top bar */}
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "14px 20px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{exam.title}</div>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem",
            color: timer.isCritical ? "var(--danger)" : timer.isWarning ? "var(--warning)" : "var(--success)",
            animation: timer.isCritical ? "pulse 1s ease infinite" : "none",
          }}>
            ⏱ {timer.formatted}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.3s" }} />
        </div>

        {/* Question card */}
        <div className="card animate-fade" key={current} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <span className="badge badge-purple">Q {current + 1} / {total}</span>
            <span className="badge badge-info">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <MathEditor value={q.questionText} readOnly />
          </div>

          {/* MCQ */}
          {questionType === "mcq" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mcqOptions.map(opt => {
                const selected = answers[q._id] === opt.label;
                return (
                  <button key={opt.label} onClick={() => selectAnswer(q._id, opt.label)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      background: selected ? "var(--accent-glow)" : "var(--bg-elevated)",
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      color: "var(--text-primary)", textAlign: "left", transition: "all 0.15s",
                      minWidth: 0,
                    }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: selected ? "var(--accent)" : "var(--bg-primary)",
                      color: selected ? "#fff" : "var(--text-muted)",
                      fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    }}>{opt.label}</span>
                    <span style={{ fontSize: "0.9rem", overflowWrap: "anywhere" }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* True / False */}
          {questionType === "true_false" && (
            <div style={{ display: "flex", gap: 12 }}>
              {["True", "False"].map(opt => {
                const selected = answers[q._id] === opt;
                return (
                  <button key={opt} onClick={() => selectAnswer(q._id, opt)}
                    style={{
                      flex: 1, padding: "18px", borderRadius: "var(--radius-md)",
                      border: `2px solid ${selected ? (opt === "True" ? "var(--success)" : "var(--danger)") : "var(--border)"}`,
                      background: selected ? (opt === "True" ? "var(--success-bg)" : "var(--danger-bg)") : "var(--bg-elevated)",
                      color: selected ? (opt === "True" ? "var(--success)" : "var(--danger)") : "var(--text-secondary)",
                      fontFamily: "var(--font-display)", fontWeight: 300, fontSize: "1rem",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {opt === "True" ? "✓ True" : "✗ False"}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}>← Prev</button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{answered} of {total} answered</span>
          {current < total - 1 ? (
            <button className="btn btn-secondary" onClick={() => setCurrent(p => p + 1)}>Next →</button>
          ) : (
            <button className="btn btn-primary" onClick={() => submitExam()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Exam ✓"}
            </button>
          )}
        </div>
      </div>

      {/* Right: Question palette */}
      <div className="card" style={{ width: 220, flexShrink: 0, position: "sticky", top: 20 }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Question Palette
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
          {exam.questions.map((q2, i) => {
            const isAnswered = !!answers[q2._id];
            const isCurrent  = i === current;
            return (
              <button key={i} onClick={() => setCurrent(i)}
                style={{
                  padding: "8px 4px", borderRadius: "var(--radius-sm)",
                  background: isCurrent ? "var(--accent)" : isAnswered ? "var(--success-bg)" : "var(--bg-elevated)",
                  color: isCurrent ? "#fff" : isAnswered ? "var(--success)" : "var(--text-muted)",
                  fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                  border: `1px solid ${isCurrent ? "var(--accent)" : isAnswered ? "var(--success)" : "var(--border)"}`,
                  transition: "all 0.1s",
                }}>
                {i + 1}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--success-bg)", border: "1px solid var(--success)" }} />
            Answered ({answered})
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
            Not answered ({total - answered})
          </div>
        </div>

        <button className="btn btn-primary w-full" style={{ marginTop: 20 }}
          onClick={() => submitExam()} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit ✓"}
        </button>
      </div>
    </div>
  );
}
