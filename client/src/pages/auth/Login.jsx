import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === "admin" ? "/admin" : "/student");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", padding: "24px",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(124,106,247,0.08) 0%, transparent 60%)",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }} className="animate-fade">
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{ fontSize: "3rem", marginBottom: 8 }}>📝</div>
          <h1 style={{ fontSize: "2rem" }}>
            Quiz<span style={{ color: "var(--accent)" }}>Master</span> Pro
          </h1>
          <p style={{ marginTop: 4, fontSize: "0.9rem" }}>Sign in to your account</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                required autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password" className="form-input" placeholder="••••••••"
                value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}
              style={{ marginTop: 4, padding: "13px", fontSize: "1rem" }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <div className="text-center" style={{ marginTop: 20, fontSize: "0.88rem", color: "var(--text-muted)" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "var(--accent-light)" }}>Register</Link>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="card" style={{ marginTop: 16, padding: 16, background: "var(--bg-elevated)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Demo Credentials
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--accent-light)" }}>Admin:</strong> admin@quiz.com / admin123
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--success)" }}>Student:</strong> student@quiz.com / student123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
