import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getSubjects } from '../api/ai';
import type { Subject } from '../api/ai';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { pathname } = useLocation();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white
          flex flex-col transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Branding */}
        <div className="h-14 flex items-center px-5 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <span className="text-2xl">🎓</span>
            <span className="text-gradient font-black tracking-tighter">TCET AI</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink
            to="/subjects"
            end
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <span className="text-lg opacity-80">🏠</span>
            Dashboard
          </NavLink>

          <div className="pt-4 pb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Subjects
          </div>

          {subjects.map(s => {
            const to = `/subjects/${s.id}`;
            const isActive = pathname.startsWith(to);
            return (
              <NavLink
                key={s.id}
                to={to}
                onClick={() => setIsOpen(false)}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <span className="text-lg opacity-80">{s.icon}</span>
                <span className="truncate">{s.short}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
