import { Send, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const LOADING_LABELS = [
  'City Operations Coordinator is analyzing...',
  'Checking verified city data...',
  'Consulting specialist agents...',
  'Preparing grounded response...',
];

const AIInputComposer = ({ onSend, loading }) => {
  const [input, setInput] = useState('');
  const [labelIdx, setLabelIdx] = useState(0);
  const textareaRef = useRef(null);

  // Cycle loading labels
  useEffect(() => {
    if (!loading) {
      setLabelIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setLabelIdx(prev => (prev + 1) % LOADING_LABELS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [loading]);

  // Focus textarea after send
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // For external quick prompt injection
  const setInputValue = (val) => {
    setInput(val);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Expose setInputValue to parent via ref forwarding through props
  useEffect(() => {
    if (onSend._setComposerInput) {
      onSend._setComposerInput(setInputValue);
    }
  });

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-blue-400" role="status" aria-live="polite">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{LOADING_LABELS[labelIdx]}</span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor="ai-input" className="sr-only">Ask CityMind AI a question</label>
        <textarea
          ref={textareaRef}
          id="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about city operations..."
          disabled={loading}
          rows={2}
          className="flex-1 resize-none bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 disabled:opacity-50 transition-colors"
          aria-label="Ask CityMind AI a question"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[10px] text-slate-600 px-1">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
};

export default AIInputComposer;
