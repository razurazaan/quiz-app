import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute    from "./components/common/PrivateRoute";
import Sidebar         from "./components/common/Sidebar";

// Auth pages
import Login    from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Admin pages
import AdminDashboard  from "./pages/admin/Dashboard";
import CreateExam      from "./pages/admin/CreateExam";
import ManageExams     from "./pages/admin/ManageExams";
import EditExam        from "./pages/admin/EditExam";
import ManageStudents  from "./pages/admin/ManageStudents";
import ExamResults     from "./pages/admin/ExamResults";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import AvailableExams   from "./pages/student/AvailableExams";
import TakeExam         from "./pages/student/TakeExam";
import MyResults        from "./pages/student/MyResults";
import ResultDetail     from "./pages/student/ResultDetail";

// Layout wrapper for authenticated pages (shows sidebar)
function AppLayout({ children }) {
  return (
    <div className="page-wrapper">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin routes */}
        <Route path="/admin" element={
          <PrivateRoute role="admin">
            <AppLayout><AdminDashboard /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/exams" element={
          <PrivateRoute role="admin">
            <AppLayout><ManageExams /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/create-exam" element={
          <PrivateRoute role="admin">
            <AppLayout><CreateExam /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/exams/:id/edit" element={
          <PrivateRoute role="admin">
            <AppLayout><EditExam /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/exams/:id/results" element={
          <PrivateRoute role="admin">
            <AppLayout><ExamResults /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/students" element={
          <PrivateRoute role="admin">
            <AppLayout><ManageStudents /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/admin/results" element={
          <PrivateRoute role="admin">
            <AppLayout><ExamResults /></AppLayout>
          </PrivateRoute>
        }/>

        {/* Student routes */}
        <Route path="/student" element={
          <PrivateRoute role="student">
            <AppLayout><StudentDashboard /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/student/exams" element={
          <PrivateRoute role="student">
            <AppLayout><AvailableExams /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/student/exams/:id" element={
          <PrivateRoute role="student">
            {/* TakeExam is full-screen — no sidebar */}
            <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
              <TakeExam />
            </div>
          </PrivateRoute>
        }/>
        <Route path="/student/results" element={
          <PrivateRoute role="student">
            <AppLayout><MyResults /></AppLayout>
          </PrivateRoute>
        }/>
        <Route path="/student/results/:id" element={
          <PrivateRoute role="student">
            <AppLayout><ResultDetail /></AppLayout>
          </PrivateRoute>
        }/>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
