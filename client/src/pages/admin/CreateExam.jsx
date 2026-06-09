import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";
import MathEditor from "../../components/common/MathEditor.jsx";

const MCQ_LABELS = ["A", "B", "C", "D"];
const createMcqOptions = () => MCQ_LABELS.map(label => ({ label, text: "" }));
const normalizeQuestionType = (type) => type === "true_false" ? "true_false" : "mcq";
const ensureMcqOptions = (options = []) => MCQ_LABELS.map(label => {
  const existing = options.find(option => option.label === label);
  return { label, text: existing?.text || "" };
});
const normalizeQuestionForSave = (question) => {
  const questionType = normalizeQuestionType(question.questionType);
  const options = ensureMcqOptions(question.options || []);

  return {
    ...question,
    questionType,
    options,
    correctAnswer: questionType === "true_false"
      ? (question.correctAnswer === "False" ? "False" : "True")
      : (MCQ_LABELS.includes(question.correctAnswer) ? question.correctAnswer : "A"),
  };
};

const defaultQuestion = () => ({
  questionText: "", questionType: "mcq", marks: 1,
  options: createMcqOptions(),
  correctAnswer: "A", explanation: "",
});

export default function CreateExam() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);          // 1 = details, 2 = questions
  const [loading, setLoading] = useState(false);

  const [details, setDetails] = useState({
    title: "", subject: "", description: "",
    startDate: "", endDate: "", startTime: "", endTime: "",
    duration: 60, passingMarks: 50, targetDepartment: "", targetSemester: "",
    shuffleQuestions: false, shuffleOptions: false,
    showResult: true, allowReview: false, negativeMarking: 0, maxAttempts: 1,
  });

  const [questions, setQuestions] = useState([defaultQuestion()]);

  const setD = (k, v) => setDetails(p => ({...p, [k]: v}));

  const addQuestion  = () => setQuestions(p => [...p, defaultQuestion()]);
  const removeQuestion = (i) => setQuestions(p => p.filter((_,idx) => idx !== i));
  const setQ = (i, k, v) => setQuestions(p => p.map((q,idx) => idx===i ? {...q, [k]: v} : q));
  const setQuestionType = (i, questionType) => {
    setQuestions(p => p.map((q, idx) => {
      if (idx !== i) return q;
      const nextType = normalizeQuestionType(questionType);
      return normalizeQuestionForSave({
        ...q,
        questionType: nextType,
        correctAnswer: nextType === "true_false" ? "True" : "A",
      });
    }));
  };
  const setOpt = (qi, oi, v) => setQuestions(p => p.map((q,idx) =>
    idx===qi ? {...q, options: q.options.map((o,oidx) => oidx===oi ? {...o, text: v} : o)} : q
  ));

  const handleSubmit = async (status = "draft") => {
    setLoading(true);
    try {
      const normalizedQuestions = questions.map(normalizeQuestionForSave);
      await api.post("/admin/exams", { ...details, questions: normalizedQuestions, status });
      toast.success(status === "published" ? "Exam published!" : "Exam saved as draft");
      navigate("/admin/exams");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 28 }}>
        <h2>Create New Exam</h2>
        <p>Build your exam in two steps — details then questions.</p>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {["Exam Details", "Questions"].map((s, i) => (
          <button key={s} onClick={() => i === 0 || step > 1 ? setStep(i+1) : null}
            style={{
              padding: "8px 20px", borderRadius: "var(--radius-md)", border: "none",
              background: step === i+1 ? "var(--accent)" : "var(--bg-elevated)",
              color: step === i+1 ? "#fff" : "var(--text-secondary)",
              fontFamily: "var(--font-display)", fontWeight: 600, cursor: "pointer",
              boxShadow: step === i+1 ? "0 0 16px var(--accent-glow)" : "none",
            }}>
            {i+1}. {s}
          </button>
        ))}
      </div>

      {/* ─── STEP 1: Exam Details ─── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h3 style={{ marginBottom: 20 }}>Basic Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Exam Title *</label>
                <input className="form-input" placeholder="e.g. Mid-Term Mathematics"
                  value={details.title} onChange={e => setD("title", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-input" placeholder="e.g. Mathematics"
                  value={details.subject} onChange={e => setD("subject", e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Brief description of this exam…"
                value={details.description} onChange={e => setD("description", e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 20 }}>📅 Schedule & Timing</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" className="form-input"
                  value={details.startDate} onChange={e => setD("startDate", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input type="date" className="form-input"
                  value={details.endDate} onChange={e => setD("endDate", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes) *</label>
                <input type="number" className="form-input" min={5}
                  value={details.duration} onChange={e => setD("duration", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Time *</label>
                <input type="time" className="form-input"
                  value={details.startTime} onChange={e => setD("startTime", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time *</label>
                <input type="time" className="form-input"
                  value={details.endTime} onChange={e => setD("endTime", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Attempts</label>
                <input type="number" className="form-input" min={1}
                  value={details.maxAttempts} onChange={e => setD("maxAttempts", +e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 20 }}>🎯 Marking & Access</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Passing Marks *</label>
                <input type="number" className="form-input" min={0}
                  value={details.passingMarks} onChange={e => setD("passingMarks", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Negative Marking</label>
                <input type="number" className="form-input" min={0} step={0.25}
                  value={details.negativeMarking} onChange={e => setD("negativeMarking", +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Department</label>
                <select className="form-select" value={details.targetDepartment} onChange={e => setD("targetDepartment", e.target.value)}>
                  <option value="">All Departments</option>
                  {["Computer Science","Electronics","Mechanical","Civil","Mathematics"].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Semester</label>
                <select className="form-select" value={details.targetSemester} onChange={e => setD("targetSemester", +e.target.value)}>
                  <option value="">All Semesters</option>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 20 }}>⚙️ Exam Settings</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["shuffleQuestions","Shuffle Questions"],
                ["shuffleOptions",  "Shuffle Options"],
                ["showResult",      "Show Result Immediately"],
                ["allowReview",     "Allow Answer Review"],
              ].map(([key, label]) => (
                <label key={key} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  border: `1px solid ${details[key] ? "var(--accent)" : "var(--border)"}`,
                }}>
                  <input type="checkbox" checked={details[key]} onChange={e => setD(key, e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: "0.9rem" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => setStep(2)}
              disabled={!details.title || !details.subject || !details.startDate}>
              Next: Add Questions →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Questions ─── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.map((q, qi) => {
            const questionType = normalizeQuestionType(q.questionType);
            const options = ensureMcqOptions(q.options || []);

            return (
            <div key={qi} className="card" style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ color: "var(--accent-light)" }}>Question {qi + 1}</h3>
                {questions.length > 1 && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(qi)}>✕ Remove</button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group" style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Question Text *</label>
                  <MathEditor
                    value={q.questionText}
                    onChange={value => setQ(qi, "questionText", value)}
                    placeholder="Enter your question here…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Question Type</label>
                  <select className="form-select" value={questionType} onChange={e => setQuestionType(qi, e.target.value)}>
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Marks</label>
                  <input type="number" className="form-input" min={1}
                    value={q.marks} onChange={e => setQ(qi, "marks", +e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correct Answer</label>
                  {questionType === "mcq" ? (
                    <select className="form-select" value={q.correctAnswer} onChange={e => setQ(qi, "correctAnswer", e.target.value)}>
                      {options.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </select>
                  ) : (
                    <select className="form-select" value={q.correctAnswer} onChange={e => setQ(qi, "correctAnswer", e.target.value)}>
                      <option value="True">True</option>
                      <option value="False">False</option>
                    </select>
                  )}
                </div>
              </div>

              {questionType === "mcq" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {options.map((o, oi) => (
                    <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: q.correctAnswer === o.label ? "var(--success-bg)" : "var(--bg-elevated)",
                        color: q.correctAnswer === o.label ? "var(--success)" : "var(--text-muted)",
                        border: `1px solid ${q.correctAnswer === o.label ? "var(--success)" : "var(--border)"}`,
                        fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
                      }}>{o.label}</span>
                      <input className="form-input" placeholder={`Option ${o.label}`}
                        style={{ minWidth: 0, padding: "10px 12px" }}
                        value={o.text} onChange={e => setOpt(qi, oi, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Explanation (optional)</label>
                <input className="form-input" placeholder="Shown after result…"
                  value={q.explanation} onChange={e => setQ(qi, "explanation", e.target.value)} />
              </div>
            </div>
            );
          })}

          <button className="btn btn-secondary" onClick={addQuestion} style={{ alignSelf: "flex-start" }}>
            + Add Question
          </button>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-secondary" onClick={() => handleSubmit("draft")} disabled={loading}>
              💾 Save Draft
            </button>
            <button className="btn btn-primary" onClick={() => handleSubmit("published")} disabled={loading}>
              🚀 Publish Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
