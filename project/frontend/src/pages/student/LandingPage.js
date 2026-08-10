import { Link, useNavigate } from 'react-router-dom';
import {
  FileQuestion, ClipboardList, BarChart2, ArrowRight,
} from 'lucide-react';
import Bot from '../../components/Bot';

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Bot,
    title: 'AI-Powered Answers',
    desc: 'Our chatbot understands natural language and retrieves precise answers instantly.',
    bg: 'rgba(16,185,129,0.12)',
    iconColor: '#a78bfa',
  },
  {
    icon: FileQuestion,
    title: 'FAQ Knowledge Base',
    desc: 'Hundreds of frequently asked questions curated by department staff.',
    bg: 'rgba(139,92,246,0.12)',
    iconColor: '#a78bfa',
  },
  {
    icon: ClipboardList,
    title: 'Step-by-Step Guides',
    desc: 'Clear procedures for registration, documents, grade reviews and more.',
    bg: 'rgba(16,185,129,0.12)',
    iconColor: '#34d399',
  },
  {
    icon: BarChart2,
    title: 'Smart Analytics',
    desc: 'Admins see what students ask most and can continuously improve the system.',
    bg: 'rgba(245,158,11,0.12)',
    iconColor: '#fbbf24',
  },
];

const STATS = [
  { value: '< 1s', label: 'Response time' },
  { value: '24/7', label: 'Availability'  },
  { value: '95%',  label: 'Match rate'    },
  { value: '100+', label: 'FAQs covered'  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Fixed background image ── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/hero.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 -z-10 bg-black/60" />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-bold text-white text-[15px] tracking-tight">
              DEPTORA
            </span>
          </div>

          {/* Centre links */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="font-body text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="font-body text-sm text-white/60 hover:text-white transition-colors">
              How it works
            </a>
            <a href="#about" className="font-body text-sm text-white/60 hover:text-white transition-colors">
              About
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/admin/login"
              className="font-body text-sm text-white/60 hover:text-white px-4 py-2 transition-colors"
            >
              Admin
            </Link>
            <Link to="/login" className="btn-primary text-sm py-2 px-4">
              Sign in
            </Link>
            <Link to="/signup" className="btn-primary text-sm py-2 px-5">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center text-white">

        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-white/10 text-xs font-body text-gray-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-Powered &bull; Available 24/7 &bull; No queue
        </div>

        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.1] tracking-tight mb-6">
          Your department's
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #818cf8, #a78bfa, #06b6d4)',
            }}
          >
            smartest secretary
          </span>
        </h1>

        <p className="font-body text-lg text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
          Get instant answers to any university question — transcripts, registration,
          leave applications, schedules, and more. No waiting. No frustration.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup" className="btn-primary px-8 py-3 text-base">
            Start Chatting <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn-primary px-8 py-3 text-base">
            I have an account
          </Link>
        </div>

        <p className="mt-6 font-body text-xs text-white/30">
          Trusted by the Department of Computer Science &amp; Engineering
        </p>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-3xl mx-auto px-6 mb-20">
        <div
          className="rounded-2xl overflow-hidden border border-white/8"
          style={{ background: 'rgba(22,22,31,0.85)', backdropFilter: 'blur(16px)' }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/8">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-6 text-center">
                <p className="font-display font-extrabold text-2xl text-white tracking-tight">
                  {s.value}
                </p>
                <p className="font-body text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-white mb-3">
            Built for Academic Departments
          </h2>
          <p className="font-body text-gray-400">
            A purpose-built system — not a generic chatbot
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="card bg-black border border-white/10 group hover:border-primary-500/40 transition-all duration-300 cursor-default flex gap-4 items-start"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: f.bg, border: `1px solid ${f.iconColor}25` }}
                >
                  <Icon size={20} style={{ color: f.iconColor }} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white text-[15px] mb-1.5">
                    {f.title}
                  </h3>
                  <p className="font-body text-sm text-gray-400 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="glass-dark bg-black rounded-2xl p-8 md:p-12 border border-white/10">
          <h2 className="font-display font-bold text-2xl text-white mb-2 text-center">
            How It Works
          </h2>
          <p className="font-body text-sm text-gray-400 text-center mb-10">
            Four simple steps from question to answer
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: '1', label: 'Ask a question',  sub: 'Natural language — no special commands needed' },
              { num: '2', label: 'Domain check',     sub: 'Ensures the query is department-relevant' },
              { num: '3', label: 'Hybrid retrieval', sub: 'Structured FAQs + semantic FAISS search' },
              { num: '4', label: 'AI answers',       sub: 'Ollama synthesises context into a clear reply' },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-600/30 border border-primary-500/40 flex items-center justify-center">
                  <span className="font-display font-bold text-sm text-primary-400">
                    {step.num}
                  </span>
                </div>
                <p className="font-display font-semibold text-white text-sm">{step.label}</p>
                <p className="font-body text-xs text-gray-400 leading-relaxed">{step.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="about" className="max-w-6xl mx-auto px-6 pb-20 text-center">
        <h2 className="font-display font-bold text-2xl text-white mb-3">
          Ready to get started?
        </h2>
        <p className="font-body text-sm text-gray-500 mb-6">
          Sign up with your department email to access the AI assistant
        </p>
        <Link to="/signup" className="btn-primary inline-flex mx-auto px-8 py-3 text-base">
          Create Student Account <ArrowRight size={16} />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-8 text-center">
        <p className="font-body text-xs text-gray-600">
          Department AI Assistant · Built with React, FastAPI, Ollama, FAISS ·{' '}
          <span className="text-gray-500">For internal academic use only</span>
        </p>
      </footer>

    </div>
  );
}