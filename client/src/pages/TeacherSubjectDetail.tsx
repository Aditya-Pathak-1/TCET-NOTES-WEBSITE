import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResources } from '../hooks/useResources';
import { getSubject } from '../api/subjects';
import type { Subject, ResourceType } from '../types';
import { formatBytes, formatDate, resourceTypeIcon, hexToRgba } from '../utils';
import { RESOURCE_TYPE_LABELS } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import FileUploader, { inferResourceType } from '../components/FileUploader';

export default function TeacherSubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const { resources, loading, create, remove } = useResources(subjectId);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (subjectId) getSubject(subjectId).then(setSubject).catch(() => navigate('/teacher/subjects'));
  }, [subjectId, navigate]);

  if (!subject || loading) return <PageLoader />;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="card mb-8 overflow-hidden">
        <div className="h-24 p-6 flex items-end relative" style={{ backgroundColor: subject.color }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -mt-8 -mr-8" />
          <div className="flex items-center gap-4 relative z-10 text-white">
            <span className="text-4xl bg-white/20 p-2 rounded-xl backdrop-blur-sm">{subject.icon}</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
              <p className="text-white/80 text-sm mt-0.5">{subject.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Resources & Materials</h2>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowUpload(true)}>
            + Upload File
          </button>
          <button className="btn-primary btn-sm" onClick={() => {
            // Flashcard decks are created immediately via API without a file
            create('New Flashcard Deck', 'flashcard-deck').then(r => {
              if (r) navigate(`/teacher/resources/${r.id}`);
            });
          }}>
            + Create Flashcards
          </button>
        </div>
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon="📂"
          title="No resources yet"
          description="Upload syllabus, notes, or create flashcard decks."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Size</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/teacher/resources/${r.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{resourceTypeIcon(r.type)}</span>
                      <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {r.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="badge badge-neutral">{RESOURCE_TYPE_LABELS[r.type]}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {r.type !== 'flashcard-deck' ? formatBytes(r.fileSize) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {formatDate(r.uploadedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete resource "${r.title}"?`)) remove(r.id);
                      }}
                      title="Delete resource"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={async (title, type, file) => { await create(title, type, file); setShowUpload(false); }}
        />
      )}
    </div>
  );
}

// ── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  onClose, onUpload
}: {
  onClose: () => void;
  onUpload: (title: string, type: ResourceType, file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    // Auto-fill title from filename
    if (f && !title) {
      const name = f.name.replace(/\.[^/.]+$/, '');
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setSubmitting(true);
    await onUpload(title, inferResourceType(file), file);
    setSubmitting(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-slate-900 mb-4">Upload File</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FileUploader onFileSelect={handleFile} disabled={submitting} />

          {file && (
            <div className="animate-fadeIn">
              <label className="label">Resource Title</label>
              <input
                autoFocus
                className="input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Week 1 Lecture Slides"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !file || !title.trim()}>
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
