import { memo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeatmapData {
  count: number;
  rating?: number;
  avgTime?: number;
  wins?: number;
}

const getColor = (d: HeatmapData | null) => {
  if (!d || d.count === 0) return 'bg-slate-800 border border-slate-700';
  if (d.count >= 5) return 'bg-indigo-400';
  if (d.count >= 3) return 'bg-indigo-500';
  if (d.count >= 2) return 'bg-indigo-600';
  return 'bg-indigo-700';
};

interface HeatmapCellProps {
  date: string | null;
  data: HeatmapData | null;
  isToday: boolean;
  isDarkMode?: boolean;
}

export const HeatmapCell = memo(({ date, data, isToday, isDarkMode = true }: HeatmapCellProps) => {
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ zIndex: hov ? 9999 : 'auto' }}
    >
      <motion.div
        whileHover={{ scale: 1.4 }}
        animate={isToday && data && data.count > 0
          ? { boxShadow: ['0 0 0px rgba(99,102,241,0)', '0 0 8px rgba(99,102,241,0.7)', '0 0 0px rgba(99,102,241,0)'] }
          : {}
        }
        transition={isToday ? { duration: 2, repeat: Infinity } : { duration: 0.1 }}
        className={`w-3 h-3 rounded-sm cursor-pointer transition-all ${getColor(data)}
          ${isToday ? 'ring-1 ring-indigo-400 ring-offset-1 ring-offset-slate-950' : ''}`}
      />

      <AnimatePresence>
        {hov && date && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'fixed',
              zIndex: 99999,
              pointerEvents: 'none',
              transform: 'translate(-50%, -110%)',
              left: ref.current
                ? ref.current.getBoundingClientRect().left +
                  ref.current.getBoundingClientRect().width / 2 +
                  'px'
                : '50%',
              top: ref.current
                ? ref.current.getBoundingClientRect().top + 'px'
                : '50%',
            }}
            className={`border rounded-lg px-3 py-2 text-xs shadow-2xl min-w-[160px] ${isDarkMode ? 'bg-slate-950 border-white/10' : 'bg-white border-slate-300'}`}
          >
            <div className={`font-mono font-medium mb-2 pb-1.5 border-b ${isDarkMode ? 'text-slate-300 border-white/8' : 'text-slate-700 border-slate-300'}`}>
              {date}
            </div>
            {data && data.count > 0 ? (
              <div className="space-y-1.5">
                <div className="flex justify-between gap-6">
                  <span className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Games</span>
                  <span className={`font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{data.count}</span>
                </div>
                {data.avgTime !== undefined && (
                  <div className="flex justify-between gap-6">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Avg Time</span>
                    <span className={`font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {Math.floor(data.avgTime / 60)}:{(data.avgTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                {data.rating !== undefined && (
                  <div className="flex justify-between gap-6">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Rating</span>
                    <span className="text-indigo-400 font-mono">{data.rating}</span>
                  </div>
                )}
                {data.wins !== undefined && (
                  <div className="flex justify-between gap-6">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Wins</span>
                    <span className="text-emerald-400 font-mono">{data.wins}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`font-mono text-center py-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>
                No games
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
HeatmapCell.displayName = 'HeatmapCell';
