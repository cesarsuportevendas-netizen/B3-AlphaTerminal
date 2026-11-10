import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  benchmark?: string;
  badge?: {
    text: string;
    variant: 'positive' | 'negative' | 'neutral' | 'accent';
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  benchmark,
  badge,
  onClick,
}) => {
  const getBadgeClasses = (variant: 'positive' | 'negative' | 'neutral' | 'accent') => {
    switch (variant) {
      case 'positive':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'negative':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'accent':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'neutral':
      default:
        return 'text-slate-400 bg-slate-800/60 border-slate-700/60';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border border-slate-800/80 rounded-lg p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-850' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-400 tracking-wide">{title}</span>
        {badge && (
          <span
            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${getBadgeClasses(
              badge.variant
            )}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums mb-1">
        {value}
      </div>

      {(subtitle || benchmark) && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
          {subtitle && <span>{subtitle}</span>}
          {benchmark && <span className="font-mono text-slate-500">{benchmark}</span>}
        </div>
      )}
    </div>
  );
};
