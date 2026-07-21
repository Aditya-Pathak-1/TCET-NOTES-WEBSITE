import { forwardRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, onClear, placeholder = 'Search…', autoFocus, className = '' }, ref) => {
    return (
      <div className={`relative flex items-center ${className}`}>
        {/* Search icon */}
        <svg
          className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="input pl-9 pr-8"
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 p-1 rounded-full text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
SearchBar.displayName = 'SearchBar';

export default SearchBar;
