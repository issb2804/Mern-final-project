import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { ErrorState, PageLoader } from './components/ui';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Plan from './pages/Plan';
import Board from './pages/Board';
import CalendarPage from './pages/Calendar';
import Focus from './pages/Focus';
import Insights from './pages/Insights';
import SettingsPage from './pages/Settings';
import NotFound from './pages/NotFound';

function Protected({ children }) {
  const { user, loading, error, retry } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 pt-24">
        <ErrorState error={error} onRetry={retry} title="Can't reach Cadence" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="board" element={<Board />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="plan" element={<Plan />} />
        <Route path="focus" element={<Focus />} />
        <Route path="insights" element={<Insights />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
