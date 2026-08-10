import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSubjects } from '../api/ai';
import { deleteSubject } from '../api/subjects';
import type { Subject } from '../api/ai';
import { PageLoader } from '../components/LoadingSpinner';
import AddSubjectModal from '../components/AddSubjectModal';

export default function SubjectDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSubjects = () => {
    setLoading(true);
    getSubjects()
      .then(setSubjects)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete the custom subject "${name}"? This will also remove its uploaded syllabus and generated notes. This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteSubject(id);
      fetchSubjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">University Notes Generator</h1>
          <p className="text-slate-500 mt-2">
            Select a subject to upload its syllabus and auto-generate comprehensive lecture notes.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
        >
          + Add Subject
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/subjects/${subject.id}`}
            className="group card overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div 
              className="h-32 p-6 flex flex-col justify-end relative overflow-hidden"
              style={{ backgroundColor: subject.color }}
            >
              {/* Decorative background icon */}
              <div className="absolute -right-4 -top-6 text-9xl opacity-20 transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                {subject.icon}
              </div>
              
              <div className="relative z-10 flex justify-between items-end">
                <h2 className="text-2xl font-black text-white leading-tight">
                  {subject.short}
                </h2>
                
                {subject.subjectType === 'custom' && (
                  <button
                    onClick={(e) => handleDelete(e, subject.id, subject.name)}
                    className="text-white/70 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-lg transition-colors"
                    title="Delete Custom Subject"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-900 mb-2">{subject.name}</h3>
              <p className="text-sm text-slate-500 flex-1 leading-relaxed">
                {subject.description}
              </p>
              
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                <span>{subject.totalModules} Modules</span>
                <span className="flex items-center gap-1">
                  Open Workspace
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <AddSubjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSubjects}
      />
    </div>
  );
}
