import React from 'react';

/**
 * KpiTile
 * Minimal, bold tile: small uppercase label above, 36px bold number below.
 */
export default function KpiTile({ 
  label, 
  value, 
  unit = '', 
  delta = null, 
  statusIcon: StatusIcon = null,
  statusTone = null 
}) {
  const toneClasses = {
    safe: 'text-safe',
    warning: 'text-warning',
    danger: 'text-danger',
  }[statusTone] || 'text-ink';

  return (
    <div className="flex flex-col justify-between py-2">
      <span className="text-[12px] font-medium uppercase tracking-widest text-muted">
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-[36px] font-semibold tracking-tighter leading-none tabular ${toneClasses}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[18px] font-medium text-muted">
            {unit}
          </span>
        )}
        {StatusIcon && (
          <StatusIcon className={`w-5 h-5 ml-1 inline-block ${toneClasses}`} strokeWidth={2} />
        )}
      </div>
      {delta && (
        <span className="mt-1 text-[13px] text-muted font-normal">
          {delta}
        </span>
      )}
    </div>
  );
}
