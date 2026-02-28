import { motion } from 'motion/react';
import { Upload, X, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface MigrationPromptProps {
  onImport: () => Promise<void>;
  onSkip: () => void;
}

export default function MigrationPrompt({ onImport, onSkip }: MigrationPromptProps) {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      await onImport();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 max-w-sm w-full">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-orange-500" />
        </div>

        <h3 className="text-lg font-black tracking-tight mb-2">Existing Data Found</h3>
        <p className="text-zinc-400 text-sm mb-6">
          We found a workout plan saved on this device. Would you like to import it into your
          account so it syncs across devices?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            disabled={loading}
            className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Skip
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex-1 bg-orange-500 hover:bg-orange-400 text-black text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import
          </button>
        </div>
      </div>
    </motion.div>
  );
}
