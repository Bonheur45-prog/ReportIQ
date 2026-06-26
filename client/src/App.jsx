import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login      from './pages/Login';
import UploadPage from './pages/UploadPage';
import Register   from './pages/Register';
import Dashboard  from './pages/Dashboard';
import Sites      from './pages/Sites';
import Generate   from './pages/Generate';
import Reports    from './pages/Reports';
import Settings   from './pages/Settings';
import { Spinner } from './components/UI';
import styles from './App.module.css';

// ── Protected layout — requires auth ─────────────────────────────────────────
function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className={styles.appLayout}>
      <Sidebar />
      <main className={styles.main}>
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sites"     element={<Sites />} />
          <Route path="generate"  element={<Generate />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="settings"  element={<Settings />} />
          <Route path="*"         element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Public route — redirect to dashboard if already logged in ─────────────────
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/upload/:token" element={<UploadPage />} />
        <Route path="/*"        element={<AppLayout />} />
      </Routes>
    </AuthProvider>
  );
}
