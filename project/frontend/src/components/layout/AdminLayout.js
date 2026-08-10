import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, HelpCircle, FileText, Upload,
  ScrollText, LogOut, ChevronLeft, Menu, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import Bot from '../../components/Bot';

const NAV_ITEMS = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/faqs', icon: HelpCircle, label: 'FAQ Manager' },
  { path: '/admin/procedures', icon: FileText, label: 'Procedures' },
  { path: '/admin/documents', icon: Upload, label: 'Documents' },
  { path: '/admin/logs', icon: ScrollText, label: 'Query Logs' },
];

export default function AdminLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  return (
    <div className="h-screen bg-surface-0 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} transition-all duration-200 bg-surface-1 border-r border-black/8 flex flex-col flex-shrink-0`}>
        {/* Logo */}
        <div className="h-14 border-b border-black/8 flex items-center px-4 gap-2.5 flex-shrink-0">
          <div className="w-16 h-16 flex items-center justify-center">
            < Bot className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-display font-bold text-gray-900 text-sm leading-none">DEPTORA</p>
              <p className="text-gray-600 text-xs font-mono leading-none mt-0.5">Admin</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-gray-600 hover:text-gray-700 transition-colors">
            {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {!collapsed && (
            <p className="text-gray-700 text-xs font-display font-semibold uppercase tracking-wider px-2 py-2">Navigation</p>
          )}
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg mb-0.5 transition-all duration-150 ${active
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-black/[.03]'
                  } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? label : ''}>
                <Icon size={16} className={active ? 'text-white' : ''} />
                {!collapsed && <span className="text-sm font-body">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Admin info */}
        <div className="border-t border-black/8 p-2">
          <div className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-amber-700/40 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Shield size={13} className="text-amber-600" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-xs font-display font-medium truncate">{user?.name}</p>
                <p className="text-gray-600 text-xs font-mono truncate">Administrator</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="text-gray-600 hover:text-rose-600 transition-colors" title="Logout">
                <LogOut size={14} />
              </button>
            )}
          </div>
          {collapsed && (
            <button onClick={handleLogout} className="w-full flex justify-center p-2 text-gray-600 hover:text-rose-600 transition-colors" title="Logout">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-black/8 bg-surface-1/30 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="font-display font-bold text-gray-900 text-base leading-none">{title}</h1>
            {subtitle && <p className="text-gray-500 text-xs font-body mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-emerald-600/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              System Online
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
