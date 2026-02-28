import { Dumbbell, History } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'workouts' | 'history';
  onTabChange: (tab: 'workouts' | 'history') => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-xl">
      <div className="max-w-lg mx-auto flex">
        <button
          onClick={() => onTabChange('workouts')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors cursor-pointer ${
            currentTab === 'workouts' ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Dumbbell className="w-5 h-5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Workouts</span>
          {currentTab === 'workouts' && (
            <div className="absolute top-0 w-12 h-0.5 bg-orange-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors cursor-pointer ${
            currentTab === 'history' ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">History</span>
          {currentTab === 'history' && (
            <div className="absolute top-0 w-12 h-0.5 bg-orange-500 rounded-full" />
          )}
        </button>
      </div>
    </nav>
  );
}
