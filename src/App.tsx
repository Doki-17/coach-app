import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProgramEditor from './pages/ProgramEditor';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:clientId" element={<ProgramEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;