import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './features/coach/pages/Dashboard';
import ProgramEditor, { type ProgramEditorMode } from './features/coach/pages/ProgramEditor';
import ClientProgramView from './features/client/pages/ClientProgramView';
import ClientHome from './features/client/pages/ClientHome';
import Login from './pages/Login';
import InvitePage from './pages/InvitePage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import RouteProgressBar from './components/RouteProgressBar';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { getRole, logout } from './lib/auth';

function ClientProgramViewRoute() {
  const { clientId } = useParams();
  // Remount whenever the client changes so its local state reinitializes from storage.
  return <ClientProgramView key={clientId} />;
}

function ProgramEditorRoute({ mode }: { mode: ProgramEditorMode }) {
  const { clientId } = useParams();
  // Remount whenever the client or mode changes so the editor's local state
  // (title/weeks/categories) reinitializes correctly - "new" always starts blank,
  // "edit" always starts from the client's saved current program.
  return <ProgramEditor key={`${clientId}-${mode}`} mode={mode} />;
}

/**
 * Small fixed control so whoever's "logged in" (see lib/auth.ts) can get
 * back to /login. Anchored bottom-left (mirroring ThemeToggle's
 * bottom-right) rather than a top corner, so it never sits on top of a
 * page's own header buttons (Back / Export / etc.), which live right at
 * the top of the content on every page, especially on mobile. Hidden on
 * the login page and for a client on their own program page (that page has
 * its own logout button up top - see ClientProgramView). For a coach, shown
 * only on the main dashboard - Dashboard has the only coach-facing logout
 * button now, so a coach browsing a client's page or the program editor
 * doesn't see a stray floating "Log out" with no relation to what's on
 * screen; they head back to the dashboard first, same as any other page
 * that isn't itself directly logout-able.
 */
function LogoutControl() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();

  const onOwnClientPage = role === 'client' && location.pathname.startsWith('/client/');
  const coachOffDashboard = role === 'coach' && location.pathname !== '/';
  if (!role || location.pathname === '/login' || onOwnClientPage || coachOffDashboard) return null;

  return (
    <button
      onClick={async () => {
        await logout();
        navigate('/login', { replace: true });
      }}
      className="fixed bottom-4 left-4 z-30 text-xs px-3 py-1.5 rounded-full shadow-lg border transition-colors bg-off-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      Log out
    </button>
  );
}

/**
 * Renders the route table plus a couple of small touches so navigating
 * between pages doesn't feel instant/flat: a brief progress-bar sweep, a
 * fade/rise on the newly-mounted page's content, and resetting scroll back
 * to the top (smoothly, via the global `scroll-behavior` in index.css) on
 * every navigation.
 */
function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <>
      <RouteProgressBar pathname={location.pathname} />
      {/* Keying on the path forces a remount on every navigation, which is what
          replays the .page-transition CSS animation each time. */}
      <div key={location.pathname} className="page-transition">
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public - a client's personal sign-up/sign-in link, not gated by ProtectedRoute. See pages/InvitePage.tsx. */}
          <Route path="/invite/:token" element={<InvitePage />} />

          {/* Coach interface (src/features/coach) */}
          <Route
            path="/"
            element={
              <ProtectedRoute allow={['coach']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/edit"
            element={
              <ProtectedRoute allow={['coach']}>
                <ProgramEditorRoute mode="edit" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/new"
            element={
              <ProtectedRoute allow={['coach']}>
                <ProgramEditorRoute mode="new" />
              </ProtectedRoute>
            }
          />

          {/* Client interface (src/features/client) */}
          <Route
            path="/client-home"
            element={
              <ProtectedRoute allow={['client']}>
                <ClientHome />
              </ProtectedRoute>
            }
          />
          {/* A coach also opens this route (to preview a client's program), so both roles are allowed here. */}
          <Route
            path="/client/:clientId"
            element={
              <ProtectedRoute allow={['coach', 'client']}>
                <ClientProgramViewRoute />
              </ProtectedRoute>
            }
          />

          {/* Anything else (including old bookmarked URLs like /editor/:id from before
              this app's routes were reorganized) falls back to the Dashboard instead of
              rendering a blank page. If that's not logged in either, ProtectedRoute bounces
              it on to /login. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors">
          <AppRoutes />
          <LogoutControl />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
