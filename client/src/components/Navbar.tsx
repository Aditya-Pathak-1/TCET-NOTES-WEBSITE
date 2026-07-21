import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import { useSearch } from '../hooks/useSearch';

interface NavbarProps {
  title?: string;
  role: 'teacher' | 'student';
  onMenuClick?: () => void;
}

export default function Navbar({ title, role, onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const { query, onQueryChange, clear } = useSearch();

  const handleSearch = (v: string) => {
    onQueryChange(v);
    if (v.trim() && role === 'student') {
      navigate(`/student/search?q=${encodeURIComponent(v)}`);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 shrink-0">
      {/* Mobile hamburger */}
      {onMenuClick && (
        <button
          className="btn-icon text-slate-600 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Page title */}
      {title && (
        <h1 className="font-semibold text-slate-800 text-sm hidden sm:block">{title}</h1>
      )}

      {/* Search (student only) */}
      {role === 'student' && (
        <SearchBar
          value={query}
          onChange={handleSearch}
          onClear={() => { clear(); navigate('/student/subjects'); }}
          placeholder="Search subjects and resources…"
          className="flex-1 max-w-sm ml-auto"
        />
      )}

      {/* Role badge */}
      <span className={`badge ml-auto shrink-0 ${role === 'teacher' ? 'badge-primary' : 'badge-success'}`}>
        {role === 'teacher' ? '👩‍🏫 Teacher' : '👨‍🎓 Student'}
      </span>
    </header>
  );
}
