import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ClientProgramView from './pages/ClientProgramView';
import ProgramEditor, { type ProgramEditorMode } from './pages/ProgramEditor';
import ErrorBoundary from './components/ErrorBoundary';

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

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50 text-gray-900">
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
      </Router>
    </ErrorBoundary>
  );
}

export default App;
