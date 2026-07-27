interface NavbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export default function Navbar({ title, onMenuClick }: NavbarProps) {
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

      {/* Role badge */}
      <span className="badge badge-primary ml-auto shrink-0">
        👩‍🏫 Teacher
      </span>
    </header>
  );
}
