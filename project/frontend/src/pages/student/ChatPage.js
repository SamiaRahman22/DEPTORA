import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { chatAPI, faqAPI } from '../../utils/api';
import {
  Send, LogOut, User, BookOpen, FileText, HelpCircle,
  Paperclip, RotateCcw, ThumbsUp, ThumbsDown, Copy,
  Sparkles, ChevronDown, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import Bot from '../../components/Bot';

const SAMPLE_QUESTIONS = [
  'Can I take courses from other departments?',
  'When are tuition fees due?',
  'What is the attendance policy?',
  'Who is the chairperson of CSE department?',
  'How do I get my official transcript?',
  'What is the minimum CGPA to graduate?',
];

const renderMarkdown = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s+(.+)/gm, '<strong class="text-gray-900">$1</strong>')
    .replace(/^[•\-]\s+(.+)/gm, '• $1')
    .replace(/^\d+\.\s+(.+)/gm, (m, p) => m);
};

const Message = ({ msg }) => {
  const isUser = msg.role === 'user';
  const isOOD = msg.content?.includes('Out-of-Domain') || msg.content?.includes('⚠️');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) return (
    <div className="flex justify-end mb-4 animate-fade-in">
      <div className="flex items-end gap-2 max-w-[75%]">
        <div className="chat-bubble-user">{msg.content}</div>
        <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
          <User size={13} className="text-gray-900" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex justify-start mb-4 animate-fade-in group">
      <div className="flex items-end gap-2 max-w-[82%]">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
          ${isOOD ? 'bg-amber-600/30 border border-amber-500/30' : 'bg-primary-600/30 border border-primary-500/30'}`}>
          {isOOD ? <AlertTriangle size={13} className="text-amber-600" /> : <Bot size={13} className="text-primary-600" />}
        </div>
        <div className="flex-1">
          <div className={`px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed font-body
            ${isOOD ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-surface-3 border border-black/8 text-gray-800'}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content).replace(/\n/g, '<br/>') }} />
          
          {msg.sources?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.sources.map((s, i) => (
                <span key={i} className="badge bg-primary-600/10 text-primary-600 border border-primary-500/20 text-xs">
                  <FileText size={9} />{s}
                </span>
              ))}
            </div>
          )}
          {msg.retrieval_method && (
            <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-gray-700 text-xs font-mono">{msg.retrieval_method}</span>
              {msg.response_time_ms && <span className="text-gray-700 text-xs font-mono">{msg.response_time_ms}ms</span>}
              <button onClick={copy} className="p-1 rounded hover:bg-black/[.03] text-gray-600 hover:text-gray-700 transition-colors">
                <Copy size={10} />
              </button>
              <button className="p-1 rounded hover:bg-black/[.03] text-gray-600 hover:text-emerald-600 transition-colors"><ThumbsUp size={10} /></button>
              <button className="p-1 rounded hover:bg-black/[.03] text-gray-600 hover:text-rose-600 transition-colors"><ThumbsDown size={10} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start mb-4">
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-primary-600/30 border border-primary-500/30 flex items-center justify-center">
        <Bot size={13} className="text-primary-600" />
      </div>
      <div className="bg-surface-3 border border-black/8 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
      </div>
    </div>
  </div>
);

export default function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{
    id: 1, role: 'assistant',
    content: `Hello **${user?.name?.split(' ')[0] || 'there'}**! 👋 I'm your department AI assistant.\n\nI can help you with:\n• **Course & curriculum** questions\n• **Procedures & forms** guidance\n• **Deadlines & schedules**\n• **Faculty & contact** information\n\nWhat would you like to know?`,
    sources: [],
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [apiOnline, setApiOnline] = useState(true);
  const [liveFaqs, setLiveFaqs] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Backend appends meta-notes (low-confidence warning, fallback notice) onto
  // the DISPLAYED response text. Those must never be sent back to the LLM as
  // conversation history — a small model will echo repeated boilerplate it
  // sees in its own prior turns, which is exactly why the warning note was
  // showing up multiple times in later responses within the same session.
  const stripMetaNotes = (text) => {
    if (!text) return text;
    return text
      .split(/\n\n⚠️ \*\*Note:\*\* This answer has limited source backing\./)[0]
      .split(/\n\n\*Note: AI synthesis unavailable\./)[0]
      .trim();
  };

  // Build conversation history for context
  const conversationHistory = messages
    .filter(m => m.role !== 'system')
    .slice(-10)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Live FAQs — auto-promoted questions show up here without a page reload.
  const fetchFaqs = useCallback(async () => {
    try {
      const data = await faqAPI.list(null, true); // active_only
      const sorted = [...data].sort(
        (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
      setLiveFaqs(sorted.slice(0, 8));
    } catch {
      // Silently skip — not critical to chat functioning, don't toast/interrupt.
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
    const interval = setInterval(fetchFaqs, 15000);
    return () => clearInterval(interval);
  }, [fetchFaqs]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await chatAPI.sendMessage(msg, sessionId, conversationHistory);
      setApiOnline(true);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.response,
        sources: result.sources || [],
        retrieval_method: result.retrieval_method,
        response_time_ms: result.response_time_ms,
        is_in_domain: result.is_in_domain,
      }]);
      // Promotion now happens synchronously server-side, before this response
      // is even sent — so if new_faq_added is true, the FAQ is already
      // committed to the DB right now. Refresh immediately, no delay needed.
      if (result.new_faq_added) {
        fetchFaqs();
      }
    } catch (err) {
      setApiOnline(false);
      const errMsg = err.response?.data?.detail || 'Failed to reach the backend. Is FastAPI running?';
      toast.error(errMsg);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `**Connection Error**\n\nCould not reach the backend API.\n\nMake sure:\n1. FastAPI is running: \`uvicorn main:app --reload\`\n2. It's accessible at \`http://localhost:8000\`\n3. You're logged in with a valid token`,
        sources: [],
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, conversationHistory, fetchFaqs]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success('Logged out');
  };

  const clearChat = () => {
    setMessages([{ id: Date.now(), role: 'assistant', content: 'Chat cleared. How can I help?', sources: [] }]);
  };

  return (
    <div className="h-screen bg-surface-0 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-300 bg-surface-1 border-r border-black/8 flex flex-col overflow-hidden flex-shrink-0`}>
        <div className="p-4 border-b border-black/8">
          <div className="flex items-center gap-2.5">
            <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-display font-bold text-gray-900 text-sm">DEPTORA</p>
              <p className="text-gray-600 text-xs font-mono">RAG + Ollama</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 overflow-y-auto">
          <button onClick={clearChat}
            className="w-full mb-4 py-2 px-3 rounded-lg bg-primary-600/20 border border-primary-500/30 hover:bg-primary-600/30 text-primary-600 text-xs font-display font-medium transition-colors flex items-center gap-2">
            <Sparkles size={12} /> New Chat
          </button>
          <div className="flex items-center gap-1.5 px-2 mb-2">
            <p className="text-gray-600 text-xs font-display font-semibold uppercase tracking-wider">Quick Questions</p>
            {liveFaqs.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live — updates automatically" />
            )}
          </div>
          <div className="space-y-0.5 max-h-72 overflow-y-auto">
            {liveFaqs.map((faq) => (
              <button key={`faq-${faq.id}`} onClick={() => sendMessage(faq.question)}
                className="w-full text-left px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-black/[.03] text-xs font-body transition-colors leading-snug flex items-start gap-1.5">
                <HelpCircle size={11} className="text-primary-500/60 mt-0.5 flex-shrink-0" />
                <span>{faq.question}</span>
              </button>
            ))}
            {SAMPLE_QUESTIONS
              .filter((q) => !liveFaqs.some((f) => f.question.toLowerCase() === q.toLowerCase()))
              .slice(0, Math.max(0, 6 - liveFaqs.length))
              .map((q, i) => (
                <button key={`sample-${i}`} onClick={() => sendMessage(q)}
                  className="w-full text-left px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-black/[.03] text-xs font-body transition-colors leading-snug">
                  {q}
                </button>
              ))}
          </div>
          <div className="mt-4 pt-4 border-t border-black/8">
            <p className="text-gray-600 text-xs font-display font-semibold uppercase tracking-wider px-2 mb-1">Resources</p>
            {[{ icon: BookOpen, label: 'Procedures' }, { icon: FileText, label: 'Documents' }].map(({ icon: Icon, label }) => (
              <button key={label} className="sidebar-link w-full text-left"><Icon size={14} /> {label}</button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-black/8">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-gray-900 text-xs font-display font-bold">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-xs font-display font-medium truncate">{user?.name}</p>
              <p className="text-gray-600 text-xs font-mono truncate">{user?.student_id}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-rose-600 transition-colors p-1">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-black/8 bg-surface-1/50 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-1.5 rounded hover:bg-black/[.04] text-gray-500 hover:text-gray-900 transition-colors">
              <ChevronDown size={16} className={`transition-transform ${showSidebar ? 'rotate-90' : '-rotate-90'}`} />
            </button>
            <div className="flex items-center gap-2">
              {apiOnline
                ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-gray-600 text-sm font-body">Department Assistant</span></>
                : <><WifiOff size={12} className="text-rose-600" /><span className="text-rose-600 text-sm font-body">Backend Offline</span></>
              }
            </div>
            <span className="badge bg-primary-600/10 text-primary-600 border border-primary-500/20 text-xs">RAG + Ollama</span>
          </div>
          <button onClick={clearChat} className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-gray-900 transition-colors"><RotateCcw size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl mx-auto">
            {messages.map(msg => <Message key={msg.id} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-black/8 bg-surface-1/50 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 bg-surface-2 border border-black/10 rounded-xl px-4 py-3 focus-within:border-primary-500/50 transition-colors">
              <Paperclip size={17} className="text-gray-600 pb-0.5" />
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Ask about courses, procedures, deadlines..." rows={1}
                className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm font-body outline-none resize-none leading-relaxed max-h-32 overflow-y-auto" />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:bg-surface-3 disabled:text-gray-600 text-white transition-all duration-200 flex-shrink-0 disabled:cursor-not-allowed">
                <Send size={15} />
              </button>
            </div>
            <p className="text-center text-gray-700 text-xs font-body mt-2">
              Answers grounded in department documents via RAG · Powered by Ollama (local LLM)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
