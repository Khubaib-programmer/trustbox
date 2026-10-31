import React from 'react';

/**
 * StatusPill
 * Minimalist pill badge with soft status tint and colored indicator dot
 * tone: 'safe' | 'warning' | 'danger' | 'neutral'
 */
export default function StatusPill({ 
  tone = 'neutral', 
  label, 
  icon: Icon,
  pulsing = false,
  className = ''
}) {
  const styles = {
    safe: 'bg-safe-tint text-safe border-safe/20',
    warning: 'bg-warning-tint text-warning border-warning/20',
    danger: 'bg-danger-tint text-danger border-danger/20',
    neutral: 'bg-surface text-muted border-hairline',
  }[tone] || 'bg-surface text-muted border-hairline';

  const dotColors = {
    safe: 'bg-safe',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-faint',
  }[tone] || 'bg-faint';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border tabular transition-colors duration-200 ${styles} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors}`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors}`} />
      </span>
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
      <span>{label}</span>
    </span>
  );
}
