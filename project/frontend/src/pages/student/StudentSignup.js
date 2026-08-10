import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, User, Hash, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Bot from '../../components/Bot';

const PasswordStrength = ({ password }) => {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-3 mt-2">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-1">
          <CheckCircle size={10} className={c.ok ? 'text-emerald-600' : 'text-gray-600'} />
          <span className={`text-xs font-body ${c.ok ? 'text-emerald-600' : 'text-gray-600'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function StudentSignup() {
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { registerStudent } = useAuth();
  const navigate = useNavigate();

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await registerStudent(form);
      toast.success('Account created! Welcome aboard.');
      navigate('/chat');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[380px] bg-surface-1 border-r border-black/8 p-10 relative overflow-hidden">
        <div className="orb top-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full"
          style={{ background: '#8b5cf6', filter: 'blur(80px)', opacity: 0.15 }} />
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-16 h-16 flex items-center justify-center">
              <Bot className="w-full h-full object-contain" />
            </div>
          <span className="font-display font-bold text-gray-900 text-base">DEPTORA</span>
        </Link>
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-4">Join your department's AI network</h2>
          <p className="font-body text-gray-500 text-sm leading-relaxed mb-8">
            Create your account to access the department knowledge base, get instant answers, and stay informed.
          </p>
          <div className="space-y-4">
            {[
              { label: 'Department FAQs', desc: 'Instant answers to common questions' },
              { label: 'Procedure Guidance', desc: 'Step-by-step academic processes' },
              { label: 'Document Search', desc: 'Semantic search over dept. documents' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-gray-900 text-sm font-display font-medium">{label}</p>
                  <p className="text-gray-600 text-xs font-body">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-gray-600 text-xs font-mono relative z-10">© 2025 Department AI Assistant</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[400px] py-8" style={{ animation: 'slideUp 0.4s ease-out forwards' }}>
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Bot size={16} className="text-gray-900" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base">DEPTORA</span>
          </Link>

          <div className="mb-7">
            <h1 className="font-display font-bold text-2xl text-gray-900 mb-1.5">Create Account</h1>
            <p className="font-body text-gray-500 text-sm">Register with your student credentials</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-600/10 border border-rose-500/30 text-rose-600 text-sm font-body mb-5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-display font-medium text-gray-600 mb-2">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                    placeholder="Your Name" required className="input-field pl-9 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-display font-medium text-gray-600 mb-2">Student ID</label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={form.studentId} onChange={e => update('studentId', e.target.value)}
                    placeholder="CSE-2024-001" required className="input-field pl-9 py-2.5 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                  placeholder="you@dept.edu" required className="input-field pl-9" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Min. 6 characters" required className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="password" value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  placeholder="Re-enter password" required className="input-field pl-9" />
                {form.confirmPassword && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <CheckCircle size={14} className={form.password === form.confirmPassword ? 'text-emerald-600' : 'text-rose-600'} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input type="checkbox" required id="agree"
                className="mt-0.5 accent-indigo-500 w-3.5 h-3.5" />
              <label htmlFor="agree" className="text-xs text-gray-500 font-body leading-relaxed">
                I agree to the department's data usage policy. All conversations are logged for quality assurance.
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 justify-center mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/20 border-t-white rounded-full animate-spin" /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 font-body mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
