import React, { useState } from 'react';
import type { CRDTNodeView } from '../hooks/useCRDT';
import { RGA } from '../../../src/crdt/RGA';
import { GitCommit, Eye, EyeOff, Search, Cpu } from 'lucide-react';

interface CRDTInspectorProps {
  nodes: CRDTNodeView[];
}

export const CRDTInspector: React.FC<CRDTInspectorProps> = ({ nodes }) => {
  const [showTombstones, setShowTombstones] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredNodes = nodes.filter((n) => {
    if (!showTombstones && n.isDeleted) return false;
    if (!searchTerm) return true;
    const idStr = RGA.serializeId(n.id).toLowerCase();
    const originStr = RGA.serializeId(n.originId ?? { clientId: '__root__', counter: -1 }).toLowerCase();
    return idStr.includes(searchTerm.toLowerCase()) || originStr.includes(searchTerm.toLowerCase()) || n.value.includes(searchTerm);
  });

  const activeNodesCount = nodes.filter((n) => !n.isDeleted && n.id.clientId !== '__root__').length;
  const tombstoneCount = nodes.filter((n) => n.isDeleted && n.id.clientId !== '__root__').length;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden shadow-lg">
      {/* DevTools Style Header */}
      <div className="flex items-center justify-between bg-[#161b22] border-b border-[#30363d] px-3 h-9 select-none text-xs font-mono-code">
        <div className="flex items-center gap-2 bg-[#0d1117] border-t-2 border-t-[#a5d6ff] border-x border-[#30363d] px-3 py-1.5 text-[#c9d1d9] rounded-t-sm">
          <GitCommit className="w-3.5 h-3.5 text-[#a5d6ff]" />
          <span>CRDT State Inspector</span>
        </div>

        <button
          onClick={() => setShowTombstones(!showTombstones)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono-code transition-all ${
            showTombstones
              ? 'bg-[#21262d] text-[#58a6ff] border border-[#30363d]'
              : 'bg-transparent text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          {showTombstones ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Tombstones ({tombstoneCount})</span>
        </button>
      </div>

      {/* DevTools Toolbar Stats & Filter */}
      <div className="bg-[#161b22]/50 px-3 py-2 border-b border-[#21262d] flex items-center justify-between gap-3 text-[11px] font-mono-code">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#8b949e] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by node ID or origin..."
            className="w-full pl-8 pr-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>
        <div className="flex items-center gap-2 text-[#8b949e]">
          <Cpu className="w-3.5 h-3.5 text-[#a5d6ff]" />
          <span>{activeNodesCount} active</span>
          <span>/</span>
          <span className="text-[#f85149]">{tombstoneCount} tombstones</span>
        </div>
      </div>

      {/* RGA Memory Array Node List */}
      <div className="flex-1 overflow-y-auto max-h-[460px] font-mono-code text-[11px] p-2 space-y-1 select-text">
        {filteredNodes.map((node) => {
          const idStr = RGA.serializeId(node.id);
          const originStr = RGA.serializeId(node.originId ?? { clientId: '__root__', counter: -1 });
          const isRoot = node.id.clientId === '__root__';

          return (
            <div
              key={idStr}
              className={`flex items-center justify-between px-3 py-1.5 rounded border transition-all ${
                isRoot
                  ? 'bg-[#090d16] border-[#21262d] text-[#8b949e]'
                  : node.isDeleted
                  ? 'bg-[#271010]/30 border-[#491616] text-[#f85149]/70'
                  : 'bg-[#161b22] border-[#30363d] text-[#c9d1d9] hover:border-[#58a6ff]/40'
              }`}
            >
              {/* Node ID & Origin */}
              <div className="flex items-center gap-3">
                <span className="font-mono-code font-bold text-[#58a6ff]">
                  {isRoot ? '⚓ [ROOT]' : idStr}
                </span>

                {!isRoot && (
                  <span className="text-[#8b949e] text-[10px]">
                    after: <span className="text-[#c9d1d9]">{originStr}</span>
                  </span>
                )}
              </div>

              {/* Status Badge & Character Value */}
              <div className="flex items-center gap-2">
                {node.isDeleted && !isRoot ? (
                  <span className="px-1.5 py-0.2 rounded bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 text-[9px] font-semibold">
                    TOMBSTONE
                  </span>
                ) : !isRoot ? (
                  <span className="px-1.5 py-0.2 rounded bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20 text-[9px] font-semibold">
                    ACTIVE
                  </span>
                ) : null}

                <span
                  className={`px-2 py-0.5 rounded font-mono-code font-bold ${
                    isRoot
                      ? 'bg-[#21262d] text-[#8b949e]'
                      : node.isDeleted
                      ? 'bg-[#3c1e1e] text-[#f85149] line-through'
                      : 'bg-[#1f6feb]/20 text-[#79c0ff] border border-[#1f6feb]/40'
                  }`}
                >
                  {isRoot ? 'START' : node.value === '\n' ? '↵ newline' : node.value === ' ' ? '␣ space' : `'${node.value}'`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
