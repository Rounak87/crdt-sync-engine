import React, { useState } from 'react';
import type { ConnectionStatus } from '../hooks/useCRDT';
import { ExternalLink, Copy, Check, Terminal, Users, WifiOff, Wifi, History, Edit2 } from 'lucide-react';

interface NavbarProps {
  docId: string;
  onDocIdChange: (newId: string) => void;
  status: ConnectionStatus;
  clientId: string;
  onUpdateClientId: (newId: string) => void;
  onReconnect: () => void;
  isSimulatedOffline: boolean;
  onToggleOffline: () => void;
  queuedOpsCount: number;
  isTimeTravelActive: boolean;
  onToggleTimeTravel: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  docId,
  onDocIdChange,
  status,
  clientId,
  onUpdateClientId,
  isSimulatedOffline,
  onToggleOffline,
  queuedOpsCount,
  isTimeTravelActive,
  onToggleTimeTravel,
}) => {
  const [editingDocId, setEditingDocId] = useState(docId);
  const [editingUserId, setEditingUserId] = useState(clientId);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDocId.trim() && editingDocId !== docId) {
      onDocIdChange(editingDocId.trim());
    }
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId.trim()) {
      onUpdateClientId(editingUserId.trim());
      setIsEditingUser(false);
    }
  };

  const copyDocLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenDuplicateTab = () => {
    window.open(window.location.href, '_blank');
  };

  const getClientColor = (id: string) => {
    const colors = [
      'bg-blue-500 text-white',
      'bg-emerald-500 text-white',
      'bg-purple-500 text-white',
      'bg-amber-500 text-slate-950',
      'bg-rose-500 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <header className="h-14 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between gap-4 text-xs select-none">
      {/* Left: Notion-style Breadcrumb & Document ID */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[#8b949e] font-mono-code text-[11px]">
          <Terminal className="w-4 h-4 text-[#58a6ff]" />
          <span>crdt-sync</span>
          <span>/</span>
        </div>

        <form onSubmit={handleDocSubmit} className="flex items-center">
          <input
            type="text"
            value={editingDocId}
            onChange={(e) => setEditingDocId(e.target.value)}
            onBlur={handleDocSubmit}
            placeholder="document-id"
            className="bg-transparent font-mono-code text-xs font-semibold text-[#c9d1d9] px-2 py-1 rounded hover:bg-[#21262d] focus:bg-[#0d1117] focus:outline-none border border-transparent focus:border-[#58a6ff] transition-all w-32 sm:w-44"
          />
        </form>
      </div>

      {/* Middle: Active Session Avatar & Persistent Client ID */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1117] border border-[#30363d]">
        <Users className="w-3.5 h-3.5 text-[#8b949e]" />
        <span className="text-[11px] text-[#8b949e]">Session:</span>

        {isEditingUser ? (
          <form onSubmit={handleUserSubmit} className="flex items-center">
            <input
              type="text"
              value={editingUserId}
              onChange={(e) => setEditingUserId(e.target.value)}
              onBlur={handleUserSubmit}
              autoFocus
              className="bg-[#161b22] border border-[#58a6ff] text-[11px] font-mono text-[#c9d1d9] px-1.5 py-0.5 rounded outline-none w-28"
            />
          </form>
        ) : (
          <div
            onClick={() => setIsEditingUser(true)}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-all"
            title="Click to change your User ID"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${getClientColor(clientId)} border border-[#30363d]`}
            >
              {clientId.slice(-2).toUpperCase()}
            </div>
            <span className="text-[11px] font-mono text-[#c9d1d9] font-medium ml-1">
              {clientId}
            </span>
            <Edit2 className="w-3 h-3 text-[#8b949e] ml-1 opacity-60" />
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Time Travel Button */}
        <button
          onClick={onToggleTimeTravel}
          title="Toggle Event Sourcing Time Travel Replay"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono-code border transition-all ${
            isTimeTravelActive
              ? 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/40 shadow-sm'
              : 'bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d]'
          }`}
        >
          <History className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span>Time Travel</span>
        </button>

        {/* Offline Mode Toggle Button */}
        <button
          onClick={onToggleOffline}
          title={isSimulatedOffline ? 'Go Online & Sync' : 'Simulate Offline Disconnect'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono-code border transition-all ${
            isSimulatedOffline
              ? 'bg-[#f85149]/20 text-[#f85149] border-[#f85149]/40 hover:bg-[#f85149]/30'
              : 'bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d]'
          }`}
        >
          {isSimulatedOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline ({queuedOpsCount} queued)</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>Simulate Offline</span>
            </>
          )}
        </button>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] text-[11px] font-mono-code">
          <span
            className={`w-2 h-2 rounded-full ${
              isSimulatedOffline
                ? 'bg-[#f85149]'
                : status === 'connected'
                ? 'bg-[#3fb950] animate-pulse'
                : status === 'connecting'
                ? 'bg-[#d29922] animate-ping'
                : 'bg-[#f85149]'
            }`}
          />
          <span className="text-[#c9d1d9]">
            {isSimulatedOffline ? 'OFFLINE' : status === 'connected' ? 'LIVE SYNC' : status.toUpperCase()}
          </span>
        </div>

        {/* Copy Share Link */}
        <button
          onClick={copyDocLink}
          title="Copy Document URL"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-all text-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#3fb950]" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
        </button>

        {/* Test 2nd Tab */}
        <button
          onClick={handleOpenDuplicateTab}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-medium transition-all text-xs shadow-sm"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Test 2nd Tab</span>
        </button>
      </div>
    </header>
  );
};
