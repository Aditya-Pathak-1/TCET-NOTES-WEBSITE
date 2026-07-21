import { useCallback, useState } from 'react';
import type { ResourceType } from '../types';

interface FileUploaderProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ACCEPT_DEFAULT =
  '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt';

export default function FileUploader({
  onFileSelect,
  accept = ACCEPT_DEFAULT,
  maxSizeMB = 50,
  disabled,
}: FileUploaderProps) {
  const [file, setFile]     = useState<File | null>(null);
  const [drag, setDrag]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleFile = useCallback(
    (f: File | null) => {
      setError(null);
      if (!f) { setFile(null); onFileSelect(null); return; }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`File must be under ${maxSizeMB} MB`);
        return;
      }
      setFile(f);
      onFileSelect(f);
    },
    [maxSizeMB, onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (disabled) return;
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [disabled, handleFile]
  );

  return (
    <div>
      <label
        className={`drop-zone ${drag ? 'drop-zone-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />

        {file ? (
          <>
            <span className="text-3xl">📎</span>
            <div>
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <p className="text-xs text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB — click to replace
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="text-3xl text-slate-300">☁️</span>
            <div>
              <p className="text-sm font-medium text-slate-600">
                Drag &amp; drop or <span className="text-indigo-600 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400">PDF, DOCX, PPT, images — up to {maxSizeMB} MB</p>
            </div>
          </>
        )}
      </label>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {file && (
        <button
          type="button"
          className="btn-ghost btn-sm mt-2 text-slate-500"
          onClick={() => handleFile(null)}
        >
          ✕ Remove file
        </button>
      )}
    </div>
  );
}

/** Infer ResourceType from a File's mimeType */
export function inferResourceType(file: File): ResourceType {
  const mime = file.type;
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('wordprocessingml') || mime === 'application/msword') return 'docx';
  if (mime.includes('presentationml') || mime === 'application/vnd.ms-powerpoint') return 'ppt';
  return 'material';
}
