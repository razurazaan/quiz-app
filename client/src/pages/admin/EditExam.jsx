import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";
import MathEditor from "../../components/common/MathEditor.jsx";

const MCQ_LABELS = ["A", "B", "C", "D"];
const createMcqOptions = () => MCQ_LABELS.map(label => ({ label, text: "" }));
const normalizeQuestionType = (type) => type === "true_false" ? "true_false" : "mcq";
const stripMarkup = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const ensureMcqOptions = (options = [], fallbackAnswer = "") => MCQ_LABELS.map((label, index) => {
  const existing = options.find(option => option.label === label);
  const fallbackText = index === 0 ? stripMarkup(fallbackAnswer) : "";
  return { label, text: existing?.text || fallbackText };
});
const normalizeQuestion = (question) => {
  const wasShortAnswer = question.questionType === "short_answer";
  const questionType = normalizeQuestionType(question.questionType);
  const options = ensureMcqOptions(question.options || [], wasShortAnswer ? question.correctAnswer : "");

  return {
    ...question,
    questionType,
    options,
    correctAnswer: questionType === "true_false"
      ? (question.correctAnswer === "False" ? "False" : "True")
      : (MCQ_LABELS.includes(question.correctAnswer) ? question.correctAnswer : "A"),
  };
};

export default function EditExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState("details");

  useEffect(() => {
    api.get(`/admin/exams/${id}`)
      .then(r => setExam({
        ...r.data.exam,
        questions: (r.data.exam.questions || []).map(normalizeQuestion),
      }))
      .catch(() => { toast.error("Exam not found"); navigate("/admin/exams"); })
      .finally(() => setLoading(false));
  }, [id]);

  const setD   = (k, v) => setExam(p => ({...p, [k]: v}));
  const setQ   = (qi, k, v) => setExam(p => ({ ...p, questions: p.questions.map((q,i) => i===qi ? {...q,[k]:v} : q) }));
  const setQuestionType = (qi, questionType) => setExam(p => ({
    ...p,
    questions: p.questions.map((q, i) => {
      if (i !== qi) return q;
      const nextType = normalizeQuestionType(questionType);
      return normalizeQuestion({
        ...q,
        questionType: nextType,
        correctAnswer: nextType === "true_false" ? "True" : "A",
      });
    }),
  }));
  const setOpt = (qi, oi, v) => setExam(p => ({
    ...p, questions: p.questions.map((q,i) => i!==qi ? q : {
      ...q, options: q.options.map((o,j) => j===oi ? {...o, text: v} : o)
    })
  }));
  const addQuestion = () => setExam(p => ({
    ...p, questions: [...p.questions, {
      questionText:"", questionType:"mcq", marks:1,
      options:createMcqOptions(),
      correctAnswer:"A", explanation:""
    }]
  }));
  const removeQuestion = (qi) => setExam(p => ({...p, questions: p.questions.filter((_,i) => i!==qi)}));

  const handleSave = async (status) => {
    setSaving(true);
    try {
      const normalizedExam = {
        ...exam,
        questions: (exam.questions || []).map(normalizeQuestion),
        status: status || exam.status,
      };
      await api.put(`/admin/exams/${id}`, normalizedExam);
      toast.success("Exam updated!");
      navigate("/admin/exams");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!exam)   return null;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h2>Edit Exam</h2>
        <p style={{ marginTop: 4 }}>Update details for <strong style={{ color:"var(--accent-light)" }}>{exam.title}</strong></p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {[["details","📋 Exam Details"],["questions","❓ Questions"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`btn btn-sm ${tab===key ? "btn-primary" : "btn-secondary"}`}>
            {label} {key==="questions" ? `(${exam.questions.length})` : ""}
          </button>
        ))}
      </div>

      {/* ─── DETAILS TAB ─── */}
      {tab === "details" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div className="card">
            <h3 style={{ marginBottom:18 }}>Basic Info</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Exam Title</label>
                <input className="form-input" value={exam.title} onChange={e => setD("title", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={exam.subject} onChange={e => setD("subject", e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn:"1/-1" }}>
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={exam.description || ""} onChange={e => setD("description", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom:18 }}>📅 Schedule</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
              {[
                ["startDate","Start Date","date"],
                ["endDate","End Date","date"],
                ["duration","Duration (min)","number"],
                ["startTime","Start Time","time"],
                ["endTime","End Time","time"],
                ["maxAttempts","Max Attempts","number"],
              ].map(([key, label, type]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input type={type} className="form-input"
                    value={type==="date" ? (exam[key] ? exam[key].slice(0,10) : "") : exam[key] || ""}
                    onChange={e => setD(key, type==="number" ? +e.target.value : e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom:18 }}>🎯 Marking</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
              {[["passingMarks","Passing Marks"],["negativeMarking","Negative Marking"]].map(([key, label]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input type="number" className="form-input" min={0} step={0.25}
                    value={exam[key]} onChange={e => setD(key, +e.target.value)} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Target Department</label>
                <select className="form-select" value={exam.targetDepartment || ""} onChange={e => setD("targetDepartment", e.target.value)}>
                  <option value="">All</option>
                  {["Computer Science","Electronics","Mechanical","Civil","Mathematics"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom:18 }}>⚙️ Settings</h3>
            <div className="grid-2">
              {[["shuffleQuestions","Shuffle Questions"],["shuffleOptions","Shuffle Options"],["showResult","Show Result Immediately"],["allowReview","Allow Answer Review"]].map(([key, label]) => (
                <label key={key} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"14px 16px",
                  background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", cursor:"pointer",
                  border:`1px solid ${exam[key] ? "var(--accent)" : "var(--border)"}`,
                }}>
                  <input type="checkbox" checked={!!exam[key]} onChange={e => setD(key, e.target.checked)}
                    style={{ width:18, height:18, accentColor:"var(--accent)" }} />
                  <span style={{ fontSize:"0.9rem" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── QUESTIONS TAB ─── */}
      {tab === "questions" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {exam.questions.map((q, qi) => {
            const questionType = normalizeQuestionType(q.questionType);
            const options = ensureMcqOptions(q.options || []);

            return (
            <div key={qi} className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ color:"var(--accent-light)" }}>Q{qi+1}</h3>
                {exam.questions.length > 1 && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(qi)}>✕ Remove</button>
                )}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:14, marginBottom:14 }}>

                {/* ── Question Text ── */}
                <div className="form-group" style={{ gridColumn:"1/-1" }}>
                  <label className="form-label">Question Text</label>
                  <MathEditor
                    value={q.questionText}
                    onChange={value => setQ(qi, "questionText", value)}
                    placeholder="Enter your question here…"
                  />
                </div>

                {/* ── Type ── */}
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={questionType} onChange={e => setQuestionType(qi, e.target.value)}>
                    <option value="mcq">MCQ</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>

                {/* ── Marks ── */}
                <div className="form-group">
                  <label className="form-label">Marks</label>
                  <input type="number" className="form-input" min={1} value={q.marks}
                    onChange={e => setQ(qi,"marks",+e.target.value)} />
                </div>

                {/* ── Correct Answer ── */}
                <div className="form-group">
                  <label className="form-label">Correct Answer</label>
                  {questionType === "mcq" ? (
                    <select className="form-select" value={q.correctAnswer} onChange={e => setQ(qi,"correctAnswer",e.target.value)}>
                      {options.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </select>
                  ) : (
                    <select className="form-select" value={q.correctAnswer} onChange={e => setQ(qi,"correctAnswer",e.target.value)}>
                      <option value="True">True</option><option value="False">False</option>
                    </select>
                  )}
                </div>
              </div>

              {/* ── MCQ Options ── */}
              {questionType === "mcq" && (
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                  {options.map((o, oi) => (
                    <div key={o.label} style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      <span style={{
                        width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                        background: q.correctAnswer===o.label ? "var(--success-bg)" : "var(--bg-elevated)",
                        color: q.correctAnswer===o.label ? "var(--success)" : "var(--text-muted)",
                        border:`1px solid ${q.correctAnswer===o.label ? "var(--success)" : "var(--border)"}`,
                        fontWeight:700, fontSize:"0.8rem", flexShrink:0,
                      }}>{o.label}</span>
                      <input className="form-input" placeholder={`Option ${o.label}`}
                        style={{ minWidth:0, padding:"10px 12px" }}
                        value={o.text} onChange={e => setOpt(qi, oi, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Explanation (optional)</label>
                <input className="form-input" value={q.explanation||""} placeholder="Shown after result…"
                  onChange={e => setQ(qi,"explanation",e.target.value)} />
              </div>
            </div>
            );
          })}
          <button className="btn btn-secondary" style={{ alignSelf:"flex-start" }} onClick={addQuestion}>
            + Add Question
          </button>
        </div>
      )}

      {/* Save bar */}
      <div style={{ display:"flex", gap:12, justifyContent:"flex-end", marginTop:28, paddingTop:20, borderTop:"1px solid var(--border)" }}>
        <button className="btn btn-secondary" onClick={() => navigate("/admin/exams")}>Cancel</button>
        <button className="btn btn-secondary" onClick={() => handleSave("draft")} disabled={saving}>💾 Save Draft</button>
        <button className="btn btn-primary" onClick={() => handleSave("published")} disabled={saving}>
          {saving ? "Saving…" : "🚀 Save & Publish"}
        </button>
      </div>
    </div>
  );
}
