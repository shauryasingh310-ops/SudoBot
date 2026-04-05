export const HeatmapLegend = () => (
  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
    <span>Fewer games</span>
    {[
      'bg-slate-800 border border-slate-700',
      'bg-indigo-700',
      'bg-indigo-600',
      'bg-indigo-500',
      'bg-indigo-400',
    ].map((c, i) => (
      <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
    ))}
    <span>More games</span>
  </div>
);
