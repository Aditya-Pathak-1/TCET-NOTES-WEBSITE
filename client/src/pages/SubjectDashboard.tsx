import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSubjects } from '../api/ai';
import type { Subject } from '../api/ai';
import { PageLoader } from '../components/LoadingSpinner';

export default function SubjectDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">University Notes Generator</h1>
        <p className="text-slate-500 mt-2">
          Select a subject to upload its syllabus and auto-generate comprehensive lecture notes.
        </p>
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
              
              <h2 className="text-2xl font-black text-white relative z-10 leading-tight">
                {subject.short}
              </h2>
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
    </div>
  );
}
