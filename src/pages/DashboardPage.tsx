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

  useEffect(() => {
    console.log('🔐 Dashboard auth effect running');
    const email = localStorage.getItem('user-email');
    if (!email) {
      console.log('❌ No user email in localStorage, redirecting to login');
      navigate('/login');
      return;
    }
    console.log('✅ User email found:', email);
    setUserEmail(email);

    // Get current user ID from auth
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log('✅ Auth user found:', user.uid);
        setUserId(user.uid);
        
        // Ensure user stats are initialized
        if (user.email) {
          await initializeUserStats(user.uid, user.email).catch(err => {
            console.log('Stats already initialized or error:', err);
          });
        }
        
        // Fetch user stats from Firestore or localStorage
        const userStats = await fetchUserStats(user.uid);
        if (userStats) {
          console.log('✅ User stats fetched:', userStats);
          setStats(userStats);
        }
      } else {
        console.log('❌ No auth user found');
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;

      // Load real data and create visualizations
      const loadData = async () => {
        console.log('📊 loadData function called');
        if (!userId) {
          console.log('❌ No userId available');
          return;
        }

        try {
          console.log('📥 Fetching game history for userId:', userId);
          const gameHistory = await fetchGameHistoryForHeatmap(userId);
          console.log('✅ Game history fetched:', gameHistory);
          
          const ratingHistory = await fetchRatingHistoryForChart(userId);
          console.log('✅ Rating history fetched:', ratingHistory);

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
          console.error('❌ Error loading dashboard data:', err);
          // Fallback to empty heatmap
          setHeatmapData({});
          setTimeout(() => {
            createProgressChart([]);
          }, 0);
        }
      };

      if (userId) {
        console.log('🎯 userId available, calling loadData');
        loadData();
      } else {
        console.log('⏳ Waiting for userId...');
      }
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [userId]);


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
          pointBorderColor: '#fff',
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
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.5)' }
          } as any,
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.5)' }
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
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-4xl font-black mb-2">Your Dashboard</h1>
            <p className="text-sm text-white/50">{userEmail}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/game')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 transition-all"
            >
              <Home className="w-4 h-4" /> Back to Game
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Intelligence Level Card */}
          <div className="bg-white/4 border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all">
            <h2 className="text-lg font-bold text-white/80 mb-6">Sudoku Intelligence Level</h2>
            <div className="text-center">
              <p className="text-sm text-white/50 mb-3">Your Rating</p>
              <div className="text-6xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent my-4">
                {stats.rating}
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/30 px-6 py-2 rounded-xl inline-block text-sm font-bold text-indigo-300 mb-6">
                {stats.rating >= 2000 ? 'Expert' : stats.rating >= 1800 ? 'Advanced Solver' : stats.rating >= 1500 ? 'Intermediate' : 'Beginner'}
              </div>
              <div className="flex justify-around gap-2 mt-6">
                <div className="flex-1 bg-white/2 rounded-lg p-3">
                  <div className="text-2xl font-bold text-indigo-400">{stats.totalGames}</div>
                  <div className="text-xs text-white/40 mt-1 uppercase tracking-wide">Games</div>
                </div>
                <div className="flex-1 bg-white/2 rounded-lg p-3">
                  <div className="text-2xl font-bold text-indigo-400">{Math.floor(stats.bestTime / 60)}:{(stats.bestTime % 60).toString().padStart(2, '0')}</div>
                  <div className="text-xs text-white/40 mt-1 uppercase tracking-wide">Best Time</div>
                </div>
                <div className="flex-1 bg-white/2 rounded-lg p-3">
                  <div className="text-2xl font-bold text-indigo-400">{Math.round(stats.winRate)}%</div>
                  <div className="text-xs text-white/40 mt-1 uppercase tracking-wide">Win Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white/4 border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all">
            <h2 className="text-lg font-bold text-white/80 mb-6">Current Stats</h2>
            <div className="space-y-4">
              {[
                { label: 'Accuracy', value: `${Math.round(stats.accuracy)}%`, color: 'text-green-400', width: `${stats.accuracy}%` },
                { label: 'Win Rate', value: `${Math.round(stats.winRate)}%`, color: 'text-indigo-400', width: `${stats.winRate}%` },
                { label: 'Streak', value: `${stats.currentStreak} days 🔥`, color: 'text-amber-400', width: `${Math.min(stats.currentStreak * 10, 100)}%` }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">{stat.label}</span>
                    <span className={`font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
          <div className="bg-white/4 border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all">
            <h2 className="text-lg font-bold text-white/80 mb-6">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Total Games</span>
                <span className="text-xl font-bold">{stats.totalGames}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Avg Time</span>
                <span className="text-xl font-bold">{Math.floor(stats.avgTime / 60)}:{(stats.avgTime % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Best Streak</span>
                <span className="text-xl font-bold">{stats.bestStreak} days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white/4 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-lg font-bold text-white/80 mb-6">Activity Heatmap (Last 12 Months)</h2>
          <div className="space-y-4">
            <HeatmapGrid heatmapData={heatmapData} />
            <HeatmapLegend />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white/4 border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-white/80 mb-6">Rating Progress Over Time</h2>
          <div style={{ position: 'relative', height: '300px' }}>
            <canvas id="progressChart" />
          </div>
        </div>
      </div>
    </div>
  );
}
