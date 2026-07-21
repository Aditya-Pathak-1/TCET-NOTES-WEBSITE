interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin text-indigo-600 ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Full-page centred loading state */
export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[300px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

/** Skeleton card block for shimmer placeholders */
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="shimmer h-4 rounded w-2/3" />
      <div className="shimmer h-3 rounded w-full" />
      <div className="shimmer h-3 rounded w-4/5" />
    </div>
  );
}
