'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getAllContacts, updateContactStatus, ContactWithContext } from '@/lib/api';

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-red-100 text-red-700',
};

const STATUS_STYLES: Record<string, string> = {
  new:            'bg-slate-100 text-slate-600',
  contacted:      'bg-blue-100 text-blue-700',
  in_conversation:'bg-indigo-100 text-indigo-700',
  won:            'bg-emerald-100 text-emerald-700',
  lost:           'bg-red-100 text-red-700',
  deprioritized:  'bg-slate-100 text-slate-400',
};

const STATUS_OPTIONS = ['new', 'contacted', 'in_conversation', 'won', 'lost', 'deprioritized'];

const PIPELINE_STATUS_DOT: Record<string, string> = {
  complete: 'bg-emerald-500',
  failed:   'bg-red-400',
  default:  'bg-amber-400',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

function StatusDropdown({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  return (
    <select
      value={current || 'new'}
      onChange={e => onChange(e.target.value)}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 cursor-pointer"
    >
      {STATUS_OPTIONS.map(s => (
        <option key={s} value={s}>{s.replace('_', ' ')}</option>
      ))}
    </select>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 12, c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
      <circle cx="16" cy="16" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
        transform="rotate(-90 16 16)" />
      <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterConf, setFilterConf] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    getAllContacts()
      .then(setContacts)
      .catch(() => setError('Failed to load contacts'))
      .finally(() => setLoading(false));
  }, []);

  const industries = useMemo(() => {
    const set = new Set(contacts.map(c => c.industry || '').filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      if (q && !c.name?.toLowerCase().includes(q) && !c.company_name?.toLowerCase().includes(q) && !c.title?.toLowerCase().includes(q)) return false;
      if (filterConf && c.confidence !== filterConf) return false;
      if (filterStatus && (c.prospect_status || 'new') !== filterStatus) return false;
      if (filterIndustry && c.industry !== filterIndustry) return false;
      return true;
    });
  }, [contacts, search, filterConf, filterStatus, filterIndustry]);

  const stats = useMemo(() => ({
    total: contacts.length,
    high: contacts.filter(c => c.confidence === 'high').length,
    won: contacts.filter(c => c.prospect_status === 'won').length,
    active: contacts.filter(c => ['contacted', 'in_conversation'].includes(c.prospect_status || '')).length,
  }), [contacts]);

  async function handleStatusChange(contactId: string, status: string) {
    setUpdatingId(contactId);
    try {
      await updateContactStatus(contactId, status);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, prospect_status: status } : c));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
            <p className="text-sm text-slate-500 mt-0.5">All identified prospects across every pipeline</p>
          </div>
          <Link href="/analyze"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Analysis
          </Link>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Total Contacts', value: stats.total, color: 'text-slate-900' },
            { label: 'High Confidence', value: stats.high, color: 'text-emerald-600' },
            { label: 'Active Conversations', value: stats.active, color: 'text-indigo-600' },
            { label: 'Won', value: stats.won, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, title..."
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
          <select value={filterConf} onChange={e => setFilterConf(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700">
            <option value="">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {industries.length > 0 && (
            <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700">
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
          {(search || filterConf || filterStatus || filterIndustry) && (
            <button onClick={() => { setSearch(''); setFilterConf(''); setFilterStatus(''); setFilterIndustry(''); }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Clear filters
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="text-3xl mb-3">👥</div>
            <div className="text-slate-700 font-semibold mb-1">No contacts yet</div>
            <p className="text-slate-500 text-sm mb-4">Run company analyses to identify prospects</p>
            <Link href="/analyze" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-block">
              Start Analysis
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prospect</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Company</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confidence</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Score</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contact Angle</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(contact => {
                  const dotColor = PIPELINE_STATUS_DOT[contact.pipeline_status] ?? PIPELINE_STATUS_DOT.default;
                  return (
                    <tr key={contact.id} className={`hover:bg-slate-50 transition-colors ${updatingId === contact.id ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-700 text-xs font-bold">
                              {(contact.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{contact.name || 'Unknown'}</div>
                            <div className="text-slate-500 text-xs">{contact.title || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="font-medium text-slate-800">{contact.company_name}</span>
                        </div>
                        {contact.industry && <div className="text-xs text-slate-400 mt-0.5">{contact.industry}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONFIDENCE_STYLES[contact.confidence] ?? CONFIDENCE_STYLES.medium}`}>
                          {contact.confidence}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {contact.engagement_score ? <ScoreRing score={contact.engagement_score} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-56">
                        <p className="text-slate-600 text-xs line-clamp-2 italic">{contact.contact_angle || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusDropdown
                          current={contact.prospect_status || 'new'}
                          onChange={s => handleStatusChange(contact.id, s)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/pipeline/${contact.pipeline_id}/prospect/${contact.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap">
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
