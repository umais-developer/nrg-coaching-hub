import { Navigate, Route, Routes } from "react-router-dom";
import AppNav from "./components/AppNav";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import CoachNotesPage from "./pages/CoachNotesPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import UploadsPage from "./pages/UploadsPage";
import RosterPage from "./pages/RosterPage";
import WorkshopsPage from "./pages/WorkshopsPage";
import ToolsSetupPage from "./pages/ToolsSetupPage";

export default function App() {
  return (
    <main className="container py-3 py-md-4 page-shell">
      <AppNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
