import React, { useState, useRef, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { documentAPI } from '../../utils/api';
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const StatusBadge = ({ status }) => {
  const cfg = {
    indexed: { icon: CheckCircle, color: 'emerald', label: 'Indexed' },
    processing: { icon: Clock, color: 'amber', label: 'Processing' },
    failed: { icon: AlertCircle, color: 'rose', label: 'Failed' },
    uploaded: { icon: Clock, color: 'amber', label: 'Queued' },
  };
  const { icon: Icon, color, label } = cfg[status] || cfg.indexed;
  return (
    <span className={`badge bg-${color}-600/10 text-${color}-400 border border-${color}-500/20`}>
      <Icon size={10} />{label}
    </span>
  );
};

const FileIcon = ({ type }) => {
  const colors = { pdf: '#f43f5e', docx: '#3b82f6', txt: '#10b981' };
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: `${colors[type] || '#6366f1'}15`, border: `1px solid ${colors[type] || '#6366f1'}30` }}>
      <FileText size={16} style={{ color: colors[type] || '#6366f1' }} />
    </div>
  );
};

const fmt = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function DocumentUpload() {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileRef = useRef();

  const loadDocs = async () => {
    try {
      const [docList, docStats] = await Promise.all([documentAPI.list(), documentAPI.stats()]);
      setDocs(docList);
      setStats(docStats);
    } catch (err) {
      toast.error('Failed to load documents');
    }
  };

  useEffect(() => { loadDocs(); }, []);

  // Poll for processing docs
  useEffect(() => {
    const processing = docs.some(d => d.status === 'processing' || d.status === 'uploaded');
    if (!processing) return;
    const interval = setInterval(loadDocs, 3000);
    return () => clearInterval(interval);
  }, [docs]);

  const handleFiles = async (files) => {
    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'];
    const validFiles = Array.from(files).filter(f => allowed.includes(f.type));
    if (!validFiles.length) { toast.error('Only PDF, DOCX, and TXT files supported'); return; }

    setUploading(true);
    for (const file of validFiles) {
      try {
        setUploadProgress(p => ({ ...p, [file.name]: 0 }));
        await documentAPI.upload(file, (pct) => {
          setUploadProgress(p => ({ ...p, [file.name]: pct }));
        });
        toast.success(`${file.name} uploaded — indexing started`);
        setUploadProgress(p => { const n = { ...p }; delete n[file.name]; return n; });
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err.response?.data?.detail || err.message}`);
      }
    }
    setUploading(false);
    loadDocs();
  };

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await documentAPI.delete(id);
      toast.success('Document deleted');
      loadDocs();
    } catch { toast.error('Delete failed'); }
  };

  const handleReindex = async (id) => {
    try {
      await documentAPI.reindex(id);
      toast.success('Re-indexing started');
      loadDocs();
    } catch { toast.error('Re-index failed'); }
  };

  return (
    <AdminLayout title="Document Upload" subtitle="Manage the RAG knowledge base">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total_documents ?? '—', color: '#6366f1' },
          { label: 'Indexed', value: stats.indexed ?? '—', color: '#10b981' },
          { label: 'Processing', value: stats.processing ?? '—', color: '#f59e0b' },
          { label: 'Total Chunks', value: stats.total_chunks?.toLocaleString() ?? '—', color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <p className="font-display font-bold text-xl text-gray-900" style={{ color }}>{value}</p>
            <p className="text-gray-500 text-xs font-body mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 mb-5
          ${dragging ? 'border-primary-500 bg-primary-600/10' : 'border-black/10 hover:border-black/30 hover:bg-black/[.03]'}`}>
        <input ref={fileRef} type="file" className="hidden" multiple accept=".pdf,.docx,.txt"
          onChange={e => handleFiles(e.target.files)} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-600/15 border border-primary-500/20 flex items-center justify-center">
            <Upload size={22} className={dragging ? 'text-primary-600' : 'text-gray-500'} />
          </div>
          <div>
            <p className="font-display font-semibold text-gray-900 text-sm mb-1">
              {dragging ? 'Drop to upload' : 'Drag & drop files here'}
            </p>
            <p className="text-gray-600 text-xs font-body">PDF, DOCX, TXT · Max 50MB per file</p>
          </div>
          <span className="badge bg-primary-600/10 text-primary-600 border border-primary-500/20 text-xs">Click to browse</span>
        </div>
      </div>

      {/* Upload progress */}
      {Object.entries(uploadProgress).map(([name, pct]) => (
        <div key={name} className="mb-3 px-4 py-3 rounded-lg bg-surface-2 border border-black/8">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-body text-gray-600 truncate">{name}</span>
            <span className="text-xs font-mono text-primary-600">{pct}%</span>
          </div>
          <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}

      {/* Pipeline info */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-2 border border-black/8 text-xs font-mono text-gray-600 mb-5 overflow-x-auto">
        <span className="text-gray-500">Pipeline:</span>
        {['Upload', '→', 'Extract Text', '→', 'Chunk (512 tokens)', '→', 'SentenceTransformers', '→', 'FAISS Index'].map((s, i) => (
          <span key={i} className={s === '→' ? 'text-gray-700' : 'text-gray-500 whitespace-nowrap'}>{s}</span>
        ))}
      </div>

      {/* Documents table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-900 text-sm">Knowledge Base Documents</h2>
          <button onClick={loadDocs} className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-gray-900 transition-colors">
            <RefreshCw size={13} className={uploading ? 'animate-spin' : ''} />
          </button>
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-12 text-gray-600 font-body text-sm">
            <FileText size={28} className="mx-auto mb-3 opacity-30" />
            No documents uploaded yet
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Document</th><th>Status</th><th>Chunks</th>
                <th>Size</th><th>Uploaded</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <FileIcon type={doc.file_type} />
                      <div>
                        <p className="text-gray-800 text-sm font-body">{doc.original_filename}</p>
                        {doc.page_count && <p className="text-gray-600 text-xs font-mono">{doc.page_count} pages</p>}
                        {doc.error_message && <p className="text-rose-600 text-xs font-mono">{doc.error_message.slice(0, 50)}</p>}
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td><span className="font-mono text-sm text-gray-600">{doc.chunk_count ?? '—'}</span></td>
                  <td><span className="text-gray-500 text-xs font-mono">{fmt(doc.file_size)}</span></td>
                  <td><span className="text-gray-600 text-xs font-mono">
                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                  </span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReindex(doc.id)}
                        className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-blue-400 transition-colors" title="Re-index">
                        <RefreshCw size={13} />
                      </button>
                      <button onClick={() => handleDelete(doc.id, doc.original_filename)}
                        className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-rose-600 transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
