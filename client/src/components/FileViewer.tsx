import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Resource } from '../types';
import { getViewUrl, getDownloadUrl } from '../api/resources';
import LoadingSpinner from './LoadingSpinner';

// Configure pdfjs worker via CDN — avoids Vite bundling complexity
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface FileViewerProps {
  resource: Resource;
}

export default function FileViewer({ resource }: FileViewerProps) {
  const { mimeType, type } = resource;

  // ── PDF preview ────────────────────────────────────────────────────────
  if (mimeType === 'application/pdf') {
    return <PdfViewer resource={resource} />;
  }

  // ── Image preview ──────────────────────────────────────────────────────
  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <img
          src={getViewUrl(resource.id)}
          alt={resource.title}
          className="max-w-full max-h-[600px] object-contain rounded-xl shadow-sm border border-slate-100"
        />
        <DownloadButton resource={resource} />
      </div>
    );
  }

  // ── Flashcard deck — handled separately ───────────────────────────────
  if (type === 'flashcard-deck') return null;

  // ── DOCX / PPT / other — download only ────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 py-10 animate-fadeIn">
      <span className="text-6xl">{type === 'docx' ? '📘' : type === 'ppt' ? '📊' : '📎'}</span>
      <p className="text-sm text-slate-500">
        This file type cannot be previewed in the browser.
      </p>
      <DownloadButton resource={resource} />
    </div>
  );
}

// ── PDF sub-component ──────────────────────────────────────────────────────
function PdfViewer({ resource }: { resource: Resource }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-3 animate-fadeIn">
      {loading && <LoadingSpinner />}
      {error && (
        <div className="text-sm text-red-500 p-4 text-center">
          ⚠️ Could not load PDF. <DownloadButton resource={resource} />
        </div>
      )}

      <Document
        file={getViewUrl(resource.id)}
        onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoading(false); }}
        onLoadError={() => { setError('Failed to load PDF'); setLoading(false); }}
        loading={null}
      >
        <Page
          pageNumber={page}
          width={Math.min(window.innerWidth - 64, 720)}
          renderTextLayer
          renderAnnotationLayer
          className="rounded-lg overflow-hidden shadow border border-slate-200"
        />
      </Document>

      {numPages && numPages > 1 && (
        <div className="flex items-center gap-3">
          <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span className="text-sm text-slate-500">{page} / {numPages}</span>
          <button className="btn-secondary btn-sm" disabled={page >= numPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}

      <DownloadButton resource={resource} />
    </div>
  );
}

function DownloadButton({ resource }: { resource: Resource }) {
  return (
    <a
      href={getDownloadUrl(resource.id)}
      download={resource.fileName}
      className="btn-secondary btn-sm"
    >
      ⬇ Download {resource.fileName}
    </a>
  );
}
