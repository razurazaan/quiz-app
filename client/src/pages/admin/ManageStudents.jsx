import { useState, useEffect } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import { formatDate, getInitials } from "../../utils/helpers";

export default function ManageStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState("");

  const load = () => {
    api.get("/admin/students").then(r => setStudents(r.data.students)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleStatus = async (id) => {
    await api.put(`/admin/students/${id}/toggle`);
    toast.success("Status updated");
    load();
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.studentId || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h2>Manage Students</h2>
          <p>{students.length} registered student{students.length !== 1 ? "s" : ""}</p>
        </div>
        <input className="form-input" placeholder="🔍 Search by name, email, ID…"
          style={{ width: 260 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loader-center"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Joined</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No students found</td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: "var(--accent-glow)", border: "1px solid var(--accent)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.75rem", color: "var(--accent-light)",
                        }}>{getInitials(s.name)}</div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>{s.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{s.studentId || "—"}</td>
                    <td>{s.department || "—"}</td>
                    <td>{s.semester ? `Sem ${s.semester}` : "—"}</td>
                    <td>{formatDate(s.createdAt)}</td>
                    <td>{s.lastLogin ? formatDate(s.lastLogin) : "Never"}</td>
                    <td>
                      <span className={`badge ${s.isActive ? "badge-success" : "badge-danger"}`}>
                        {s.isActive ? "Active" : "Blocked"}
                      </span>
                    </td>
                    <td>
                      <button className={`btn btn-sm ${s.isActive ? "btn-danger" : "btn-success"}`}
                        onClick={() => toggleStatus(s._id)}>
                        {s.isActive ? "Block" : "Unblock"}
                      </button>
                    </td>
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
