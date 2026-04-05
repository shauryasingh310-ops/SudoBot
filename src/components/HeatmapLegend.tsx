export const HeatmapLegend = ({ isDarkMode = true }: { isDarkMode?: boolean }) => (
  <div className={`flex items-center gap-2 text-xs font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
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
