import { useState } from 'react';
import { useCRDT } from './hooks/useCRDT';
import { Navbar } from './components/Navbar';
import { Editor } from './components/Editor';
import { CRDTInspector } from './components/CRDTInspector';
import { TimeTravelPanel } from './components/TimeTravelPanel';
import { Cpu, Zap, Activity, ShieldAlert, BookOpen, Layers } from 'lucide-react';

export function App() {
  const [serverUrl] = useState<string>('ws://localhost:3000');
  const [isTimeTravelActive, setIsTimeTravelActive] = useState<boolean>(false);

  const {
    docId,
    setDocId,
    status,
    docText,
    nodesView,
    opCount,
    tombstoneCount,
    visibleLength,
    clientId,
    updateClientId,
    stateVectorView,
    queuedOpsCount,
    isSimulatedOffline,
    toggleSimulatedOffline,
    insertChar,
    deleteChar,
    reconnect,
  } = useCRDT('demo-doc', serverUrl);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex flex-col font-sans selection:bg-[#264f78] selection:text-white">
      {/* Top Bar */}
      <Navbar
        docId={docId}
        onDocIdChange={setDocId}
        status={status}
        clientId={clientId}
        onUpdateClientId={updateClientId}
        onReconnect={reconnect}
        isSimulatedOffline={isSimulatedOffline}
        onToggleOffline={toggleSimulatedOffline}
        queuedOpsCount={queuedOpsCount}
        isTimeTravelActive={isTimeTravelActive}
        onToggleTimeTravel={() => setIsTimeTravelActive(!isTimeTravelActive)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 flex flex-col gap-4">
        {/* Telemetry Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 select-none">
          <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <Activity className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>Applied Ops</span>
            </div>
            <span className="font-mono-code font-bold text-xs text-[#c9d1d9]">{opCount}</span>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <Zap className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>Visible Chars</span>
            </div>
            <span className="font-mono-code font-bold text-xs text-[#c9d1d9]">{visibleLength}</span>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#f85149]" />
              <span>Tombstones</span>
            </div>
            <span className="font-mono-code font-bold text-xs text-[#c9d1d9]">{tombstoneCount}</span>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <Layers className="w-3.5 h-3.5 text-[#d29922]" />
              <span>Offline Queue</span>
            </div>
            <span className={`font-mono-code font-bold text-xs ${queuedOpsCount > 0 ? 'text-[#f85149]' : 'text-[#c9d1d9]'}`}>
              {queuedOpsCount} ops
            </span>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <Cpu className="w-3.5 h-3.5 text-[#a5d6ff]" />
              <span>Engine Protocol</span>
            </div>
            <span className="font-mono-code font-semibold text-[11px] text-[#58a6ff]">State Vector Sync</span>
          </div>
        </div>

        {/* Time-Travel Replay Panel (Collapsible) */}
        {isTimeTravelActive && (
          <TimeTravelPanel
            docId={docId}
            serverUrl={serverUrl}
            onExit={() => setIsTimeTravelActive(false)}
          />
        )}

        {/* State Vector Inspection Pill */}
        <div className="bg-[#161b22]/70 border border-[#30363d] px-3 py-2 rounded-md flex items-center justify-between text-xs font-mono-code">
          <div className="flex items-center gap-2 text-[#8b949e]">
            <span className="text-[#a5d6ff] font-bold">State Vector (Version Matrix):</span>
            <span className="text-[#c9d1d9]">
              {JSON.stringify(stateVectorView)}
            </span>
          </div>
          <div className="text-[11px] text-[#8b949e]">
            Used for O(delta) reconnection sync
          </div>
        </div>

        {/* Dual Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[580px]">
          {/* Left Pane: Collaborative Text Editor (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <Editor
              docText={docText}
              onInsertChar={insertChar}
              onDeleteChar={deleteChar}
              disabled={false}
              docId={docId}
            />
          </div>

          {/* Right Pane: DevTools Memory CRDT Inspector (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <CRDTInspector nodes={nodesView} />
          </div>
        </div>

        {/* Technical Architecture Footer */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-3 text-xs text-[#8b949e] flex flex-wrap items-center justify-between gap-2 font-mono-code">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#58a6ff]" />
            <span>Event Sourcing Engine: Historical Replay & State Vector Delta Sync Active</span>
          </div>
          <div className="text-[11px] text-[#484f58]">
            State(T) = Replay( {`ops <= T`} )
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
