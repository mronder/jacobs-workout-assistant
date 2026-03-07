import { Dumbbell, History } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'workouts' | 'history';
  onTabChange: (tab: 'workouts' | 'history') => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-ground/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        <button
          onClick={() => onTabChange('workouts')}
          className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-colors cursor-pointer ${
            currentTab === 'workouts' ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {currentTab === 'workouts' && (
            <div className="absolute top-0 w-12 h-0.5 bg-orange-500 rounded-full" />
          )}
          {currentTab === 'workouts' && (
            <div className="absolute inset-x-4 top-1 bottom-1 bg-orange-500/8 rounded-lg" />
          )}
          <Dumbbell className="w-6 h-6 relative" />
          <span className="text-[11px] font-semibold uppercase tracking-wider relative">Workouts</span>
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-colors cursor-pointer ${
            currentTab === 'history' ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {currentTab === 'history' && (
            <div className="absolute top-0 w-12 h-0.5 bg-orange-500 rounded-full" />
          )}
          {currentTab === 'history' && (
            <div className="absolute inset-x-4 top-1 bottom-1 bg-orange-500/8 rounded-lg" />
          )}
          <History className="w-6 h-6 relative" />
          <span className="text-[11px] font-semibold uppercase tracking-wider relative">History</span>
        </button>
      </div>
    </nav>
  );
}
