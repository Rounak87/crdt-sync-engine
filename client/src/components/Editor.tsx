import React, { useRef, useEffect } from 'react';
import { FileCode, Activity } from 'lucide-react';

interface EditorProps {
  docText: string;
  onInsertChar: (char: string, visibleIndex: number) => void;
  onDeleteChar: (visibleIndex: number) => void;
  disabled?: boolean;
  docId: string;
}

export const Editor: React.FC<EditorProps> = ({
  docText,
  onInsertChar,
  onDeleteChar,
  disabled = false,
  docId,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTextRef = useRef<string>(docText);
  const cursorPosRef = useRef<number>(0);

  useEffect(() => {
    prevTextRef.current = docText;
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      const pos = cursorPosRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
    }
  }, [docText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    const prevText = prevTextRef.current;
    const selectionStart = e.target.selectionStart;

    if (nextText.length > prevText.length) {
      const diffLen = nextText.length - prevText.length;
      const insertIndex = selectionStart - diffLen;
      const insertedChars = nextText.slice(insertIndex, selectionStart);

      for (let i = 0; i < insertedChars.length; i++) {
        onInsertChar(insertedChars[i], insertIndex + i);
      }
      cursorPosRef.current = selectionStart;
    } else if (nextText.length < prevText.length) {
      const diffLen = prevText.length - nextText.length;
      const deleteIndex = selectionStart;

      for (let i = 0; i < diffLen; i++) {
        onDeleteChar(deleteIndex);
      }
      cursorPosRef.current = deleteIndex;
    } else {
      const replaceIndex = selectionStart - 1;
      if (replaceIndex >= 0) {
        onDeleteChar(replaceIndex);
        onInsertChar(nextText[replaceIndex], replaceIndex);
      }
      cursorPosRef.current = selectionStart;
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    cursorPosRef.current = target.selectionStart;
  };

  const lineCount = docText.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 16) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden shadow-lg">
      {/* VS Code Style Tab Header */}
      <div className="flex items-center justify-between bg-[#161b22] border-b border-[#30363d] px-3 h-9 select-none text-xs font-mono-code">
        <div className="flex items-center gap-2 bg-[#0d1117] border-t-2 border-t-[#58a6ff] border-x border-[#30363d] px-3 py-1.5 text-[#c9d1d9] rounded-t-sm">
          <FileCode className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span>{docId}.txt</span>
          <span className="text-[10px] text-[#8b949e] ml-1">RGA Core</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#8b949e]">
          <span className="flex items-center gap-1.5 text-[#3fb950]">
            <Activity className="w-3 h-3" />
            <span>Optimistic Local Apply</span>
          </span>
          <span>•</span>
          <span>{docText.length} chars</span>
        </div>
      </div>

      {/* Editor Main Surface */}
      <div className="relative flex-1 flex bg-[#0d1117] font-mono-code text-xs">
        {/* Line Gutter */}
        <div className="select-none py-3 px-3 text-right text-[#484f58] bg-[#090d16] border-r border-[#21262d] w-12 flex-shrink-0 leading-6 font-mono-code">
          {lineNumbers.map((num) => (
            <div key={num} className="h-6 leading-6">
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={docText}
          onChange={handleTextChange}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          disabled={disabled}
          placeholder="Start typing... Edits generate CRDT operations in real-time."
          spellCheck={false}
          className="flex-1 py-3 px-4 bg-transparent text-[#c9d1d9] placeholder-[#484f58] resize-none focus:outline-none leading-6 font-mono-code selection:bg-[#264f78] selection:text-white"
        />
      </div>

      {/* VS Code Style Blue Bottom Status Bar */}
      <div className="h-6 bg-[#1f6feb] text-white px-3 flex items-center justify-between text-[11px] font-mono-code select-none">
        <div className="flex items-center gap-4">
          <span>CRDT Engine: Active</span>
          <span>•</span>
          <span>UTF-8</span>
        </div>
        <div>
          <span>SEC Guaranteed (RGA Array)</span>
        </div>
      </div>
    </div>
  );
};
