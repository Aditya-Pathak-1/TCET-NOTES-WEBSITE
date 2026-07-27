import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSubjectStatus, planModuleNotes, streamModuleNotes, downloadModulePdf } from '../api/ai';
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
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
        if (event.type === 'pdf_ready') {
          // Server PDF is ready on disk — Download button uses POST /pdf
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

  const exportPdfViaBrowserPrint = async () => {
    if (completedLectures.length === 0) return;

    const subject = status?.subject;
    const moduleTitle = plan?.moduleTitle ?? `Module ${moduleNumber}`;
    const fullMarkdown = completedLectures.join('\n\n---\n\n');

    const parsedBlocks = fullMarkdown
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    const htmlBody = parsedBlocks
      .split('\n\n')
      .map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<hr') || trimmed.startsWith('<block')) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join('\n');

    const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject?.name ?? ''} — ${moduleTitle}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.7; color: #111; margin: 0; padding: 0; }
    h1 { font-size: 20pt; font-weight: 900; color: #1e1b4b; border-bottom: 3px solid #6366f1; padding-bottom: 8px; margin: 28px 0 16px; }
    h2 { font-size: 15pt; font-weight: 700; color: #3730a3; border-left: 4px solid #6366f1; padding-left: 10px; margin: 22px 0 12px; }
    h3 { font-size: 13pt; font-weight: 600; color: #1e1b4b; margin: 18px 0 8px; }
    h4 { font-size: 11pt; font-weight: 600; color: #4338ca; margin: 14px 0 6px; }
    p { margin: 10px 0; }
    ul, ol { margin: 8px 0 12px 20px; }
    li { margin-bottom: 4px; }
    code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px; padding: 1px 4px; }
    pre { background: #1e1b4b; color: #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 12px 0; font-size: 9.5pt; white-space: pre-wrap; }
    pre code { background: none; border: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #6366f1; background: #f0f0ff; padding: 8px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; }
    th { background: #4338ca; color: white; font-weight: 600; padding: 9px 11px; text-align: left; }
    td { padding: 8px 11px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    strong { font-weight: 700; }
    hr { border: none; border-top: 2px solid #e2e8f0; margin: 20px 0; }
    .cover { text-align: center; padding: 60px 40px; page-break-after: always; background: linear-gradient(135deg, #6366f1, #7c3aed); color: white; }
    .cover h1 { color: white; border-color: rgba(255,255,255,0.4); font-size: 26pt; }
    .cover p { font-size: 13pt; opacity: 0.85; }
    .notes-content {
      display: block !important;
      visibility: visible !important;
      height: auto !important;
      overflow: visible !important;
      padding: 40px 50px;
      color: #111 !important;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .notes-content, .notes-content * {
        visibility: visible !important;
        display: revert !important;
        height: auto !important;
        overflow: visible !important;
      }
      h1, h2, h3, h4 { page-break-after: avoid; }
      pre, table, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>📚 Module ${moduleNumber}</h1>
    <p><strong>${subject?.name ?? ''}</strong></p>
    <p>${moduleTitle}</p>
    <p style="margin-top:24px; font-size:10pt; opacity:0.7;">TCET AI University Notes Generator</p>
  </div>
  <div class="notes-content">
    ${htmlBody}
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      throw new Error('Popup blocked! Please allow popups for this site and try again.');
    }

    win.document.open();
    win.document.write(printHtml);
    win.document.close();

    await waitForPrintWindowReady(win, '.notes-content');
    win.focus();
    win.print();
  };

  // Download PDF — server Puppeteer first, browser print fallback
  const handleDownloadPdf = async () => {
    if (!subjectId || completedLectures.length === 0) return;

    setError('');
    setDownloadingPdf(true);
    try {
      await downloadModulePdf(subjectId, moduleNumber);
    } catch {
      try {
        await exportPdfViaBrowserPrint();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'PDF export failed';
        setError(message);
      }
    } finally {
      setDownloadingPdf(false);
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
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-primary gap-2 shadow-md"
          >
            {downloadingPdf ? 'Preparing PDF…' : '⬇️ Download PDF'}
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
