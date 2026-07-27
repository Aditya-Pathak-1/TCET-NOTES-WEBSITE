import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSubjectStatus, planModuleNotes, streamModuleNotes, downloadModuleDocx } from '../api/ai';
import type { ModulePlan, SubjectStatus } from '../api/ai';
import { PageLoader } from '../components/LoadingSpinner';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { waitForPrintWindowReady } from '../utils/printReady';

export default function ModuleNotes() {
  const { subjectId, moduleNum } = useParams();
  const moduleNumber = parseInt(moduleNum ?? '1', 10);
  
  const [status, setStatus] = useState<SubjectStatus | null>(null);
  const [plan, setPlan] = useState<ModulePlan | null>(null);
  const [error, setError] = useState<string>('');
  
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  
  // Streaming state
  const [currentLecture, setCurrentLecture] = useState<{ num: number; title: string } | null>(null);
  const [completedLectures, setCompletedLectures] = useState<string[]>([]);
  const [liveChunk, setLiveChunk] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveChunkRef = useRef<string>(''); // tracks live content without stale closure

  // 1. Load Subject Status
  useEffect(() => {
    if (!subjectId) return;
    getSubjectStatus(subjectId)
      .then(setStatus)
      .catch(e => setError(e.message));
  }, [subjectId]);

  // 2. Auto-scroll during generation
  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [liveChunk, generating]);

  // Handle Planning
  const handlePlan = async () => {
    if (!subjectId) return;
    setError('');
    setPlanning(true);
    try {
      const p = await planModuleNotes(subjectId, moduleNumber);
      setPlan(p);
    } catch (err: any) {
      setError(err.message || 'Failed to plan module');
    } finally {
      setPlanning(false);
    }
  };

  // Handle Generation
  const handleGenerate = () => {
    if (!subjectId || !plan) return;
    setError('');
    setGenerating(true);
    setCompletedLectures([]);
    setLiveChunk('');
    setCurrentLecture(null);
    liveChunkRef.current = '';
    setGenerationDone(false);

    abortRef.current = streamModuleNotes(
      subjectId,
      moduleNumber,
      plan,
      (event) => {
        if (event.type === 'docx_ready') {
          // Server DOCX is ready on disk — Download button uses POST /docx
        } else if (event.type === 'lecture_start') {
          setCurrentLecture({ num: event.lectureNumber!, title: event.lectureTitle! });
          setLiveChunk('');
          liveChunkRef.current = '';
        } else if (event.type === 'chunk' && event.chunk) {
          liveChunkRef.current += event.chunk;
          setLiveChunk(prev => prev + event.chunk);
        } else if (event.type === 'lecture_done') {
          setCompletedLectures(prev => [...prev, liveChunkRef.current]);
          liveChunkRef.current = '';
          setLiveChunk('');
          setCurrentLecture(null);
        }
      },
      () => {
        setGenerating(false);
        setGenerationDone(true);
      },
      (err) => {
        setError(err);
        setGenerating(false);
      }
    );
  };

  // Stop Generation
  const handleStop = () => {
    abortRef.current?.abort();
    setGenerating(false);
    setGenerationDone(completedLectures.length > 0);
  };

  // Download DOCX
  const handleDownloadDocx = async () => {
    if (!subjectId || completedLectures.length === 0) return;

    setError('');
    setDownloadingDocx(true);
    try {
      await downloadModuleDocx(subjectId, moduleNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'DOCX export failed';
      setError(message);
    } finally {
      setDownloadingDocx(false);
    }
  };

  if (!status) return <PageLoader />;

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* Breadcrumb / Header */}
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mb-2">
        <Link to="/subjects" className="hover:text-indigo-600 transition-colors">Subjects</Link>
        <span>/</span>
        <Link to={`/subjects/${subjectId}`} className="hover:text-indigo-600 transition-colors">
          {status.subject.short}
        </Link>
        <span>/</span>
        <span className="text-slate-900">Module {moduleNumber}</span>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Module {moduleNumber} Notes</h1>
          <p className="text-slate-500 mt-1">Generate complete lecture-wise notes from the syllabus.</p>
        </div>
        {/* Download button — visible after generation is complete */}
        {generationDone && !generating && (
          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="btn btn-primary gap-2 shadow-md"
          >
            {downloadingDocx ? 'Preparing Word Doc…' : '⬇️ Download Word Doc'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1: Plan */}
      {!plan && !generating && (
        <div className="card p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-4">
            🧠
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Plan Lecture Structure</h2>
          <p className="text-slate-500 max-w-md mb-6">
            The AI will read the official syllabus for Module {moduleNumber} and intelligently estimate how many lectures are needed to cover all topics.
          </p>
          <button
            onClick={handlePlan}
            disabled={planning}
            className="btn btn-primary btn-lg px-8 shadow-lg shadow-indigo-200"
          >
            {planning ? 'Planning Module...' : 'Plan Lectures'}
          </button>
        </div>
      )}

      {/* Step 2: Show Plan & Generate */}
      {plan && !generating && completedLectures.length === 0 && (
        <div className="card overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{plan.moduleTitle}</h2>
              <p className="text-sm text-slate-500">
                {plan.lectures.length} Lectures • ~{plan.totalHours} Hours Total
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="btn btn-primary shadow-md"
            >
              🚀 Generate Full Module
            </button>
          </div>
          
          <div className="divide-y divide-slate-100">
            {plan.lectures.map(l => (
              <div key={l.lectureNumber} className="p-5 flex items-start gap-4 hover:bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  {l.lectureNumber}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{l.title}</h4>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Topics: <span className="text-slate-700">{l.topics.join(', ')}</span>
                  </p>
                </div>
                <div className="ml-auto text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 whitespace-nowrap shrink-0">
                  {l.estimatedHours} Hr(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Streaming Output */}
      {(generating || completedLectures.length > 0) && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="card p-5 sticky top-4 z-10 shadow-lg border-indigo-100 flex justify-between items-center bg-white/90 backdrop-blur">
            <div>
              <h3 className="font-bold text-slate-800">
                {generating ? 'Generating Notes...' : 'Generation Complete'}
              </h3>
              <p className="text-sm text-slate-500">
                Completed {completedLectures.length} of {plan?.lectures.length} lectures
              </p>
            </div>
            {generating && (
              <button onClick={handleStop} className="btn btn-danger btn-sm">Stop</button>
            )}
          </div>

          {/* Rendered Lectures */}
          {completedLectures.map((content, idx) => (
            <div key={idx} className="card p-8 markdown-container bg-white">
              <MarkdownRenderer content={content} />
            </div>
          ))}

          {/* Live Streaming Lecture */}
          {currentLecture && (
            <div className="card p-8 bg-indigo-50/30 border-indigo-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100">
                <div className="h-full bg-indigo-500 animate-pulse w-1/3 rounded-r-full" />
              </div>
              <div className="mb-4 pb-4 border-b border-indigo-100/50">
                <span className="text-xs font-bold tracking-wider text-indigo-500 uppercase">
                  Generating Lecture {currentLecture.num}
                </span>
                <h3 className="text-xl font-bold text-slate-800">{currentLecture.title}</h3>
              </div>
              
              <div className="markdown-container">
                <MarkdownRenderer content={liveChunk} />
              </div>
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
