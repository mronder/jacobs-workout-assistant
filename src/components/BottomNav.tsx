import { Dumbbell, History } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'workouts' | 'history';
  onTabChange: (tab: 'workouts' | 'history') => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-ground/82 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-2 rounded-[26px] border border-white/8 bg-white/4 p-2 shadow-card">
        <button
          onClick={() => onTabChange('workouts')}
          className={`relative flex flex-col items-center gap-1 rounded-[20px] py-3 transition-all cursor-pointer ${
            currentTab === 'workouts' ? 'text-black bg-gradient-to-r from-orange-300 to-orange-500 shadow-lg shadow-orange-500/15' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/4'
          }`}
        >
          <Dumbbell className="w-6 h-6 relative" />
          <span className="text-[11px] font-semibold uppercase tracking-wider relative">Workouts</span>
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={`relative flex flex-col items-center gap-1 rounded-[20px] py-3 transition-all cursor-pointer ${
            currentTab === 'history' ? 'text-black bg-gradient-to-r from-orange-300 to-orange-500 shadow-lg shadow-orange-500/15' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/4'
          }`}
        >
          <History className="w-6 h-6 relative" />
          <span className="text-[11px] font-semibold uppercase tracking-wider relative">History</span>
        </button>
        </div>
      </div>
    </nav>
  );
}
