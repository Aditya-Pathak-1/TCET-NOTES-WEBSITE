import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px]" />

      <div className="relative z-10 animate-fadeIn max-w-2xl">
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-6xl animate-float">🚀</span>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
            TCET
          </h1>
        </div>

        <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-lg mx-auto leading-relaxed">
          The modern, lightweight learning management system for the future.
          Select your portal to continue.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/teacher/subjects"
            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">👩‍🏫</span>
            Teacher Portal
          </Link>

          <Link
            to="/student/subjects"
            className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 backdrop-blur-md text-white border border-white/20 rounded-xl font-semibold text-lg transition-all hover:scale-105 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">👨‍🎓</span>
            Student Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
