import { useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (mode === 'signup' && password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: authErr } = await signIn(email, password);
        if (authErr) setError(authErr);
      } else {
        const { error: authErr } = await signUp(email, password);
        if (authErr) setError(authErr);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-12 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-orange-500/16 blur-[120px]" />
        <div className="absolute right-[-80px] top-24 h-64 w-64 rounded-full bg-amber-200/8 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ground via-ground/85 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 rounded-[28px] border border-white/8 bg-white/4 p-4 backdrop-blur-sm shadow-card">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <Dumbbell className="w-7 h-7 text-black" />
                </div>
                <motion.div
                  className="absolute -inset-2 rounded-[24px] border border-orange-300/30"
                  animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.32em] text-orange-200/70 mb-1">Adaptive Training</p>
                <h1 className="font-bold text-2xl leading-none tracking-tight">
                  JACOB<span className="text-orange-400">'S</span>
                </h1>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  A sharper gym companion for AI-built programs, workout execution, and weekly progression.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Plans</p>
              <p className="text-sm font-bold text-orange-200">Adaptive</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Tracking</p>
              <p className="text-sm font-bold text-orange-200">Gym-first</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Flow</p>
              <p className="text-sm font-bold text-orange-200">Fast</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-surface-1/88 p-6 shadow-card backdrop-blur-xl">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.26em] text-orange-200">
              {mode === 'login' ? 'Resume Training' : 'Start Fresh'}
            </div>
            <h2 className="text-3xl font-bold tracking-tight mt-4 mb-2">
              {mode === 'login' ? 'Welcome back to the grind.' : 'Build your training HQ.'}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {mode === 'login'
                ? 'Get back into your plan, continue your active workout, and keep your weekly momentum intact.'
                : 'Create an account to save plans, track sessions, and keep your workout history synced.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-border-subtle bg-ground/60 pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border-subtle bg-ground/60 pl-11 pr-11 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative"
              >
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-border-subtle bg-ground/60 pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  autoComplete="new-password"
                />
              </motion.div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-red-200 text-xs"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 hover:from-orange-300 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm py-3.5 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'Log In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span>{mode === 'login' ? 'Need an account?' : 'Already registered?'}</span>
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="text-orange-300 font-bold hover:text-orange-200 transition-colors cursor-pointer"
            >
              {mode === 'login' ? 'Create one' : 'Log in instead'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
