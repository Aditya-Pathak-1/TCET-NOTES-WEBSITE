import { useState, useRef } from 'react';
import { createSubject } from '../api/subjects';
import { uploadSubjectFile } from '../api/ai';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSubjectModal({ isOpen, onClose, onSuccess }: AddSubjectModalProps) {
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Subject name is required.');
      return;
    }
    if (!file) {
      setError('Please upload a syllabus file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create the subject
      const subject = await createSubject({
        name: name.trim(),
        short: short.trim() || name.substring(0, 4).toUpperCase(),
        totalModules: 6,
      });

      // 2. Upload the syllabus
      await uploadSubjectFile(subject.id, 'syllabus', file);

      // 3. Success
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create subject or upload syllabus.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Add Custom Subject</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name *</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. Advanced Machine Learning"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code (Optional)</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. AML"
              value={short}
              onChange={e => setShort(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Syllabus (PDF/DOCX) *</label>
            <input
              type="file"
              ref={fileInputRef}
              required
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              accept=".pdf,.docx,.txt"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
