import { useNavigate } from 'react-router-dom';
import { useSubjects } from '../hooks/useSubjects';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import SubjectCard from '../components/SubjectCard';

export default function StudentSubjects() {
  const { subjects, loading } = useSubjects();
  const navigate = useNavigate();

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h2 className="page-title">My Subjects</h2>
        <p className="text-sm text-slate-500 mt-1">Access your courses and study materials</p>
      </div>

      {!subjects.length ? (
        <EmptyState
          title="No subjects available"
          description="Your teachers haven't created any subjects yet."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(sub => (
            <SubjectCard
              key={sub.id}
              subject={sub}
              onClick={() => navigate(`/student/subjects/${sub.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
