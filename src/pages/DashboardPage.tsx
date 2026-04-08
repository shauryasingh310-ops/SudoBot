import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Home } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LineController, Filler } from 'chart.js';
import { fetchUserStats, UserStats, fetchGameHistoryForHeatmap, fetchRatingHistoryForChart, initializeUserStats } from '../utils/statsManager';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { HeatmapLegend } from '../components/HeatmapLegend';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LineController, Filler);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true;
  });
  const [stats, setStats] = useState<UserStats>({
    rating: 1600,
    totalGames: 0,
    bestTime: 999,
    winRate: 0,
    currentStreak: 0,
    accuracy: 0,
    avgTime: 0,
    bestStreak: 0
  });
  const [heatmapData, setHeatmapData] = useState<Record<string, any>>({});
  const chartRef = useRef<Chart | null>(null);
  const initRef = useRef(false);

  // Listen for theme changes from GamePage (custom event)
  useEffect(() => {
    const handleThemeChange = (event: any) => {
      setIsDarkMode(event.detail.isDarkMode);
    };

    window.addEventListener('themeChange', handleThemeChange);
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  useEffect(() => {
    const email = localStorage.getItem('user-email');
    if (!email) {
      navigate('/login');
      return;
    }
    setUserEmail(email);

    // Get current user ID from auth
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserId(user.uid);
        
        // Ensure user stats are initialized
        if (user.email) {
          await initializeUserStats(user.uid, user.email).catch(() => {
            // Stats initialization failed or already exists
          });
        }
        
        // Fetch user stats from Firestore or localStorage
        const userStats = await fetchUserStats(user.uid);
        if (userStats) {
          setStats(userStats);
        }
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;

    // Load real data and create visualizations
    const loadData = async () => {
      console.log('📊 loadData function called');
      try {
        console.log('📥 Fetching game history for userId:', userId);
        const gameHistory = await fetchGameHistoryForHeatmap(userId);
        console.log('✅ Game history fetched:', gameHistory);
        
        const ratingHistory = await fetchRatingHistoryForChart(userId);
        console.log('✅ Rating history fetched:', ratingHistory);

        // Fetch fresh stats
        const userStats = await fetchUserStats(userId);
        if (userStats) {
          console.log('✅ Fresh user stats fetched:', userStats);
          setStats(userStats);
        }

        // Transform game history to heatmap format
        const transformedData: Record<string, any> = {};
        Object.entries(gameHistory).forEach(([date, count]) => {
          if ((count as number) > 0) {
            transformedData[date] = { count: count as number };
          }
        });
        console.log('🎨 Transformed heatmap data:', transformedData);
        setHeatmapData(transformedData);

        // Create chart using setTimeout to ensure DOM is ready
        setTimeout(() => {
          createProgressChart(ratingHistory);
        }, 0);
      } catch (err) {
        // Fallback to empty heatmap
        setHeatmapData({});
        setTimeout(() => {
          createProgressChart([]);
        }, 0);
      }
    };

    if (initRef.current === false) {
      initRef.current = true;
      loadData();
    }
  }, [userId]);

  // Force refetch stats when page visibility changes
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const freshStats = await fetchUserStats(userId);
        if (freshStats) {
          setStats(freshStats);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId]);

  // Recreate chart when dark mode changes (synced from GamePage)
  useEffect(() => {
    if (initRef.current) {
      const ctx = document.getElementById('progressChart') as HTMLCanvasElement;
      if (ctx && chartRef.current) {
        chartRef.current.destroy();
        createProgressChart([]);
      }
    }
  }, [isDarkMode]);


  const createProgressChart = (ratingHistory: any[] = []) => {
    const ctx = document.getElementById('progressChart') as HTMLCanvasElement;
    if (!ctx) return;

    const labels: string[] = [];
    const data: number[] = [];

    if (ratingHistory.length > 0) {
      // Use real rating history
      ratingHistory.forEach((entry: any) => {
        const date = new Date(entry.date);
        labels.push((date.getMonth() + 1) + '/' + date.getDate());
        data.push(entry.rating);
      });
    } else {
      // Fallback: create empty chart with current rating
      const today = new Date();
      const currentRating = stats.rating || 1600;
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push((date.getMonth() + 1) + '/' + date.getDate());
        data.push(currentRating);
      }
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const gridColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    const pointBorderColor = isDarkMode ? '#fff' : '#000';

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rating',
          data: data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: pointBorderColor,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false } as any
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 1400,
            max: 2100,
            grid: { color: gridColor },
            ticks: { color: tickColor }
          } as any,
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor }
          } as any
        }
      }
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user-email');
      localStorage.removeItem('sudoku-state');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#080808] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 pb-6 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h1 className={`text-4xl font-black mb-2 ${isDarkMode ? '' : 'text-slate-900'}`}>Your Dashboard</h1>
            <p className={isDarkMode ? 'text-sm text-white/50' : 'text-sm text-slate-600'}>{userEmail}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/game')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/20 hover:bg-white/10' : 'bg-white border-slate-300 hover:bg-slate-100 shadow-sm'}`}
            >
              <Home className="w-4 h-4" /> Back to Game
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-6 py-3 border rounded-xl transition-all ${isDarkMode ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Intelligence Level Card */}
          <div className={`border rounded-2xl p-8 transition-all ${isDarkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 hover:border-slate-400'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>Sudoku Intelligence Level</h2>
            <div className="text-center">
              <p className={`text-sm mb-3 ${isDarkMode ? 'text-white/50' : 'text-slate-600'}`}>Your Rating</p>
              <div className="text-6xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent my-4">
                {stats.rating}
              </div>
              <div className={`border px-6 py-2 rounded-xl inline-block text-sm font-bold ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-indigo-100 border-indigo-300 text-indigo-700'}`}>
                {stats.rating >= 2000 ? 'Expert' : stats.rating >= 1800 ? 'Advanced Solver' : stats.rating >= 1500 ? 'Intermediate' : 'Beginner'}
              </div>
              <div className="flex justify-around gap-2 mt-6">
                <div className={`flex-1 rounded-lg p-3 ${isDarkMode ? 'bg-white/2' : 'bg-slate-200'}`}>
                  <div className="text-2xl font-bold text-indigo-400">{stats.totalGames}</div>
                  <div className={`text-xs mt-1 uppercase tracking-wide ${isDarkMode ? 'text-white/40' : 'text-slate-600'}`}>Games</div>
                </div>
                <div className={`flex-1 rounded-lg p-3 ${isDarkMode ? 'bg-white/2' : 'bg-slate-200'}`}>
                  <div className="text-2xl font-bold text-indigo-400">{Math.floor(stats.bestTime / 60)}:{(stats.bestTime % 60).toString().padStart(2, '0')}</div>
                  <div className={`text-xs mt-1 uppercase tracking-wide ${isDarkMode ? 'text-white/40' : 'text-slate-600'}`}>Best Time</div>
                </div>
                <div className={`flex-1 rounded-lg p-3 ${isDarkMode ? 'bg-white/2' : 'bg-slate-200'}`}>
                  <div className="text-2xl font-bold text-indigo-400">{Math.round(stats.winRate)}%</div>
                  <div className={`text-xs mt-1 uppercase tracking-wide ${isDarkMode ? 'text-white/40' : 'text-slate-600'}`}>Win Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className={`border rounded-2xl p-8 transition-all ${isDarkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 hover:border-slate-400'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>Current Stats</h2>
            <div className="space-y-4">
              {[
                { label: 'Accuracy', value: `${Math.round(stats.accuracy)}%`, color: 'text-green-400', width: `${stats.accuracy}%` },
                { label: 'Win Rate', value: `${Math.round(stats.winRate)}%`, color: 'text-indigo-400', width: `${stats.winRate}%` },
                { label: 'Streak', value: `${stats.currentStreak} days 🔥`, color: 'text-amber-400', width: `${Math.min(stats.currentStreak * 10, 100)}%` }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className={isDarkMode ? 'text-white/60' : 'text-slate-600'}>{stat.label}</span>
                    <span className={`font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-300'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: stat.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className={`border rounded-2xl p-8 transition-all ${isDarkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 hover:border-slate-400'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={isDarkMode ? 'text-white/60' : 'text-slate-600'}>Total Games</span>
                <span className={`text-xl font-bold ${isDarkMode ? '' : 'text-slate-900'}`}>{stats.totalGames}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={isDarkMode ? 'text-white/60' : 'text-slate-600'}>Avg Time</span>
                <span className={`text-xl font-bold ${isDarkMode ? '' : 'text-slate-900'}`}>{Math.floor(stats.avgTime / 60)}:{(stats.avgTime % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={isDarkMode ? 'text-white/60' : 'text-slate-600'}>Best Streak</span>
                <span className={`text-xl font-bold ${isDarkMode ? '' : 'text-slate-900'}`}>{stats.bestStreak} days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className={`border rounded-2xl p-8 mb-8 ${isDarkMode ? 'bg-white/4 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
          <h2 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>Activity Heatmap (Last 12 Months)</h2>
          <div className="space-y-4">
            <HeatmapGrid heatmapData={heatmapData} isDarkMode={isDarkMode} />
            <HeatmapLegend isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* Chart */}
        <div className={`border rounded-2xl p-8 ${isDarkMode ? 'bg-white/4 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
          <h2 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>Rating Progress Over Time</h2>
          <div style={{ position: 'relative', height: '300px' }}>
            <canvas id="progressChart" />
          </div>
        </div>
      </div>
    </div>
  );
}
