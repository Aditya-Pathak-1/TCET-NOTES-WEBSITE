import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSubjectStatus, uploadSubjectFile, deleteSubjectFile, regenerateModulePptx } from '../api/ai';
import type { SubjectStatus } from '../api/ai';
import { PageLoader } from '../components/LoadingSpinner';

export default function SubjectWorkspace() {
  const { subjectId } = useParams();
  const [status, setStatus] = useState<SubjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState<'syllabus' | 'reference'>('syllabus');
  const [regeneratingPpt, setRegeneratingPpt] = useState<Record<number, boolean>>({});

  const handleRegeneratePpt = async (moduleNum: number) => {
    if (!subjectId) return;
    setRegeneratingPpt(prev => ({ ...prev, [moduleNum]: true }));
    try {
      await regenerateModulePptx(subjectId, moduleNum);
      fetchStatus();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate PPT');
    } finally {
      setRegeneratingPpt(prev => ({ ...prev, [moduleNum]: false }));
    }
  };

  const fetchStatus = useCallback(() => {
    if (!subjectId) return;
    getSubjectStatus(subjectId)
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [subjectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !subjectId) return;

    setUploading(true);
    try {
      await uploadSubjectFile(subjectId, activeUploadType, file);
      // Wait a sec for indexing to start, then refresh
      setTimeout(fetchStatus, 1000);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docType: 'syllabus' | 'reference', fileName: string) => {
    if (!subjectId || !confirm(`Delete ${fileName}?`)) return;
    try {
      await deleteSubjectFile(subjectId, docType, fileName);
      fetchStatus();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const triggerUpload = (type: 'syllabus' | 'reference') => {
    setActiveUploadType(type);
    fileInputRef.current?.click();
  };

  if (loading || !status) return <PageLoader />;
  const { subject, files, docxStatus, pptxStatus, hasSyllabus } = status;

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="card p-8 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute -right-10 -bottom-10 text-9xl opacity-10 pointer-events-none">
          {subject.icon}
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="px-3 py-1 text-xs font-bold rounded-full text-white"
              style={{ backgroundColor: subject.color }}
            >
              {subject.short}
            </span>
          </div>
          <h1 className="text-3xl font-black mb-2">{subject.name}</h1>
          <p className="text-slate-400 max-w-2xl">{subject.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Modules */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            📚 Course Modules
            {!hasSyllabus && (
              <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-md">
                Upload Syllabus First
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: subject.totalModules }).map((_, i) => {
              const num = i + 1;
              const hasDocx = docxStatus[num];
              const hasPptx = pptxStatus?.[num];

              return (
                <div key={num} className={`card p-5 border-l-4 transition-all ${
                  hasDocx ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-slate-200'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Module {num}
                      </div>
                      <h3 className="font-bold text-slate-800">
                        {hasDocx ? 'Generated Notes' : 'Pending Generation'}
                      </h3>
                    </div>
                    {hasDocx && (
                      <span className="text-xl" title="Ready">✅</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {hasDocx ? (
                      <div className="flex gap-2">
                        <a
                          href={`/api/v1/ai/subjects/${subject.id}/modules/${num}/docx`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary flex-1 text-sm justify-center"
                        >
                          ⬇️ Word Doc
                        </a>
                        <Link
                          to={`/subjects/${subject.id}/module/${num}`}
                          className="btn bg-slate-100 hover:bg-slate-200 text-slate-600 flex-1 text-sm justify-center"
                          title="Regenerate Notes & PPT"
                        >
                          🔄 Regenerate All
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to={`/subjects/${subject.id}/module/${num}`}
                        className={`btn flex-1 text-sm justify-center ${hasSyllabus ? 'btn-primary' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        onClick={e => !hasSyllabus && e.preventDefault()}
                      >
                        ✨ Generate Notes
                      </Link>
                    )}

                    {hasPptx ? (
                      <div className="flex gap-2">
                        <a
                          href={`/api/v1/ai/subjects/${subject.id}/modules/${num}/pptx`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn bg-orange-100 text-orange-700 hover:bg-orange-200 flex-1 text-sm justify-center"
                          title="Download Presentation"
                        >
                          ⬇️ PPT
                        </a>
                        <button
                          onClick={() => handleRegeneratePpt(num)}
                          disabled={regeneratingPpt[num]}
                          className="btn bg-slate-100 hover:bg-slate-200 text-slate-600 flex-1 text-sm justify-center"
                          title="Regenerate only the Presentation using existing Notes"
                        >
                          {regeneratingPpt[num] ? '🔄 Generating...' : '🔄 Regenerate PPT'}
                        </button>
                      </div>
                    ) : hasDocx ? (
                      <button
                        onClick={() => handleRegeneratePpt(num)}
                        disabled={regeneratingPpt[num]}
                        className="btn bg-orange-100 text-orange-700 hover:bg-orange-200 w-full text-sm justify-center"
                        title="Generate Presentation from existing Notes"
                      >
                        {regeneratingPpt[num] ? '🔄 Generating PPT (takes ~1 min)...' : '✨ Generate PPT'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Uploads */}
        <div className="space-y-6">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={handleUpload}
          />

          {/* Syllabus Section */}
          <div className="card p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                📋 Official Syllabus
              </h3>
              {!hasSyllabus && (
                <button
                  onClick={() => triggerUpload('syllabus')}
                  disabled={uploading}
                  className="btn btn-primary btn-sm px-3 py-1"
                >
                  Upload
                </button>
              )}
            </div>

            {hasSyllabus ? (
              <div className="space-y-2">
                {files.syllabus.map(f => (
                  <div key={f} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-sm">
                    <span className="truncate font-medium text-slate-700 max-w-[150px]" title={f}>{f}</span>
                    <div className="flex gap-1">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Indexed</span>
                      <button onClick={() => handleDelete('syllabus', f)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">Upload the university syllabus PDF so the AI can understand the course structure.</p>
              </div>
            )}
          </div>

          {/* Reference Books Section */}
          <div className="card p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                📖 Reference Books
              </h3>
              <button
                onClick={() => triggerUpload('reference')}
                disabled={uploading}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 btn-sm px-3 py-1"
              >
                + Add
              </button>
            </div>

            {files.reference.length > 0 ? (
              <div className="space-y-2">
                {files.reference.map(f => (
                  <div key={f} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-sm">
                    <span className="truncate font-medium text-slate-700 max-w-[150px]" title={f}>{f}</span>
                    <div className="flex gap-1">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Indexed</span>
                      <button onClick={() => handleDelete('reference', f)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">Optional. Upload textbooks or reference PDFs for the AI to extract deep theoretical content from.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
