import React, { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, Save, X, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const INITIAL_FAQS = [
  { id: 1, category: 'Academic', question: 'What is the minimum CGPA requirement to graduate?', answer: 'Students must maintain a minimum CGPA of 2.5 to be eligible for graduation. Students with CGPA below 2.0 will receive academic probation.', active: true },
  { id: 2, category: 'Administrative', question: 'How do I get my official transcript?', answer: 'Submit Form TR-01 to the department office. Processing takes 5-7 working days. Rush processing (2 days) costs an additional fee.', active: true },
  { id: 3, category: 'Exams', question: 'What is the attendance policy for exams?', answer: 'Minimum 75% attendance is required. Below 75% results in automatic NC grade. Medical certificates must be submitted within 3 working days.', active: true },
  { id: 4, category: 'Fees', question: 'When are tuition fees due?', answer: 'Fees are due within the first 2 weeks of each semester. Late payment incurs a 2% monthly surcharge. Scholarship students must confirm renewal annually.', active: false },
  { id: 5, category: 'Academic', question: 'Can I take courses from other departments?', answer: 'Yes, with advisor approval. Elective slots allow up to 2 courses from other departments per semester, subject to prerequisites.', active: true },
  { id: 6, category: 'Faculty', question: 'Who is the chairperson of CSE Department?', answer: 'Dr. Maheen Islam is the current chairperson of CSE department.', active: true },
];

const CATEGORIES = ['All', 'Academic', 'Administrative', 'Exams', 'Fees', 'Research', 'Other'];

const FAQItem = ({ faq, onEdit, onDelete, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const catColor = { Academic: '#6366f1', Administrative: '#10b981', Exams: '#f59e0b', Fees: '#f43f5e', Research: '#8b5cf6' };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${faq.active ? 'border-black/10 bg-surface-2' : 'border-black/5 bg-surface-1 opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="badge flex-shrink-0"
            style={{ background: `${catColor[faq.category] || '#6366f1'}15`, color: catColor[faq.category] || '#6366f1', border: `1px solid ${catColor[faq.category] || '#6366f1'}30` }}>
            {faq.category}
          </span>
          <p className="text-gray-900 text-sm font-body font-medium truncate">{faq.question}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onToggle(faq.id); }}
            className={`text-xs px-2 py-1 rounded font-display font-medium transition-colors ${faq.active ? 'text-emerald-600 bg-emerald-600/10' : 'text-gray-600 bg-black/[.03]'}`}>
            {faq.active ? 'Active' : 'Hidden'}
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(faq); }}
            className="p-1.5 rounded hover:bg-black/5 text-gray-500 hover:text-blue-400 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(faq.id); }}
            className="p-1.5 rounded hover:bg-black/5 text-gray-500 hover:text-rose-600 transition-colors">
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-black/8 pt-3">
          <p className="text-gray-600 text-sm font-body leading-relaxed">{faq.answer}</p>
        </div>
      )}
    </div>
  );
};

const FAQModal = ({ faq, onSave, onClose }) => {
  const [form, setForm] = useState(faq || { question: '', answer: '', category: 'Academic', active: true });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.question.trim() || !form.answer.trim()) { toast.error('Question and answer are required'); return; }
    onSave({ ...form, id: form.id || Date.now() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-2 border border-black/10 rounded-2xl overflow-hidden" style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-primary-600" />
            <h2 className="font-display font-semibold text-gray-900 text-base">{faq?.id ? 'Edit FAQ' : 'Add New FAQ'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/[.04] text-gray-500 hover:text-gray-900 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-display font-medium text-gray-600 mb-2">Category</label>
            <select value={form.category} onChange={e => update('category', e.target.value)}
              className="input-field text-sm">
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-display font-medium text-gray-600 mb-2">Question</label>
            <input type="text" value={form.question} onChange={e => update('question', e.target.value)}
              placeholder="Enter the FAQ question..." className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-display font-medium text-gray-600 mb-2">Answer</label>
            <textarea value={form.answer} onChange={e => update('answer', e.target.value)}
              placeholder="Enter the detailed answer..." rows={4}
              className="input-field text-sm resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="faq-active" checked={form.active}
              onChange={e => update('active', e.target.checked)} className="accent-indigo-500" />
            <label htmlFor="faq-active" className="text-sm text-gray-600 font-body">Active (visible to students)</label>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-black/8 justify-end">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-sm">Cancel</button>
          <button onClick={handleSave} className="btn-primary py-2 px-4 text-sm">
            <Save size={14} /> {faq?.id ? 'Save Changes' : 'Add FAQ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function FAQManager() {
  const [faqs, setFaqs] = useState(INITIAL_FAQS);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'new' | faq object

  const filtered = faqs.filter(f => {
    const matchCat = catFilter === 'All' || f.category === catFilter;
    const matchSearch = !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSave = (data) => {
    if (data.id && faqs.find(f => f.id === data.id)) {
      setFaqs(faqs.map(f => f.id === data.id ? data : f));
      toast.success('FAQ updated');
    } else {
      setFaqs([...faqs, data]);
      toast.success('FAQ added');
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this FAQ?')) {
      setFaqs(faqs.filter(f => f.id !== id));
      toast.success('FAQ deleted');
    }
  };

  const handleToggle = (id) => {
    setFaqs(faqs.map(f => f.id === id ? { ...f, active: !f.active } : f));
  };

  return (
    <AdminLayout title="FAQ Manager" subtitle={`${faqs.filter(f => f.active).length} active · ${faqs.length} total`}>
      {modal !== null && (
        <FAQModal faq={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search FAQs..." className="input-field pl-9 py-2 text-sm" />
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-colors ${catFilter === c ? 'bg-primary-600/20 text-primary-600 border border-primary-500/30' : 'text-gray-500 hover:text-gray-900 hover:bg-black/[.03] border border-transparent'}`}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => setModal('new')} className="btn-primary py-2 px-4 text-sm flex-shrink-0">
          <Plus size={14} /> Add FAQ
        </button>
      </div>

      {/* FAQ list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600 font-body">
            <HelpCircle size={28} className="mx-auto mb-3 opacity-40" />
            <p>No FAQs found</p>
          </div>
        ) : (
          filtered.map(faq => (
            <FAQItem key={faq.id} faq={faq}
              onEdit={f => setModal(f)}
              onDelete={handleDelete}
              onToggle={handleToggle} />
          ))
        )}
      </div>
    </AdminLayout>
  );
}
