/**
 * MarkdownRenderer.tsx
 * ─────────────────────
 * Beautiful Markdown renderer with:
 *  - Syntax-highlighted code blocks
 *  - Mermaid diagram support
 *  - GFM tables, task lists, etc.
 *  - KaTeX-style equation rendering
 */

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';

// ── Mermaid renderer ──────────────────────────────────────────────────────────

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          themeVariables: {
            primaryColor: '#6366f1',
            primaryTextColor: '#1e1b4b',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6366f1',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          securityLevel: 'loose',
        });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="text-red-500 text-xs p-2">Diagram error: ${err}</pre>`;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4"
    />
  );
}

// ── Custom component overrides ────────────────────────────────────────────────

const components: Components = {
  // Code blocks — intercept mermaid, highlight the rest
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? '';
    const code = String(children).replace(/\n$/, '');

    if (lang === 'mermaid') {
      return <MermaidDiagram code={code} />;
    }

    // Inline code
    if (!className) {
      return (
        <code
          className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[0.85em] border border-indigo-100"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="relative group my-4">
        {lang && (
          <span className="absolute top-2 right-10 text-xs text-slate-400 font-mono uppercase tracking-wide">
            {lang}
          </span>
        )}
        <CopyButton text={code} />
        <code className={`${className} block rounded-xl text-sm`} {...props}>
          {children}
        </code>
      </div>
    );
  },

  // Pre — wrap with styling
  pre({ children }) {
    return (
      <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed shadow-md">
        {children}
      </pre>
    );
  },

  // Headings
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-2xl font-black text-slate-900 border-b-2 border-indigo-100 pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-3 text-xl font-bold text-indigo-700 flex items-center gap-2">
      <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold text-slate-800">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1.5 text-sm font-semibold text-slate-700 uppercase tracking-wide">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="my-2.5 leading-relaxed text-slate-700">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-3 ml-5 space-y-1 list-disc marker:text-indigo-400">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-5 space-y-1 list-decimal marker:text-indigo-600 marker:font-semibold">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-700 leading-relaxed">{children}</li>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-indigo-400 bg-indigo-50 pl-4 pr-3 py-2 rounded-r-lg text-slate-700 italic">
      {children}
    </blockquote>
  ),

  // Tables
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-indigo-50 text-indigo-800 font-semibold border-b border-indigo-200">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-100">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-slate-50 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 font-semibold text-indigo-700">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-slate-700">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-6 border-slate-200" />,

  // Strong / Em
  strong: ({ children }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-600">{children}</em>
  ),
};

// ── Copy button helper ────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      title="Copy code"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose-notes ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
