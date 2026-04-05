import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem('user-email', user.email || '');
        navigate('/game');
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      localStorage.setItem('user-email', email);
      setSuccessOverlay(true);
      setTimeout(() => navigate('/game'), 1500);
    } catch (err: any) {
      // Map Firebase error codes to user-friendly messages
      let errorMessage = 'Authentication failed';
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid Email or Password';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Try again later';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      localStorage.setItem('user-email', result.user.email || '');
      setSuccessOverlay(true);
      setTimeout(() => navigate('/game'), 1500);
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-hidden relative flex items-center justify-center">
      {/* Canvas */}
      <canvas
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ position: 'fixed', inset: 0 }}
      />

      {/* Grid Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          animation: 'gridDrift 30s linear infinite'
        }}
      />

      {/* Orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute"
          style={{
            width: '520px',
            height: '520px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(90px)',
            top: '-120px',
            left: '-120px',
            animation: 'drift1 14s ease-in-out infinite alternate'
          }}
        />
        <div
          className="absolute"
          style={{
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(90px)',
            bottom: '-100px',
            right: '-100px',
            animation: 'drift2 11s ease-in-out infinite alternate'
          }}
        />
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 p-12 rounded-3xl backdrop-blur-3xl"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset, 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,255,255,0.03)'
        }}
      >
        {/* Success Overlay */}
        {successOverlay && (
          <div
            className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center gap-3 z-20"
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <div className="w-14 h-14 border-2 border-white rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-bold text-lg">Welcome!</p>
            <p className="text-xs text-white/40">Redirecting to Sudoku…</p>
          </div>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 18 18" fill="none" stroke="#080808" strokeWidth="1.2" className="w-5 h-5">
              <rect x="2" y="2" width="4" height="4" rx="0.5" fill="#080808" />
              <rect x="7" y="2" width="4" height="4" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="12" y="2" width="4" height="4" rx="0.5" fill="#080808" />
              <rect x="2" y="7" width="4" height="4" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="7" y="7" width="4" height="4" rx="0.5" fill="#080808" />
              <rect x="12" y="7" width="4" height="4" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="2" y="12" width="4" height="4" rx="0.5" fill="#080808" />
              <rect x="7" y="12" width="4" height="4" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="12" y="12" width="4" height="4" rx="0.5" fill="#080808" />
            </svg>
          </div>
          <span className="font-black text-xl">SudoBot</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold mb-2">
          {isSignUp ? 'Create Account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-white/40 mb-8">
          {isSignUp ? 'Join us to play Sudoku' : 'Sign in to play Sudoku'}
        </p>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4 mb-6">
          {/* Email */}
          <div>
            <label className="text-xs font-medium text-white/40 uppercase tracking-widest block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:border-white/45 focus:bg-white/8 transition-all"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-white/40 uppercase tracking-widest block mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:border-white/45 focus:bg-white/8 transition-all pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {isSignUp && (
            <div>
              <label className="text-xs font-medium text-white/40 uppercase tracking-widest block mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:border-white/45 focus:bg-white/8 transition-all"
                required
              />
            </div>
          )}

          {/* Remember/Forgot (Sign In only) */}
          {!isSignUp && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/40 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" /> Remember me
              </label>
              <a href="#" className="text-white/50 hover:text-white transition-colors">Forgot password?</a>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black rounded-2xl font-bold shadow-lg shadow-white/15 hover:-translate-y-1 hover:shadow-white/25 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/20 uppercase tracking-widest">Or continue with</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 border border-white/10 rounded-2xl bg-white/5 hover:bg-white/10 hover:border-white/25 transition-all flex items-center justify-center gap-2 text-sm font-medium text-white/50 hover:text-white"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        {/* Toggle */}
        <p className="text-center text-sm text-white/30 mt-6">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-white/70 hover:text-white font-medium transition-colors"
          >
            {isSignUp ? 'Sign in' : 'Sign up free'}
          </button>
        </p>
      </div>

      <style>{`
        @keyframes drift1 {
          from { transform: translate(0, 0); }
          to { transform: translate(70px, 90px); }
        }
        @keyframes drift2 {
          from { transform: translate(0, 0); }
          to { transform: translate(-60px, -70px); }
        }
        @keyframes gridDrift {
          from { background-position: 0 0; }
          to { background-position: 48px 48px; }
        }
      `}</style>
    </div>
  );
}
