import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useResources } from '../hooks/useResources';
import { getSubject } from '../api/subjects';
import type { Subject, Resource } from '../types';
import { formatBytes, formatDate, resourceTypeIcon } from '../utils';
import { RESOURCE_TYPE_LABELS } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import FileViewer from '../components/FileViewer';
import FlashcardDeckWrapper from './FlashcardDeckWrapper';

export default function StudentSubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const { resources, loading } = useResources(subjectId);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (subjectId) getSubject(subjectId).then(setSubject).catch(() => navigate('/student/subjects'));
  }, [subjectId, navigate]);

  if (!subject || loading) return <PageLoader />;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] animate-fadeIn">
      {/* Sidebar list */}
      <div className="w-full lg:w-80 flex flex-col shrink-0">
        <div className="card h-full flex flex-col overflow-hidden border-slate-200">
          {/* Subject Header */}
          <div className="p-4 border-b border-slate-200" style={{ backgroundColor: subject.color }}>
            <div className="flex items-center gap-3 text-white">
              <span className="text-2xl">{subject.icon}</span>
              <div>
                <h1 className="font-bold tracking-tight line-clamp-1">{subject.name}</h1>
                <p className="text-white/80 text-xs">{resources.length} resource(s)</p>
              </div>
            </div>
          </div>

          {/* Resources List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50">
            {resources.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No resources available.</div>
            ) : (
              resources.map(r => {
                const isActive = activeResource?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveResource(r)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all
                      ${isActive
                        ? 'bg-white shadow-sm ring-1 ring-indigo-100 text-indigo-700'
                        : 'hover:bg-white text-slate-700 hover:text-slate-900'}`}
                  >
                    <span className="text-xl shrink-0">{resourceTypeIcon(r.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : ''}`}>
                        {r.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex gap-2">
                        <span>{RESOURCE_TYPE_LABELS[r.type]}</span>
                        {r.type !== 'flashcard-deck' && <span>• {formatBytes(r.fileSize)}</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 card bg-white flex flex-col overflow-hidden relative">
        {!activeResource ? (
          <EmptyState
            icon="👈"
            title="Select a resource"
            description="Choose a file or flashcard deck from the list to view it here."
          />
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 z-10">
              <h3 className="font-bold text-slate-900 truncate pr-4">{activeResource.title}</h3>
              <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                Added {formatDate(activeResource.uploadedAt)}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeResource.type === 'flashcard-deck' ? (
                <FlashcardDeckWrapper resourceId={activeResource.id} />
              ) : (
                <FileViewer resource={activeResource} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
