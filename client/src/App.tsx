import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';

// Pages
import Landing from './pages/Landing';
import TeacherSubjects from './pages/TeacherSubjects';
import TeacherSubjectDetail from './pages/TeacherSubjectDetail';
import TeacherResourceDetail from './pages/TeacherResourceDetail';
import StudentSubjects from './pages/StudentSubjects';
import StudentSubjectDetail from './pages/StudentSubjectDetail';
import StudentSearch from './pages/StudentSearch';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Teacher Portal */}
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<Navigate to="subjects" replace />} />
          <Route path="subjects" element={<TeacherSubjects />} />
          <Route path="subjects/:subjectId" element={<TeacherSubjectDetail />} />
          <Route path="resources/:resourceId" element={<TeacherResourceDetail />} />
        </Route>

        {/* Student Portal */}
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="subjects" replace />} />
          <Route path="subjects" element={<StudentSubjects />} />
          <Route path="subjects/:subjectId" element={<StudentSubjectDetail />} />
          <Route path="search" element={<StudentSearch />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
