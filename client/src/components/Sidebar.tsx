import { NavLink, useLocation } from 'react-router-dom';

interface SidebarProps {
  role: 'teacher' | 'student';
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ role, isOpen, setIsOpen }: SidebarProps) {
  const { pathname } = useLocation();

  const links =
    role === 'teacher'
      ? [
          { to: '/teacher/subjects', label: 'Subjects', icon: '📚' },
          { to: '/', label: 'Switch to Student', icon: '👨‍🎓' },
        ]
      : [
          { to: '/student/subjects', label: 'My Subjects', icon: '📚' },
          { to: '/student/search', label: 'Search', icon: '🔍' },
          { to: '/', label: 'Switch to Teacher', icon: '👩‍🏫' },
        ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white
          flex flex-col transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Branding */}
        <div className="h-14 flex items-center px-5 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <span className="text-2xl">🚀</span>
            <span className="text-gradient font-black tracking-tighter">TCET</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(l => {
            const isActive = pathname.startsWith(l.to) && l.to !== '/';
            return (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setIsOpen(false)}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <span className="text-lg opacity-80">{l.icon}</span>
                {l.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
