/**
 * NotesExportButtons.tsx
 * ──────────────────────
 * Export toolbar: Download PDF, Copy Notes, Print, Share.
 */

import { useState } from 'react';

interface NotesExportButtonsProps {
  notes: string;
  topic: string;
}

export default function NotesExportButtons({ notes, topic }: NotesExportButtonsProps) {
  const [copied, setCopied] = useState(false);

  // ── Copy ──────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select all text in the notes area
      const el = document.getElementById('notes-output');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  // ── Print / PDF ───────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // Inject print-specific styles and trigger print-to-PDF dialog
    const style = document.createElement('style');
    style.id = 'print-override';
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #notes-print-area { display: block !important; }
        @page { margin: 1.5cm; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  // ── Share ─────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `AI Notes: ${topic}`,
          text: notes.slice(0, 300) + '...',
        });
      } catch {
        // User cancelled
      }
    } else {
      // Fallback to copy
      await navigator.clipboard.writeText(notes).catch(() => {});
      alert('Notes URL copied to clipboard!');
    }
  };

  const buttons = [
    {
      id: 'btn-copy-notes',
      label: copied ? 'Copied!' : 'Copy',
      title: 'Copy raw markdown',
      onClick: handleCopy,
      icon: copied ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      active: copied,
    },
    {
      id: 'btn-download-pdf',
      label: 'PDF',
      title: 'Download as PDF (use Save as PDF in print dialog)',
      onClick: handleDownloadPdf,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'btn-print-notes',
      label: 'Print',
      title: 'Print notes',
      onClick: handlePrint,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
    },
    {
      id: 'btn-share-notes',
      label: 'Share',
      title: 'Share notes',
      onClick: handleShare,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {buttons.map(btn => (
        <button
          key={btn.id}
          id={btn.id}
          title={btn.title}
          onClick={btn.onClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${btn.active
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 shadow-sm'
            }`}
        >
          {btn.icon}
          <span className="hidden sm:inline">{btn.label}</span>
        </button>
      ))}
    </div>
  );
}
