import React from 'react';
import { Activity, ShieldCheck, Zap, Database } from 'lucide-react';

interface StatsCardProps {
  opCount: number;
  visibleLength: number;
  tombstoneCount: number;
  docId: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  opCount,
  visibleLength,
  tombstoneCount,
  docId,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Metric 1: Total Ops */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Applied Ops</div>
          <div className="text-base font-bold font-mono text-slate-100">{opCount}</div>
        </div>
      </div>

      {/* Metric 2: Visible Chars */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Visible Chars</div>
          <div className="text-base font-bold font-mono text-slate-100">{visibleLength}</div>
        </div>
      </div>

      {/* Metric 3: Tombstones */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Tombstones</div>
          <div className="text-base font-bold font-mono text-slate-100">{tombstoneCount}</div>
        </div>
      </div>

      {/* Metric 4: Room ID */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Doc Room</div>
          <div className="text-xs font-bold font-mono text-slate-100 truncate max-w-[100px]">
            {docId}
          </div>
        </div>
      </div>
    </div>
  );
};
