import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubjects } from '../hooks/useSubjects';
import { SUBJECT_COLORS, SUBJECT_ICONS, type CreateSubjectDto } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import SubjectCard from '../components/SubjectCard';

export default function TeacherSubjects() {
  const { subjects, loading, create, remove } = useSubjects();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">My Subjects</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your courses and curriculum</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + New Subject
        </button>
      </div>

      {!subjects.length ? (
        <EmptyState
          title="No subjects yet"
          description="Create your first subject to start adding resources and flashcards."
          action={{ label: 'Create Subject', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(sub => (
            <SubjectCard
              key={sub.id}
              subject={sub}
              onClick={() => navigate(`/teacher/subjects/${sub.id}`)}
              actions={
                <button
                  className="p-1.5 rounded bg-white/50 hover:bg-white text-red-600 shadow-sm transition-colors"
                  onClick={async e => {
                    e.stopPropagation();
                    if (confirm('Delete this subject and ALL its resources?')) {
                      await remove(sub.id);
                    }
                  }}
                  title="Delete subject"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              }
            />
          ))}
        </div>
      )}

      {showModal && (
        <CreateSubjectModal onClose={() => setShowModal(false)} onSave={create} />
      )}
    </div>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────────────

function CreateSubjectModal({
  onClose, onSave
}: {
  onClose: () => void;
  onSave: (dto: CreateSubjectDto) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0].value);
  const [icon, setIcon] = useState(SUBJECT_ICONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onSave({ name, description: desc, color, icon });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-slate-900 mb-4">New Subject</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              autoFocus
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Advanced Physics"
              required
            />
          </div>
          <div>
            <label className="label">Description (Optional)</label>
            <textarea
              className="textarea h-20"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Brief overview of the subject..."
            />
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c.value ? 'scale-110 border-slate-900 shadow-sm' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2 text-xl">
              {SUBJECT_ICONS.map(i => (
                <button
                  key={i}
                  type="button"
                  className={`w-10 h-10 rounded-xl transition-colors ${icon === i ? 'bg-slate-200 shadow-inner' : 'hover:bg-slate-100'}`}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
