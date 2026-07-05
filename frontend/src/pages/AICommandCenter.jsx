import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Trash2, Hash, WifiOff, RefreshCw } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import AIChatMessage from '../components/ai/AIChatMessage';
import AIQuickPrompts from '../components/ai/AIQuickPrompts';
import AIStatusBanner from '../components/ai/AIStatusBanner';
import AIContextPanel from '../components/ai/AIContextPanel';
import SecurityTestPrompts from '../components/ai/SecurityTestPrompts';
import { useAuth } from '../auth/AuthContext';
import { aiAPI, dashboardAPI } from '../services/api';

const SESSION_KEY = 'citymind_ai_session_id';

const AICommandCenter = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(() => sessionStorage.getItem('citymind_ai_status') || 'available');
  const [input, setInput] = useState(() => location.state?.preparedPrompt || '');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [loadingLabelIdx, setLoadingLabelIdx] = useState(0);
  const [incidents, setIncidents] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const updateGlobalAIStatus = useCallback((status) => {
    setAiStatus(status);
    sessionStorage.setItem('citymind_ai_status', status);
    window.dispatchEvent(new CustomEvent('citymind-ai-status-change', { detail: status }));
  }, []);

  const LOADING_LABELS = [
    'City Operations Coordinator is analyzing...',
    'Checking verified city data...',
    'Consulting specialist agents...',
    'Preparing grounded response...',
  ];

  // Check AI availability on mount via a lightweight health-check style probe
  useEffect(() => {
    const checkAI = async () => {
      try {
        // Use existing health endpoint to verify backend is up
        await dashboardAPI.getDashboardData();
        const current = sessionStorage.getItem('citymind_ai_status') || 'available';
        if (current === 'offline') {
          updateGlobalAIStatus('available');
        } else {
          updateGlobalAIStatus(current);
        }
      } catch {
        updateGlobalAIStatus('offline');
      }
    };
    checkAI();
  }, [updateGlobalAIStatus]);

  // Load incidents for quick prompt ID resolution
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const res = await dashboardAPI.getDashboardData();
        if (res.data?.incidents) {
          setIncidents(res.data.incidents);
        }
      } catch {
        // Non-critical
      }
    };
    loadIncidents();
  }, []);

  // Cycle loading labels
  useEffect(() => {
    if (!loading) {
      setLoadingLabelIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingLabelIdx(prev => (prev + 1) % LOADING_LABELS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [loading]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input after loading
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    updateGlobalAIStatus('processing');

    try {
      const payload = {
        message: text.trim(),
        session_id: sessionId,
      };

      const res = await aiAPI.query(payload);
      const data = res.data;

      // Store session ID
      if (data.session_id) {
        setSessionId(data.session_id);
        sessionStorage.setItem(SESSION_KEY, data.session_id);
      }

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        agents_used: data.agents_used || [],
        grounded: data.grounded ?? false,
        tools_used: data.tools_used || [],
        decision_id: data.decision_id,
        security: data.security,
        audit: data.audit,
        assurance_level: data.assurance_level,
        assurance_reasons: data.assurance_reasons || [],
        limitations: data.limitations || [],
      };

      setMessages(prev => [...prev, assistantMsg]);
      updateGlobalAIStatus('available');
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if ([400, 403, 429].includes(status) && detail && typeof detail === 'object' && ['AI_REQUEST_BLOCKED', 'AI_RATE_LIMITED'].includes(detail.code)) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'blocked', content: detail.safe_message, timestamp: new Date().toISOString(), event_id: detail.event_id, threat_level: detail.threat_level, categories: detail.categories || [] }]);
        updateGlobalAIStatus('available');
        return;
      }
      let errorContent;

      if (status === 503) {
        errorContent = 'CityMind AI is temporarily unavailable. The operational dashboard and deterministic tools remain available.';
        updateGlobalAIStatus('offline');
      } else if (status === 400 || status === 422) {
        errorContent = 'The request could not be processed. Please revise the question.';
        updateGlobalAIStatus('available');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorContent = 'The AI request took too long. Please retry.';
        updateGlobalAIStatus('offline');
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        errorContent = 'Could not connect to the CityMind backend.';
        updateGlobalAIStatus('offline');
      } else {
        errorContent = `An unexpected error occurred: ${err.response?.data?.detail || err.message}`;
        updateGlobalAIStatus('offline');
      }

      const errorMsg = {
        id: Date.now() + 1,
        role: 'error',
        content: errorContent,
        timestamp: new Date().toISOString(),
        retryText: text.trim(),
        errorStatus: status,
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId, updateGlobalAIStatus]);

  const handleRetry = useCallback((retryText) => {
    sendMessage(retryText);
  }, [sendMessage]);

  const handleClearConversation = () => {
    setMessages([]);
    setSessionId(null);
    sessionStorage.removeItem(SESSION_KEY);
    setShowClearConfirm(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleQuickPrompt = (prompt) => {
    sendMessage(prompt);
  };

  const statusIndicator = aiStatus === 'available'
    ? { label: 'AI Available', color: 'bg-emerald-400', textColor: 'text-emerald-400' }
    : aiStatus === 'processing'
      ? { label: 'AI Processing', color: 'bg-blue-400 animate-pulse', textColor: 'text-blue-400' }
      : { label: 'AI Offline', color: 'bg-red-500', textColor: 'text-red-400' };

  return (
    <PageContainer title="AI Command Center">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-navy-700 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">CityMind AI Command Center</h2>
                <p className="text-[11px] text-slate-400">
                  Google ADK multi-agent orchestration across risk, incidents, resources, hospitals, dispatches, and public communication.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* AI Status */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusIndicator.color} ${aiStatus === 'available' ? 'animate-pulse' : ''}`} />
                <span className={`text-[11px] font-medium ${statusIndicator.textColor}`}>{statusIndicator.label}</span>
              </div>

              {/* Session badge */}
              {sessionId && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-navy-800 border border-navy-700 rounded text-[10px] text-slate-500">
                  <Hash className="w-3 h-3" />
                  <span className="truncate max-w-[80px]">{sessionId.split('-').slice(-1)[0]}</span>
                </div>
              )}

              {/* Clear button */}
              {messages.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-red-400 border border-navy-700 rounded-lg hover:border-red-500/30 transition-colors"
                  aria-label="Clear conversation"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Safety banner */}
          <AIStatusBanner />

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-4 pr-1 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="p-4 bg-navy-800 rounded-2xl border border-navy-700">
                  <Sparkles className="w-10 h-10 text-blue-400/60" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Ask CityMind AI</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Ask operational questions across risk, incidents, resources, hospitals, dispatches, and public communication using Google ADK multi-agent orchestration.
                  </p>
                </div>
              </div>
            ) : (
              messages.map(msg => {
                if (msg.role === 'error') {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[85%] bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <WifiOff className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-medium text-red-400">Error</span>
                        </div>
                        <p className="text-sm text-red-300">{msg.content}</p>
                        {msg.retryText && (
                          <button
                            onClick={() => handleRetry(msg.retryText)}
                            disabled={loading}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs rounded-lg transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
                return <AIChatMessage key={msg.id} message={msg} />;
              })
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-navy-800 border border-navy-600 rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-blue-400" role="status" aria-live="polite">
                      {LOADING_LABELS[loadingLabelIdx]}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="pt-3 border-t border-navy-700 mt-auto space-y-1.5">
            <div className="flex items-end gap-2">
              <label htmlFor="ai-chat-input" className="sr-only">Ask CityMind AI a question</label>
              <textarea
                ref={inputRef}
                id="ai-chat-input"
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
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium h-[42px]"
                aria-label="Send message"
              >
                <Sparkles className="w-4 h-4" />
                Send
              </button>
            </div>
            <p className="text-[10px] text-slate-600 px-1">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <AIContextPanel />
          {user?.role === 'DemoAdmin' && (
            <SecurityTestPrompts onInsert={(prompt) => { setInput(prompt); inputRef.current?.focus(); }} disabled={loading} />
          )}
          <AIQuickPrompts
            onSelect={handleQuickPrompt}
            disabled={loading}
            incidents={incidents}
          />
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm">Clear Conversation?</h3>
            <p className="text-xs text-slate-400">
              This will remove all chat messages and reset the AI session. The operational dashboard and deterministic tools will not be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-300 border border-navy-600 rounded-lg hover:bg-navy-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConversation}
                className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default AICommandCenter;
