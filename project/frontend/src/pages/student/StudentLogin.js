import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Bot from '../../components/Bot';

export default function StudentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginStudent } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginStudent(email, password);
      toast.success('Welcome back!');
      navigate('/chat');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => { setEmail('student@test.edu'); setPassword('student123'); };

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[420px] bg-surface-1 border-r border-black/8 p-10 relative overflow-hidden">
        <div className="orb top-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full"
          style={{ background: '#4f4dd6', filter: 'blur(80px)', opacity: 0.15 }} />
        <div className="orb bottom-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full"
          style={{ background: '#7c6ff0', filter: 'blur(60px)', opacity: 0.15 }} />

        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
          <span className="font-display font-bold text-gray-900 text-base">DEPTORA</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center relative z-10">
          <div className="glass rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
              <div className="chat-bubble-ai !ml-0 !bg-transparent !border-0 !p-0">
                Hello! I'm here to help with all your department questions — courses, procedures, deadlines, and more.
              </div>
            </div>
          </div>
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">Your department assistant awaits</h2>
          <p className="font-body text-gray-500 text-sm leading-relaxed">
            Sign in to access AI-powered answers for your academic journey. All data is processed locally and securely.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {['Instant answers to FAQs', 'Document-grounded responses', 'Available 24/7'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-gray-600 text-sm font-body">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-600 text-xs font-mono relative z-10">
          © 2025 Department AI Assistant
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]" style={{ animation: 'slideUp 0.4s ease-out forwards' }}>
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base">DEPTORA</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display font-bold text-2xl text-gray-900 mb-1.5">Student Login</h1>
            <p className="font-body text-gray-500 text-sm">Sign in with your department credentials</p>
          </div>

          {/* Demo hint */}
          <button onClick={fillDemo}
            className="w-full mb-5 px-4 py-2.5 rounded-lg bg-primary-600/10 border border-primary-500/20 hover:border-primary-500/40 transition-colors text-left">
            <p className="text-primary-600 text-xs font-display font-semibold mb-0.5">Demo Credentials</p>
            <p className="text-gray-500 text-xs font-mono">student@test.edu / student123</p>
          </button>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-600/10 border border-rose-500/30 text-rose-600 text-sm font-body mb-5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@dept.edu" required
                  className="input-field pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/20 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : (
                <> Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 font-body mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">
              Create one
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-black/8 text-center">
            <Link to="/admin/login" className="text-xs text-gray-600 hover:text-gray-700 font-body transition-colors">
              Admin login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
