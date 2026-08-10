import React, { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Plus, Pencil, Trash2, Search, Save, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const INITIAL_PROCEDURES = [
  {
    id: 1, title: 'Thesis Submission Process', category: 'Academic',
    steps: ['Get supervisor approval by November 30', 'Upload soft copy to portal by December 15', 'Submit 3 hard copies to department office by December 17', 'Pay binding fee at accounts section', 'Collect receipt and submit to coordinator'],
    active: true, lastUpdated: '2025-01-05',
  },
  {
    id: 2, title: 'Course Waiver Application', category: 'Administrative',
    steps: ['Obtain Form DW-01 from department office', 'Attach syllabi from equivalent course', 'Get supervisor signature', 'Submit to Academic Section before add/drop deadline', 'Await 7-10 day processing time'],
    active: true, lastUpdated: '2025-01-03',
  },
  {
    id: 3, title: 'Transcript Request', category: 'Administrative',
    steps: ['Fill Form TR-01 at department office', 'Pay applicable fee at accounts', 'Attach payment receipt to form', 'Submit to department office', 'Collect after 5-7 working days'],
    active: true, lastUpdated: '2024-12-28',
  },
  {
    id: 4, title: 'Exam Re-evaluation Request', category: 'Exams',
    steps: ['Apply within 7 days of result publication', 'Fill Form RE-02 and pay re-evaluation fee', 'Submit to exam section with course details', 'Results published within 14 working days'],
    active: true, lastUpdated: '2024-12-20',
  },
];

const CATEGORIES = ['All', 'Academic', 'Administrative', 'Exams', 'Research', 'Finance'];

const ProcedureCard = ({ proc, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const catColor = { Academic: '#6366f1', Administrative: '#10b981', Exams: '#f59e0b', Research: '#8b5cf6', Finance: '#f43f5e' };
  const color = catColor[proc.category] || '#6366f1';

  return (
    <div className="card hover:border-black/15 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
            <FileText size={15} style={{ color }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-gray-900 text-sm truncate">{proc.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="badge text-xs" style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                {proc.category}
              </span>
              <span className="text-gray-700 text-xs font-mono">{proc.steps.length} steps</span>
              <span className="text-gray-700 text-xs font-mono">· {proc.lastUpdated}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onEdit(proc)}
            className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-blue-400 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(proc.id)}
            className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-rose-600 transition-colors">
            <Trash2 size={13} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-black/[.04] text-gray-600 hover:text-gray-900 transition-colors">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-black/8 pt-3 space-y-2">
          {proc.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                <span className="text-xs font-display font-bold" style={{ color }}>{i + 1}</span>
              </div>
              <p className="text-gray-600 text-sm font-body leading-snug">{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProcedureModal = ({ proc, onSave, onClose }) => {
  const [form, setForm] = useState(proc || { title: '', category: 'Academic', steps: [''], active: true });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateStep = (i, v) => setForm(f => ({ ...f, steps: f.steps.map((s, idx) => idx === i ? v : s) }));
  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, ''] }));
  const removeStep = (i) => setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (form.steps.some(s => !s.trim())) { toast.error('All steps must be filled'); return; }
    onSave({ ...form, id: form.id || Date.now(), lastUpdated: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-2 border border-black/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 flex-shrink-0">
          <h2 className="font-display font-semibold text-gray-900 text-base flex items-center gap-2">
            <FileText size={16} className="text-primary-600" />
            {proc?.id ? 'Edit Procedure' : 'New Procedure'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/[.04] text-gray-500 hover:text-gray-900 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Title</label>
              <input type="text" value={form.title} onChange={e => update('title', e.target.value)}
                placeholder="Procedure title" className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-display font-medium text-gray-600 mb-2">Category</label>
              <select value={form.category} onChange={e => update('category', e.target.value)}
                className="input-field text-sm">
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-display font-medium text-gray-600">Steps</label>
              <button onClick={addStep} className="text-xs text-primary-600 hover:text-primary-700 font-display font-medium transition-colors flex items-center gap-1">
                <Plus size={11} /> Add step
              </button>
            </div>
            <div className="space-y-2">
              {form.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-display font-bold text-primary-600">{i + 1}</span>
                  </div>
                  <input type="text" value={step} onChange={e => updateStep(i, e.target.value)}
                    placeholder={`Step ${i + 1}...`} className="input-field text-sm flex-1 py-2" />
                  {form.steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="text-gray-600 hover:text-rose-600 transition-colors p-1">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-black/8 justify-end flex-shrink-0">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-sm">Cancel</button>
          <button onClick={handleSave} className="btn-primary py-2 px-4 text-sm">
            <Save size={14} /> {proc?.id ? 'Save Changes' : 'Create Procedure'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ProcedureManager() {
  const [procedures, setProcedures] = useState(INITIAL_PROCEDURES);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState(null);

  const filtered = procedures.filter(p => {
    const matchCat = catFilter === 'All' || p.category === catFilter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSave = (data) => {
    if (data.id && procedures.find(p => p.id === data.id)) {
      setProcedures(procedures.map(p => p.id === data.id ? data : p));
      toast.success('Procedure updated');
    } else {
      setProcedures([...procedures, data]);
      toast.success('Procedure created');
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this procedure?')) {
      setProcedures(procedures.filter(p => p.id !== id));
      toast.success('Procedure deleted');
    }
  };

  return (
    <AdminLayout title="Procedure Manager" subtitle={`${procedures.length} procedures in knowledge base`}>
      {modal !== null && (
        <ProcedureModal proc={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search procedures..." className="input-field pl-9 py-2 text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-colors ${catFilter === c ? 'bg-primary-600/20 text-primary-600 border border-primary-500/30' : 'text-gray-500 hover:text-gray-900 border border-transparent hover:bg-black/[.03]'}`}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => setModal('new')} className="btn-primary py-2 px-4 text-sm flex-shrink-0">
          <Plus size={14} /> New Procedure
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-gray-600 font-body">
            <FileText size={28} className="mx-auto mb-3 opacity-40" />
            <p>No procedures found</p>
          </div>
        ) : filtered.map(p => (
          <ProcedureCard key={p.id} proc={p} onEdit={setModal} onDelete={handleDelete} />
        ))}
      </div>
    </AdminLayout>
  );
}
