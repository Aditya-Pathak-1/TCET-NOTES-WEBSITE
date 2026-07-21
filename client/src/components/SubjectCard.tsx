import type { Subject } from '../types';
import { hexToRgba } from '../utils';

interface SubjectCardProps {
  subject: Subject;
  resourceCount?: number;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export default function SubjectCard({
  subject, resourceCount, onClick, actions,
}: SubjectCardProps) {
  return (
    <div
      className="card-hover group overflow-hidden animate-fadeIn"
      onClick={onClick}
    >
      {/* Coloured header strip */}
      <div
        className="h-20 flex items-end p-3 relative overflow-hidden"
        style={{ backgroundColor: subject.color }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20"
          style={{ backgroundColor: 'white' }}
        />
        <div
          className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10"
          style={{ backgroundColor: 'white' }}
        />
        <span className="text-2xl relative z-10">{subject.icon}</span>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
          {subject.name}
        </h3>
        {subject.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {subject.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          {resourceCount !== undefined && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                color: subject.color,
                backgroundColor: hexToRgba(subject.color, 0.12),
              }}
            >
              {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
            </span>
          )}
          {actions && (
            <div
              className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
