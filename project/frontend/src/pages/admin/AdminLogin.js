import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Bot from '../../components/Bot';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(email, password);
      toast.success('Admin access granted');
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => { setEmail('admin@dept.edu'); setPassword('admin123'); };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="orb top-[-100px] left-[-100px] w-[400px] h-[400px]"
        style={{ background: '#4338ca', filter: 'blur(100px)', opacity: 0.12 }} />
      <div className="orb bottom-[-100px] right-[-100px] w-[400px] h-[400px]"
        style={{ background: '#7c3aed', filter: 'blur(100px)', opacity: 0.12 }} />

      <div className="w-full max-w-[380px] relative z-10" style={{ animation: 'slideUp 0.4s ease-out forwards' }}>
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-16 h-16 flex items-center justify-center">
            <Bot className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-gray-900 text-base">DEPTORA</span>
        </Link>

        <div className="card border-black/10">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center mx-auto mb-4">
              <Shield size={22} className="text-primary-600" />
            </div>
            <h1 className="font-display font-bold text-xl text-gray-900 mb-1">Admin Portal</h1>
            <p className="font-body text-gray-500 text-sm">Restricted access — authorized personnel only</p>
          </div>

          {/* Demo hint */}
          <button onClick={fillDemo}
            className="w-full mb-5 px-4 py-2.5 rounded-lg bg-amber-600/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors text-left">
            <p className="text-amber-600 text-xs font-display font-semibold mb-0.5">Demo Admin Credentials</p>
            <p className="text-gray-500 text-xs font-mono">admin@dept.edu / admin123</p>
          </button>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600/10 border border-rose-500/30 text-rose-600 text-sm font-body mb-5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Admin Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@dept.edu" required className="input-field pl-9" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 justify-center disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/20 border-t-white rounded-full animate-spin" /> Authenticating...</>
              ) : (
                <><Shield size={15} /> Access Dashboard <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-black/8 text-center">
            <p className="text-xs text-gray-600 font-body">
              All admin actions are logged and audited
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 font-body mt-5">
          Student?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 transition-colors">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
