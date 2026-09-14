import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ClientProgramView from './pages/ClientProgramView';
import ProgramEditor, { type ProgramEditorMode } from './pages/ProgramEditor';
import ErrorBoundary from './components/ErrorBoundary';
import RouteProgressBar from './components/RouteProgressBar';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/client/:clientId" element={<ClientProgramViewRoute />} />
          <Route path="/client/:clientId/edit" element={<ProgramEditorRoute mode="edit" />} />
          <Route path="/client/:clientId/new" element={<ProgramEditorRoute mode="new" />} />
          {/* Anything else (including old bookmarked URLs like /editor/:id from before
              this app's routes were reorganized) falls back to the Dashboard instead of
              rendering a blank page. */}
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
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
