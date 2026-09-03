import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RGA } from '../../../src/crdt/RGA';
import type { Op } from '../../../src/crdt/types';
import { History, Play, Pause, RotateCcw, Clock, ArrowLeft, FastForward } from 'lucide-react';

interface OpHistoryItem {
  id: number;
  doc_id: string;
  payload: Op;
  created_at: string;
}

interface TimeTravelPanelProps {
  docId: string;
  serverUrl: string;
  onExit: () => void;
}

export const TimeTravelPanel: React.FC<TimeTravelPanelProps> = ({
  docId,
  serverUrl,
  onExit,
}) => {
  const [historyOps, setHistoryOps] = useState<OpHistoryItem[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [historicalText, setHistoricalText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch full operation history from backend REST API
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const httpUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      const res = await fetch(`${httpUrl}/api/docs/${docId}/history`);
      const data = await res.json();

      if (data.ops) {
        setHistoryOps(data.ops);
        setCurrentStep(data.ops.length);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [docId, serverUrl]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Compute RGA state at currentStep
  useEffect(() => {
    if (historyOps.length === 0) {
      setHistoricalText('');
      return;
    }

    const rga = new RGA();
    const opsSlice = historyOps.slice(0, currentStep).map((item) => item.payload);
    rga.applyAll(opsSlice);
    setHistoricalText(rga.toString());
  }, [currentStep, historyOps]);

  // Handle Play/Pause Auto Playback
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= historyOps.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 150); // Advance 1 step every 150ms
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, historyOps.length]);

  const currentOp = currentStep > 0 && currentStep <= historyOps.length ? historyOps[currentStep - 1] : null;

  return (
    <div className="bg-[#161b22] border border-[#58a6ff]/40 rounded-lg p-4 space-y-4 shadow-2xl font-mono-code">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-3 text-xs">
        <div className="flex items-center gap-2 text-[#58a6ff] font-semibold">
          <History className="w-4 h-4 animate-spin-slow" />
          <span>Time-Travel History Replay (Event Sourcing)</span>
        </div>

        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded border border-[#30363d] transition-all text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Time Travel</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-[#8b949e] flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin" />
          <span>Loading historical operation log...</span>
        </div>
      ) : historyOps.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#8b949e]">
          No operation history found for document <span className="text-[#c9d1d9]">{docId}</span>. Type some text first!
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-4 bg-[#0d1117] p-3 rounded border border-[#30363d]">
            {/* Playback buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(0)}
                title="Rewind to Start"
                className="p-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold text-xs transition-all ${
                  isPlaying
                    ? 'bg-[#d29922] text-slate-950 hover:bg-[#b88319]'
                    : 'bg-[#1f6feb] text-white hover:bg-[#388bfd]'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
              </button>

              <button
                onClick={() => setCurrentStep(historyOps.length)}
                title="Fast-Forward to Present"
                className="p-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9]"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Count Telemetry */}
            <div className="text-xs text-[#8b949e]">
              Step <span className="font-bold text-[#58a6ff]">{currentStep}</span> / {historyOps.length} Ops
            </div>
          </div>

          {/* Scrubbing Range Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={historyOps.length}
              value={currentStep}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStep(parseInt(e.target.value, 10));
              }}
              className="w-full h-2 bg-[#0d1117] rounded-lg appearance-none cursor-pointer accent-[#58a6ff] border border-[#30363d]"
            />
            <div className="flex justify-between text-[10px] text-[#484f58]">
              <span>Doc Created (Step 0)</span>
              <span>Present (Step {historyOps.length})</span>
            </div>
          </div>

          {/* Historical Document Preview Box */}
          <div className="space-y-1">
            <div className="text-[11px] text-[#8b949e] flex items-center justify-between">
              <span>Historical Document State at Step {currentStep}:</span>
              {currentOp && (
                <span className="text-[#a5d6ff] text-[10px]">
                  Op #{currentOp.id}: {currentOp.payload.type} val='{currentOp.payload.type === 'insert' ? currentOp.payload.value : ''}' ({new Date(currentOp.created_at).toLocaleTimeString()})
                </span>
              )}
            </div>
            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded font-mono-code text-xs text-[#3fb950] min-h-[80px] leading-relaxed whitespace-pre-wrap select-text">
              {historicalText || <span className="text-[#484f58] italic">(empty document at this step)</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
