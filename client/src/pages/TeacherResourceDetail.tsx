import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import { useFlashcards } from '../hooks/useFlashcards';
import type { Resource } from '../types';
import { RESOURCE_TYPE_LABELS } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import FileViewer from '../components/FileViewer';
import EmptyState from '../components/EmptyState';

export default function TeacherResourceDetail() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  const { flashcards, create: createCard, update: updateCard, remove: removeCard } = useFlashcards(
    resource?.type === 'flashcard-deck' ? resourceId : undefined
  );

  useEffect(() => {
    if (!resourceId) return;
    // We don't have a standalone getResource endpoint, but we can fetch it via search or subject if we knew the subjectId.
    // For simplicity, let's assume we need to fetch the whole subject's resources or we just fetch it via a new endpoint.
    // Since we didn't build a GET /resources/:id, let's fetch it via search hack or we should add a GET /resources/:id in backend.
    // Actually, backend has GET /subjects/:id/resources.
    // Wait, we need the resource directly. Let's add a GET /api/v1/resources/:id route in backend or just fetch from search?
    // Let's use search with the exact ID? No, search uses LIKE on title/filename.
    // Let's just fetch it by doing a custom fetch to a new endpoint we'll create, OR we can just pass state via React Router.
    // For now, let's assume the user navigated here and we can fetch it from the API if we add the route.
    // I will add the route `GET /resources/:id` to the backend later if needed, but for now let's mock it or fetch via search.
    // Actually, I can just use `apiGet<Resource>(`/resources/${resourceId}`)` and I'll add that route to the backend.
    apiGet<Resource>(`/resources/${resourceId}`)
      .then(setResource)
      .catch(() => navigate('/teacher/subjects'))
      .finally(() => setLoading(false));
  }, [resourceId, navigate]);

  if (loading || !resource) return <PageLoader />;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <span className="text-slate-300">•</span>
            <span className="badge badge-neutral">{RESOURCE_TYPE_LABELS[resource.type]}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{resource.title}</h1>
        </div>
      </div>

      {resource.type === 'flashcard-deck' ? (
        <FlashcardEditor
          flashcards={flashcards}
          onCreate={createCard}
          onUpdate={updateCard}
          onRemove={removeCard}
        />
      ) : (
        <div className="card p-6 bg-slate-50 border-dashed">
          <FileViewer resource={resource} />
        </div>
      )}
    </div>
  );
}

// ── Flashcard Editor ─────────────────────────────────────────────────────────

function FlashcardEditor({ flashcards, onCreate, onUpdate, onRemove }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !a.trim()) return;
    await onCreate({ question: q, answer: a });
    setQ('');
    setA('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="section-title mb-0">Cards in this deck</h3>
        <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + Add Card
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="card p-4 bg-indigo-50/50 border-indigo-100 flex flex-col gap-3 animate-fadeIn">
          <input className="input bg-white" placeholder="Question" value={q} onChange={e => setQ(e.target.value)} autoFocus required />
          <textarea className="textarea bg-white" placeholder="Answer" value={a} onChange={e => setA(e.target.value)} required rows={2} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={!q.trim() || !a.trim()}>Save Card</button>
          </div>
        </form>
      )}

      {flashcards.length === 0 && !showAdd ? (
        <EmptyState icon="📇" title="Deck is empty" description="Add your first flashcard to start studying." action={{ label: 'Add Card', onClick: () => setShowAdd(true) }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashcards.map((fc: any, i: number) => (
            <div key={fc.id} className="card p-4 relative group">
              <span className="absolute top-4 right-4 text-xs font-bold text-slate-300">#{i + 1}</span>
              <div className="mb-3">
                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider block mb-1">Q</span>
                <p className="text-slate-800 font-medium">{fc.question}</p>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider block mb-1">A</span>
                <p className="text-slate-600">{fc.answer}</p>
              </div>
              <button
                className="absolute bottom-4 right-4 p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                onClick={() => { if(confirm('Delete card?')) onRemove(fc.id); }}
                title="Delete card"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
