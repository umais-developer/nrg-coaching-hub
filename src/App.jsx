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
import EditTeamPage from "./pages/EditTeamPage";
import AddMemberPage from "./pages/AddMemberPage";
import EditMemberPage from "./pages/EditMemberPage";
import CohortsPage from "./pages/CohortsPage";
import ExportsPage from "./pages/ExportsPage";
import AdminPage from "./pages/AdminPage";
import QuizzesPage from "./pages/QuizzesPage";
import QuizEditorPage from "./pages/QuizEditorPage";
import QuizAssignPage from "./pages/QuizAssignPage";

export default function App() {
  return (
    <AuthProvider>
    <TeamsProvider>
    <main className="container py-3 py-md-4 page-shell">
      <AppNav />
      <Routes>
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth-callback" element={<LoginPage />} />
        <Route path="/tools-setup" element={<ToolsSetupPage />} />
        <Route path="/team-roster" element={<ProtectedRoute><RosterPage /></ProtectedRoute>} />
        <Route path="/workshops" element={<ProtectedRoute><WorkshopsPage /></ProtectedRoute>} />
        <Route
          path="/coach-notes"
          element={
            <ProtectedRoute capability="writeNotes">
              <CoachNotesPage />
            </ProtectedRoute>
          }
        />
        {/* Members reach /discussions too — the page itself narrows them to
            notes about themselves that were explicitly shared */}
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
            <ProtectedRoute capability="uploadOwnFiles">
              <UploadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-team"
          element={
            <ProtectedRoute capability="manageTeams">
              <AddTeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-team"
          element={
            <ProtectedRoute capability="manageTeams">
              <EditTeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cohorts"
          element={
            <ProtectedRoute capability="manageCohorts">
              <CohortsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-member"
          element={
            <ProtectedRoute capability="manageMembers">
              <AddMemberPage />
            </ProtectedRoute>
          }
        />
        {/* Open to members: the page forces a member to their own record and
            restricts which fields they may change */}
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
            <ProtectedRoute capability="exportData">
              <ExportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute capability="manageUsers">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes"
          element={
            <ProtectedRoute capability="manageQuizzes">
              <QuizzesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes/new"
          element={
            <ProtectedRoute capability="manageQuizzes">
              <QuizEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes/edit/:slug"
          element={
            <ProtectedRoute capability="manageQuizzes">
              <QuizEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes/assign"
          element={
            <ProtectedRoute capability="manageQuizzes">
              <QuizAssignPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/tools-setup" replace />} />
      </Routes>
      <footer className="app-footer">
        <span className="app-footer-text">DLP Program · Coaching Workspace</span>
        <span className="app-footer-text">&copy; {new Date().getFullYear()}</span>
      </footer>
    </main>
    </TeamsProvider>
    </AuthProvider>
  );
}
