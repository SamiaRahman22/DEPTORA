import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../utils/api';
import { Search, CheckCircle, XCircle, AlertTriangle, MessageSquare, Clock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const StatusConfig = {
  resolved: { icon: CheckCircle, color: 'emerald', label: 'Resolved' },
  rejected: { icon: XCircle, color: 'rose', label: 'Out of Domain' },
  partial: { icon: AlertTriangle, color: 'amber', label: 'Low Confidence' },
  failed: { icon: XCircle, color: 'rose', label: 'Failed' },
};

const StatusBadge = ({ status }) => {
  const { icon: Icon, color, label } = StatusConfig[status] || StatusConfig.resolved;
  return (
    <span className={`badge bg-${color}-600/10 text-${color}-400 border border-${color}-500/20`}>
      <Icon size={9} />{label}
    </span>
  );
};

export default function QueryLogs() {
  const [data, setData] = useState({ logs: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (filter === 'ood') params.in_domain = false;
      else if (filter !== 'all') params.status = filter;
      const result = await adminAPI.logs(params);
      setData(result);
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const rateLog = async (id, rating) => {
    try {
      await adminAPI.rateLog(id, rating);
      setData(d => ({ ...d, logs: d.logs.map(l => l.id === id ? { ...l, admin_rating: rating } : l) }));
      setSelected(s => s?.id === id ? { ...s, admin_rating: rating } : s);
      toast.success(`Marked ${rating}`);
    } catch { toast.error('Failed to save rating'); }
  };

  // Summary stats from current data
  const resolved = data.logs.filter(l => l.status === 'resolved').length;
  const rejected = data.logs.filter(l => !l.is_in_domain).length;
  const avgTime = data.logs.length
    ? Math.round(data.logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / data.logs.length)
    : 0;

  return (
    <AdminLayout title="Query Logs" subtitle="Monitor all student interactions">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Queries', value: data.total, icon: MessageSquare, color: '#6366f1' },
          { label: 'Resolved (page)', value: resolved, icon: CheckCircle, color: '#10b981' },
          { label: 'Out-of-Domain (page)', value: rejected, icon: XCircle, color: '#f43f5e' },
          { label: 'Avg Response', value: `${avgTime}ms`, icon: Clock, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="font-display font-bold text-lg text-white">{value}</p>
              <p className="text-gray-600 text-xs font-body">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search queries..." className="input-field pl-9 py-2 text-sm" />
        </div>
        <div className="flex gap-1">
          {[['all','All'],['resolved','Resolved'],['ood','Out-of-Domain'],['partial','Partial']].map(([val,label]) => (
            <button key={val} onClick={() => { setFilter(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-colors
                ${filter === val ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent hover:bg-white/5'}`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={loadLogs} className="p-2 rounded hover:bg-white/8 text-gray-600 hover:text-gray-300 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden mb-4">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Query</th><th>User</th><th>Status</th>
              <th>Method</th><th>Sources</th><th>Time</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-600 font-body text-sm">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading...
              </td></tr>
            ) : data.logs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-600 font-body text-sm">No logs found</td></tr>
            ) : data.logs.map(log => (
              <React.Fragment key={log.id}>
                <tr className="cursor-pointer" onClick={() => setSelected(selected?.id === log.id ? null : log)}>
                  <td className="max-w-xs">
                    <p className="text-gray-200 text-xs font-body truncate max-w-[200px]">{log.query}</p>
                  </td>
                  <td><span className="text-gray-500 text-xs font-mono">{log.user_id ?? 'anon'}</span></td>
                  <td><StatusBadge status={log.is_in_domain ? log.status : 'rejected'} /></td>
                  <td><span className="text-gray-600 text-xs font-mono">{log.retrieval_method || '—'}</span></td>
                  <td>
                    {log.sources_used?.length > 0
                      ? <span className="text-gray-600 text-xs font-mono">{log.sources_used.length} src</span>
                      : <span className="text-gray-700 text-xs font-mono">—</span>}
                  </td>
                  <td>
                    <span className={`font-mono text-xs ${
                      !log.response_time_ms ? 'text-gray-600' :
                      log.response_time_ms < 1000 ? 'text-emerald-400' :
                      log.response_time_ms < 2000 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {log.response_time_ms ? `${log.response_time_ms}ms` : '—'}
                    </span>
                  </td>
                  <td><span className="text-gray-600 text-xs font-mono">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span></td>
                </tr>
                {selected?.id === log.id && (
                  <tr>
                    <td colSpan={7} className="px-4 pb-3 bg-surface-1/50">
                      <div className="text-xs font-body space-y-2 pt-2">
                        <div><span className="text-gray-500">Query: </span><span className="text-gray-300">{log.query}</span></div>
                        {log.response && <div><span className="text-gray-500">Response: </span><span className="text-gray-400">{log.response}</span></div>}
                        {log.sources_used?.length > 0 && <div><span className="text-gray-500">Sources: </span><span className="text-gray-400 font-mono">{log.sources_used.join(', ')}</span></div>}
                        <div><span className="text-gray-500">Domain score: </span><span className="text-gray-400 font-mono">{log.domain_score?.toFixed(3) ?? '—'}</span></div>
                        <div><span className="text-gray-500">Validation confidence: </span><span className="text-gray-400 font-mono">{log.confidence_score?.toFixed(3) ?? '—'}</span></div>
                        {log.is_valid === false && (
                          <div className="text-rose-400">Flagged by response validator — {log.unverified_claims_count ?? '?'} unverified claim(s)</div>
                        )}
                        {log.status === 'resolved' && (
                          <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                            <span className="text-gray-500">Grade this answer:</span>
                            {['correct', 'partial', 'incorrect'].map(r => (
                              <button key={r} onClick={() => rateLog(log.id, r)}
                                className={`px-2 py-1 rounded text-xs font-display font-medium transition-colors border
                                  ${log.admin_rating === r
                                    ? r === 'correct' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                                    : r === 'partial' ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                                    : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                                    : 'text-gray-500 border-transparent hover:bg-white/5'}`}>
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-600 text-xs font-body">
            Page {page} of {data.pages} · {data.total} total
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/8 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
              className="p-1.5 rounded hover:bg-white/8 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
