import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import SubjectCard from '../components/SubjectCard';
import { resourceTypeIcon, formatBytes, hexToRgba } from '../utils';
import { RESOURCE_TYPE_LABELS } from '../types';

export default function StudentSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') || '';
  const { results, loading, doSearch } = useSearch();

  useEffect(() => {
    if (q) doSearch(q);
  }, [q, doSearch]);

  if (!q) {
    return (
      <EmptyState
        icon="🔍"
        title="Search"
        description="Type in the search bar above to find subjects, resources, and materials."
      />
    );
  }

  if (loading) return <PageLoader />;

  if (results?.subjects.length === 0 && results?.resources.length === 0) {
    return (
      <EmptyState
        icon="🍃"
        title="No results found"
        description={`We couldn't find anything matching "${q}".`}
      />
    );
  }

  return (
    <div className="animate-fadeIn space-y-10">
      <div className="mb-2">
        <h2 className="page-title">Search Results</h2>
        <p className="text-slate-500 text-sm mt-1">Showing matches for "{q}"</p>
      </div>

      {results?.subjects && results.subjects.length > 0 && (
        <section>
          <h3 className="section-title">Subjects</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.subjects.map(sub => (
              <SubjectCard
                key={sub.id}
                subject={sub}
                onClick={() => navigate(`/student/subjects/${sub.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {results?.resources && results.resources.length > 0 && (
        <section>
          <h3 className="section-title">Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.resources.map(r => (
              <div
                key={r.id}
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer flex gap-4"
                onClick={() => navigate(`/student/subjects/${r.subjectId}`)}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                  style={{
                    color: r.subjectColor,
                    backgroundColor: hexToRgba(r.subjectColor, 0.1),
                  }}
                >
                  {resourceTypeIcon(r.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-slate-900 truncate">{r.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 flex gap-2 items-center">
                    <span
                      className="font-medium truncate max-w-[120px]"
                      style={{ color: r.subjectColor }}
                    >
                      {r.subjectName}
                    </span>
                    <span>•</span>
                    <span>{RESOURCE_TYPE_LABELS[r.type]}</span>
                    {r.type !== 'flashcard-deck' && (
                      <>
                        <span>•</span>
                        <span>{formatBytes(r.fileSize)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
