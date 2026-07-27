import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import TeacherLayout from './layouts/TeacherLayout';

// New Pages
import SubjectDashboard from './pages/SubjectDashboard';
import SubjectWorkspace from './pages/SubjectWorkspace';
import ModuleNotes from './pages/ModuleNotes';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/subjects" replace />} />

        {/* Workspace Portal */}
        <Route element={<TeacherLayout />}>
          <Route path="/subjects" element={<SubjectDashboard />} />
          <Route path="/subjects/:subjectId" element={<SubjectWorkspace />} />
          <Route path="/subjects/:subjectId/module/:moduleNum" element={<ModuleNotes />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/subjects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
