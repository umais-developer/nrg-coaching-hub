import { Navigate, Route, Routes } from "react-router-dom";
import AppNav from "./components/AppNav";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { TeamsProvider } from "./contexts/TeamsContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import CoachNotesPage from "./pages/CoachNotesPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import UploadsPage from "./pages/UploadsPage";
import RosterPage from "./pages/RosterPage";
import WorkshopsPage from "./pages/WorkshopsPage";
import ToolsSetupPage from "./pages/ToolsSetupPage";
import AddTeamPage from "./pages/AddTeamPage";
import AddMemberPage from "./pages/AddMemberPage";
import EditMemberPage from "./pages/EditMemberPage";
import ExportsPage from "./pages/ExportsPage";

export default function App() {
  return (
    <AuthProvider>
    <TeamsProvider>
    <main className="container py-3 py-md-4 page-shell">
      <AppNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth-callback" element={<LoginPage />} />
        <Route path="/tools-setup" element={<ToolsSetupPage />} />
        <Route path="/team-roster" element={<RosterPage />} />
        <Route path="/workshops" element={<WorkshopsPage />} />
        <Route
          path="/coach-notes"
          element={
            <ProtectedRoute>
              <CoachNotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/discussions"
          element={
            <ProtectedRoute>
              <DiscussionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/uploads"
          element={
            <ProtectedRoute>
              <UploadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-team"
          element={
            <ProtectedRoute>
              <AddTeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-member"
          element={
            <ProtectedRoute>
              <AddMemberPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-member"
          element={
            <ProtectedRoute>
              <EditMemberPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exports"
          element={
            <ProtectedRoute>
              <ExportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="app-footer">
        <span className="app-footer-text">NRG DLP Program · Pod 1A-US Coaching Workspace</span>
        <span className="app-footer-text">&copy; {new Date().getFullYear()}</span>
      </footer>
    </main>
    </TeamsProvider>
    </AuthProvider>
  );
}
