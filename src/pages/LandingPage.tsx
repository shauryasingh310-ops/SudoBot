import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize particles
    const initialParticles = Array.from({ length: 100 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.06,
      vy: -(Math.random() * 0.08 + 0.02),
      r: Math.random() * 1.6 + 0.4,
      alpha: Math.random() * 0.35 + 0.08
    }));

    // Canvas animation
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      initialParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
        p.x += p.vx * 0.003;
        p.y += p.vy * 0.003;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-hidden relative flex items-center justify-center">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
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

      {/* Content */}
      <div className="relative z-10 max-w-2xl text-center px-6 py-12">
        {/* Logo */}
        <div className="mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-white/20">
            <svg viewBox="0 0 18 18" fill="none" stroke="#080808" strokeWidth="1.2" className="w-10 h-10">
              <rect x="1" y="1" width="5" height="5" rx="0.5" fill="#080808" />
              <rect x="7" y="1" width="5" height="5" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="13" y="1" width="5" height="5" rx="0.5" fill="#080808" />
              <rect x="1" y="7" width="5" height="5" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="7" y="7" width="5" height="5" rx="0.5" fill="#080808" />
              <rect x="13" y="7" width="5" height="5" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="1" y="13" width="5" height="5" rx="0.5" fill="#080808" />
              <rect x="7" y="13" width="5" height="5" rx="0.5" fill="none" stroke="#080808" strokeWidth="1" />
              <rect x="13" y="13" width="5" height="5" rx="0.5" fill="#080808" />
            </svg>
          </div>
          <h2 className="text-5xl font-black tracking-tighter mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            SudoBot
          </h2>
          <p className="text-lg text-white/50">Sudoku Solver • Image Recognition • AI Assistance</p>
        </div>

        {/* Hero Section */}
        <div className="mb-20 animate-in fade-in slide-in-from-top-4 duration-700 delay-100">
          <h1 className="text-6xl font-black mb-6 leading-tight">Solve Sudoku Like Never Before</h1>
          <p className="text-xl text-white/60 max-w-xl mx-auto mb-12 leading-relaxed">
            Upload a photo, let AI recognize the puzzle, and watch as it solves in real-time. Perfect for learning, practicing, or just having fun with Sudoku.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          {[
            { emoji: '📸', title: 'Image Upload', desc: 'Capture Sudoku photos and let AI detect the grid automatically' },
            { emoji: '🤖', title: 'AI Solving', desc: 'Watch as algorithms solve puzzles step-by-step' },
            { emoji: '✏️', title: 'Pencil Mode', desc: 'Mark candidates and track your solving process' },
            { emoji: '⏱️', title: 'Timer & Stats', desc: 'Track your progress with real-time timing and metrics' }
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl background: rgba(255,255,255,0.04) border border-white/10 backdrop-blur-md hover:bg-white/8 hover:border-white/25 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">{feature.emoji}</div>
              <h3 className="font-bold text-base mb-2">{feature.title}</h3>
              <p className="text-xs text-white/50">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <button
            onClick={() => navigate('/login')}
            className="px-10 py-4 bg-white text-black rounded-2xl font-bold text-lg shadow-lg shadow-white/15 hover:-translate-y-1 hover:shadow-white/25 transition-all duration-300 active:translate-y-0"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate('/login?mode=signup')}
            className="px-10 py-4 bg-white/10 border border-white/30 text-white rounded-2xl font-bold text-lg hover:bg-white/15 hover:border-white/50 transition-all duration-300 hover:-translate-y-1 active:translate-y-0"
          >
            Create Account
          </button>
        </div>
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
