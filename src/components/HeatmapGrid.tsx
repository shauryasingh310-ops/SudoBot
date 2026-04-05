import { useMemo } from 'react';
import { HeatmapCell } from './HeatmapCell';
import dayjs, { Dayjs } from 'dayjs';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['S','M','T','W','T','F','S'];

interface HeatmapGridProps {
  heatmapData?: Record<string, { count: number; rating?: number; avgTime?: number; wins?: number }>;
  isDarkMode?: boolean;
}

export const HeatmapGrid = ({ heatmapData = {}, isDarkMode = true }: HeatmapGridProps) => {
  const today = dayjs().format('YYYY-MM-DD');

  const weeks = useMemo(() => {
    const dates = Array.from({ length: 365 }, (_, i) =>
      dayjs().subtract(364 - i, 'day').format('YYYY-MM-DD')
    );
    const startDow = dayjs().subtract(364, 'day').day();
    const padded: (string | null)[] = [...Array(startDow).fill(null), ...dates];
    const w: (string | null)[][] = [];
    for (let i = 0; i < Math.ceil(padded.length / 7); i++) {
      w.push(padded.slice(i * 7, i * 7 + 7));
    }
    return w.filter(wk => wk.some(d => d)).slice(-52);
  }, []);

  const monthLabels = useMemo(() => {
    const labels: { i: number; label: string }[] = [];
    let last: number | null = null;
    weeks.forEach((wk, i) => {
      const first = wk.find(d => d);
      if (!first) return;
      const m = dayjs(first).month();
      if (m !== last) { 
        labels.push({ i, label: MONTHS[m] }); 
        last = m; 
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="relative h-5 mb-2 ml-7">
          {monthLabels.map(({ i, label }) => (
            <span key={`${label}-${i}`}
              className={`absolute text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
              style={{ left: `${i * 15}px` }}>
              {label}
            </span>
          ))}
        </div>
        <div className="flex">
          <div className="flex flex-col gap-[3px] mr-2">
            {DAYS.map((d, i) => (
              <div key={i} className="w-3 h-3 flex items-center justify-end">
                {i % 2 !== 0 && (
                  <span className={`text-[8px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>{d}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((wk, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {wk.map((date, di) => (
                  <HeatmapCell
                    key={date || `e-${wi}-${di}`}
                    date={date}
                    data={date ? heatmapData[date] || null : null}
                    isToday={date === today}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
