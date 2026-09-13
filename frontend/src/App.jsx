import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRhCompaniesPage from "./pages/AdminRhCompaniesPage";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import DashboardPage from "./pages/DashboardPage";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import InternsPage from "./pages/InternsPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ReportsPageEnhanced from "./pages/ReportsPageEnhanced";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import StudentProgressPage from "./pages/StudentProgressPage";
import SupervisorProfilePage from "./pages/SupervisorProfilePage";
import TasksPage from "./pages/TasksPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import EnhancedDashboardPage from "./pages/EnhancedDashboardPage";
import MyProjectPage from "./pages/MyProjectPage";
import NotificationsPage from "./pages/NotificationsPage";
import SupervisorMyProjectsPage from "./pages/SupervisorMyProjectsPage";
import SupervisorAddInternPage from "./pages/SupervisorAddInternPage";
import SupervisorAssignInternPage from "./pages/SupervisorAssignInternPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminSupervisorsPage from "./pages/AdminSupervisorsPage";

const App = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    // when I tap the url and /app it leads me to login is token is expired or to /app-enhancedashboard, question : who handles this logic ?
    <Route
      path="/app"
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route index element={<RoleHomeRedirect />} />
      //admin Routes
      <Route
        path="dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/overview"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Navigate to="/app/admin/rh-companies" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/rh-companies"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminRhCompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/students"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminStudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/profile"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminProfilePage />
          </ProtectedRoute>
        }
      />
      //students Routes
      <Route
        path="student/profile"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="student/progress"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProgressPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="company/profile"
        element={
          <ProtectedRoute allowedRoles={["company"]}>
            <CompanyProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/supervisors"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSupervisorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/analytics"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Navigate to="/app/dashboard" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="supervisor/profile"
        element={
          <ProtectedRoute allowedRoles={["supervisor"]}>
            <SupervisorProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="supervisor/interns"
        element={
          <ProtectedRoute allowedRoles={["supervisor"]}>
            <InternsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="tasks"
        element={
          <ProtectedRoute allowedRoles={["student", "supervisor"]}>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="supervisor/my-projects"
        element={
          <ProtectedRoute allowedRoles={["supervisor"]}>
            <SupervisorMyProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="supervisor/add-intern"
        element={
          <ProtectedRoute allowedRoles={["supervisor"]}>
            <SupervisorAddInternPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="supervisor/assign-intern"
        element={
          <ProtectedRoute allowedRoles={["supervisor"]}>
            <SupervisorAssignInternPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="student/my-project"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <MyProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="student/add-intern"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <Navigate to="/app/student/my-project" replace />
          </ProtectedRoute>
        }
      />

            <Route
        path="notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="enhanced-dashboard"
        element={
          <ProtectedRoute>
            <EnhancedDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="reports"
        element={
          <ProtectedRoute allowedRoles={["student", "supervisor"]}>
            <ReportsPageEnhanced />
          </ProtectedRoute>
        }
      />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
