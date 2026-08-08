import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../utils/api';
import {
  MessageSquare, FileText, HelpCircle, Database,
  TrendingUp, Users, AlertTriangle, CheckCircle,
  Upload, Clock, RefreshCw
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="card hover:border-white/15 transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        <Icon size={17} style={{ color }} />
      </div>
      {trend !== undefined && (
        <span className={`badge ${trend >= 0 ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-600/10 text-rose-400 border-rose-500/20'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="font-display font-bold text-2xl text-white mb-0.5">{value ?? '—'}</p>
    <p className="font-body text-sm text-gray-400">{label}</p>
    {sub && <p className="text-xs text-gray-600 font-body mt-1">{sub}</p>}
  </div>
);

const RAGBar = ({ label, value, color }) => (
  <div className="mb-3">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs text-gray-500 font-body">{label}</span>
      <span className="text-xs font-mono" style={{ color }}>{value}</span>
    </div>
    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: value, background: color }} />
    </div>
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [perf, setPerf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [result, perfResult] = await Promise.all([
        adminAPI.dashboard(),
        adminAPI.performance().catch(() => null),
      ]);
      setData(result);
      setPerf(perfResult);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const stats = data?.stats;
  const live = perf?.live;

  return (
    <AdminLayout title="Dashboard" subtitle="System overview">
      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-rose-600/10 border border-rose-500/30 text-rose-400 text-sm font-body flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadDashboard} className="flex items-center gap-1 text-xs hover:text-rose-300 transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm font-body">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard icon={MessageSquare} label="Total Queries (30d)" value={stats?.total_queries_30d?.toLocaleString()} color="#6366f1" />
            <StatCard icon={CheckCircle} label="Resolved Queries" value={stats?.resolved?.toLocaleString()}
              sub={`${stats?.resolution_rate ?? 0}% resolution rate`} color="#10b981" />
            <StatCard icon={AlertTriangle} label="Out-of-Domain Rejected" value={stats?.rejected_ood?.toLocaleString()} color="#f59e0b" />
            <StatCard icon={Users} label="Active Students" value={stats?.active_students?.toLocaleString()} color="#8b5cf6" />
            <StatCard icon={HelpCircle} label="Active FAQs" value={stats?.faq_count?.toLocaleString()} color="#06b6d4" />
            <StatCard icon={FileText} label="Indexed Documents" value={stats?.document_count?.toLocaleString()} color="#f43f5e" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent activity */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-white text-sm">Recent Activity</h2>
                <Clock size={14} className="text-gray-600" />
              </div>
              {data?.recent_activity?.length > 0 ? (
                <div className="space-y-0">
                  {data.recent_activity.slice(0, 6).map((log, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        log.status === 'resolved' ? 'bg-emerald-400' :
                        log.status === 'rejected' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-xs font-body truncate">{log.query}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-gray-600 text-xs font-mono">{log.status}</span>
                          {log.response_time_ms && (
                            <span className="text-gray-600 text-xs font-mono">· {log.response_time_ms}ms</span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-700 text-xs font-mono flex-shrink-0">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm font-body text-center py-6">No activity yet</p>
              )}
            </div>

            <div className="space-y-4">
              {/* Real system performance — measured, not simulated */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-white text-sm">System Performance</h2>
                  {perf?.offline_evaluation_generated_at && (
                    <span className="text-xs text-gray-600 font-mono">
                      eval: {new Date(perf.offline_evaluation_generated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {perf?.offline_evaluation?.domain_restriction ? (
                  <RAGBar
                    label="Domain Restriction Accuracy (labeled test set)"
                    value={`${perf.offline_evaluation.domain_restriction.accuracy}%`}
                    color="#8b5cf6"
                  />
                ) : (
                  <p className="text-xs text-gray-600 font-body mb-3">
                    Domain accuracy: not yet measured — run <code>evaluate_system.py</code>.
                  </p>
                )}

                {live?.document_indexing?.extraction_success_rate != null && (
                  <RAGBar
                    label="Document Extraction Success Rate"
                    value={`${live.document_indexing.extraction_success_rate}%`}
                    color="#10b981"
                  />
                )}

                {live?.cache?.enabled && (
                  <RAGBar
                    label={`Cache Hit Rate (${live.cache.total} lookups)`}
                    value={`${live.cache.hit_rate}%`}
                    color="#f59e0b"
                  />
                )}

                {live?.avg_confidence_score != null && (
                  <RAGBar
                    label="Avg Response Validation Confidence"
                    value={`${Math.round(live.avg_confidence_score * 100)}%`}
                    color="#6366f1"
                  />
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {live?.response_time?.avg_ms != null
                    ? `${live.response_time.avg_ms}ms avg response (p95: ${live.response_time.p95_ms}ms, n=${live.response_time.sample_size})`
                    : `${stats?.avg_response_ms ?? '—'}ms avg response`}
                </div>
                {!perf?.offline_evaluation && (
                  <p className="text-xs text-gray-600 font-body mt-2">
                    {perf?.offline_evaluation_note}
                  </p>
                )}
              </div>

              {/* Quick actions */}
              <div className="card">
                <h2 className="font-display font-semibold text-white text-sm mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Add FAQ', icon: HelpCircle, to: '/admin/faqs', color: '#6366f1' },
                    { label: 'Upload Doc', icon: Upload, to: '/admin/documents', color: '#10b981' },
                    { label: 'View Logs', icon: TrendingUp, to: '/admin/logs', color: '#f59e0b' },
                    { label: 'Procedures', icon: FileText, to: '/admin/procedures', color: '#8b5cf6' },
                  ].map(({ label, icon: Icon, to, color }) => (
                    <a key={label} href={to}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 transition-all cursor-pointer">
                      <Icon size={13} style={{ color }} />
                      <span className="text-gray-300 text-xs font-body">{label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
