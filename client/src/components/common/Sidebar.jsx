import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getInitials } from "../../utils/helpers";

const adminLinks = [
  { to: "/admin",          icon: "⬡", label: "Dashboard" },
  { to: "/admin/exams",    icon: "📋", label: "Manage Exams" },
  { to: "/admin/create-exam", icon: "✚", label: "Create Exam" },
  { to: "/admin/students", icon: "👥", label: "Students" },
  { to: "/admin/results",  icon: "📊", label: "Results" },
];

const studentLinks = [
  { to: "/student",        icon: "⬡", label: "Dashboard" },
  { to: "/student/exams",  icon: "📝", label: "Available Exams" },
  { to: "/student/results",icon: "🏆", label: "My Results" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === "admin" ? adminLinks : studentLinks;

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <aside style={{
      width: 240, background: "var(--bg-secondary)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "24px 16px",
      position: "sticky", top: 0, height: "100vh", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Quiz<span style={{ color: "var(--accent)" }}>Master</span>
        </span>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {user?.role === "admin" ? "Admin Panel" : "Student Portal"}
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {links.map(link => (
          <NavLink key={link.to} to={link.to} end={link.to === "/admin" || link.to === "/student"}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              fontSize: "0.9rem", fontWeight: 500, textDecoration: "none",
              color: isActive ? "var(--accent-light)" : "var(--text-secondary)",
              background: isActive ? "var(--accent-glow)" : "transparent",
              border: isActive ? "1px solid rgba(124,106,247,0.3)" : "1px solid transparent",
              transition: "all 0.15s",
            })}>
            <span style={{ fontSize: "1rem" }}>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--accent-glow)", border: "2px solid var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8rem", color: "var(--accent-light)",
          }}>
            {getInitials(user?.name)}
          </div>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</div>
            <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-secondary w-full btn-sm" onClick={handleLogout}>⎋ Logout</button>
      </div>
    </aside>
  );
}
