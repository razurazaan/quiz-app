import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "student",
    studentId: "", department: "", semester: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm(p => ({...p, [k]: v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Build payload — omit empty strings and student-only fields for admins.
      // Sending studentId:"" triggers a MongoDB duplicate-key error on the
      // sparse unique index when multiple admins (or students without IDs) register.
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.role === "student") {
        if (form.studentId.trim())  payload.studentId  = form.studentId.trim();
        if (form.department)        payload.department = form.department;
        if (form.semester)          payload.semester   = form.semester;
      }
      await api.post("/auth/register", payload);
      toast.success("Account created! Please login.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", padding: "24px",
      backgroundImage: "radial-gradient(ellipse at 80% 50%, rgba(124,106,247,0.07) 0%, transparent 60%)",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }} className="animate-fade">
        <div className="text-center" style={{ marginBottom: 32 }}>
          <h1>Create Account</h1>
          <p style={{ marginTop: 4 }}>Join QuizMaster Pro</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => set("role", e.target.value)}>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="John Doe"
                  value={form.name} onChange={e => set("name", e.target.value)} required />
              </div>
              {form.role === "student" && (
                <div className="form-group">
                  <label className="form-label">Student ID</label>
                  <input className="form-input" placeholder="STU2024001"
                    value={form.studentId} onChange={e => set("studentId", e.target.value)} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={e => set("email", e.target.value)} required />
            </div>

            {form.role === "student" && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={form.department} onChange={e => set("department", e.target.value)}>
                    <option value="">Select</option>
                    {["Computer Science","Electronics","Mechanical","Civil","Mathematics"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select className="form-select" value={form.semester} onChange={e => set("semester", e.target.value)}>
                    <option value="">Select</option>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Min 6 characters"
                value={form.password} onChange={e => set("password", e.target.value)} required minLength={6} />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}
              style={{ padding: "13px", fontSize: "1rem" }}>
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>

          <div className="text-center" style={{ marginTop: 20, fontSize: "0.88rem", color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--accent-light)" }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}