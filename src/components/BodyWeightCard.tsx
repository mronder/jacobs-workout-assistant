import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react';
import { loadBodyWeightHistory, saveBodyWeight, type BodyWeightEntry } from '../services/bodyWeight';
import { computeRollingAverage, computeTrend, type RollingAvgPoint, type TrendDirection } from '../utils/rollingAverage';

interface BodyWeightCardProps {
  planId: string | null;
  defaultUnit?: 'lbs' | 'kg';
}

export default function BodyWeightCard({ planId, defaultUnit = 'lbs' }: BodyWeightCardProps) {
  const [entries, setEntries] = useState<BodyWeightEntry[]>([]);
  const [rollingData, setRollingData] = useState<RollingAvgPoint[]>([]);
  const [trend, setTrend] = useState<{ direction: TrendDirection; change: number }>({ direction: 'stable', change: 0 });
  const [expanded, setExpanded] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(defaultUnit);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadBodyWeightHistory(90).then(data => {
      setEntries(data);
      const rolling = computeRollingAverage(data);
      setRollingData(rolling);
      setTrend(computeTrend(rolling));
    }).catch((err) => console.error('Failed to load body weight history:', err));
  }, []);

  const handleSave = async () => {
    const w = parseFloat(weightInput);
    if (!w || w <= 0) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await saveBodyWeight(w, unit);
      setWeightInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      // Refresh data
      const data = await loadBodyWeightHistory(90);
      setEntries(data);
      const rolling = computeRollingAverage(data);
      setRollingData(rolling);
      setTrend(computeTrend(rolling));
    } catch (err) {
      console.error('Body weight save failed:', err);
      setError('Failed to save. Check your connection and try again.');
      setTimeout(() => setError(null), 5000);
    }
    setSaving(false);
  };

  // Draw chart on canvas
  useEffect(() => {
    if (!canvasRef.current || rollingData.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 10, right: 10, bottom: 20, left: 35 };

    ctx.clearRect(0, 0, w, h);

    const allWeights = rollingData.map(p => p.raw);
    const avgWeights = rollingData.filter(p => p.average !== null).map(p => p.average!);
    const allVals = [...allWeights, ...avgWeights];
    const minW = Math.min(...allVals) - 2;
    const maxW = Math.max(...allVals) + 2;
    const range = maxW - minW || 1;

    const xScale = (i: number) => pad.left + (i / (rollingData.length - 1)) * (w - pad.left - pad.right);
    const yScale = (v: number) => pad.top + (1 - (v - minW) / range) * (h - pad.top - pad.bottom);

    // Y-axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'right';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minW + (range * i) / steps;
      const y = yScale(val);
      ctx.fillText(Math.round(val).toString(), pad.left - 5, y + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Raw data points (dots)
    for (let i = 0; i < rollingData.length; i++) {
      const x = xScale(i);
      const y = yScale(rollingData[i].raw);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,122,26,0.3)';
      ctx.fill();
    }

    // Rolling average line
    const avgPoints = rollingData.filter(p => p.average !== null);
    if (avgPoints.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let started = false;
      for (let i = 0; i < rollingData.length; i++) {
        if (rollingData[i].average === null) continue;
        const x = xScale(i);
        const y = yScale(rollingData[i].average!);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // X-axis dates (first and last)
    ctx.fillStyle = '#52525b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    const firstDate = new Date(rollingData[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(firstDate, pad.left, h - 2);
    ctx.textAlign = 'right';
    const lastDate = new Date(rollingData[rollingData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(lastDate, w - pad.right, h - 2);
  }, [rollingData, expanded]);

  const latestWeight = entries.length > 0 ? entries[entries.length - 1].weight : null;
  const latestAvg = rollingData.length > 0 && rollingData[rollingData.length - 1].average;

  const trendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend.direction === 'stable' ? 'text-zinc-400' : Math.abs(trend.change) < 1 ? 'text-amber-400' : trend.direction === 'down' ? 'text-green-400' : 'text-red-400';

  const TrendIcon = trendIcon;

  return (
    <div className="bg-surface-1 rounded-[24px] overflow-hidden shadow-card border border-white/8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-surface-3/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center">
            <Scale className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Body Weight</p>
            <div className="flex items-center gap-2">
              {latestWeight !== null ? (
                <>
                  <span className="text-sm font-bold">{latestWeight} {unit}</span>
                  {latestAvg && (
                    <span className="text-[10px] text-zinc-500 font-mono">avg {latestAvg}</span>
                  )}
                </>
              ) : (
                <span className="text-sm text-zinc-500">No entries yet</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {latestWeight !== null && (
            <span className={`flex items-center gap-1 text-[11px] font-bold ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.change !== 0 ? `${trend.change > 0 ? '+' : ''}${trend.change}` : '—'}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Quick Entry */}
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="Weight"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  className="flex-1 bg-ground/60 border border-border-subtle rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors min-h-[44px] text-center"
                />
                <button
                  onClick={() => setUnit(u => u === 'lbs' ? 'kg' : 'lbs')}
                  className="bg-surface-3 hover:bg-elevated px-3 py-3 rounded-xl text-xs font-bold text-orange-500 transition-colors cursor-pointer min-h-[44px]"
                >
                  {unit}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!weightInput || saving}
                  className={`${saveSuccess ? 'bg-green-500' : 'bg-orange-500'} text-black font-bold px-4 py-3 rounded-xl text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]`}
                >
                  {saving ? '...' : saveSuccess ? '✓' : 'Log'}
                </button>
              </div>
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
              {saveSuccess && entries.length <= 1 && (
                <p className="text-xs text-green-400/80 text-center">Logged! Add entries over the next few days to see your trend chart.</p>
              )}

              {/* Chart */}
              {rollingData.length >= 2 ? (
                <div className="rounded-xl bg-ground/40 border border-white/5 p-2">
                  <canvas ref={canvasRef} className="w-full" style={{ height: 140 }} />
                </div>
              ) : entries.length === 1 ? (
                <div className="rounded-xl bg-ground/40 border border-white/5 px-4 py-6 text-center">
                  <p className="text-sm font-bold text-orange-200">Today: {entries[0].weight} {entries[0].unit}</p>
                  <p className="text-xs text-zinc-500 mt-1">More entries will unlock your trend chart</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
