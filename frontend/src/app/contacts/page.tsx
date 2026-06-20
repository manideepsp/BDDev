'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Users, Plus } from 'lucide-react';
import { getAllContacts, updateContactStatus, ContactWithContext } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

const STATUS_OPTIONS = ['new', 'contacted', 'in_conversation', 'won', 'lost', 'deprioritized'];

const PIPELINE_STATUS_DOT: Record<string, string> = {
  complete: 'bg-success',
  failed: 'bg-danger',
  default: 'bg-warning',
};

function ScoreRing({ score }: { score: number }) {
  const r = 14, c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
        transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{score}</text>
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

  const hasFilters = !!(search || filterConf || filterStatus || filterIndustry);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All identified prospects across every pipeline</p>
          </div>
          <Button asChild>
            <Link href="/analyze"><Plus className="w-4 h-4" />New Analysis</Link>
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Total Contacts', value: stats.total, className: 'text-foreground' },
            { label: 'High Confidence', value: stats.high, className: 'text-success' },
            { label: 'Active Conversations', value: stats.active, className: 'text-primary' },
            { label: 'Won', value: stats.won, className: 'text-success' },
          ].map(s => (
            <div key={s.label} className="bg-background border border-border rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold ${s.className}`}>{loading ? '—' : s.value}</div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Input
            className="flex-1 min-w-52"
            icon={<Search className="w-4 h-4" />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, title..."
          />
          <Select value={filterConf} onChange={e => setFilterConf(e.target.value)}>
            <option value="">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          {industries.length > 0 && (
            <Select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}>
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
          )}
          {hasFilters && (
            <Button variant="ghost" size="sm"
              onClick={() => { setSearch(''); setFilterConf(''); setFilterStatus(''); setFilterIndustry(''); }}>
              Clear filters
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {error && (
          <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div className="text-foreground font-semibold mb-1">No contacts yet</div>
            <p className="text-muted-foreground text-sm mb-4">Run company analyses to identify prospects</p>
            <Button asChild>
              <Link href="/analyze">Start Analysis</Link>
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {['Prospect', 'Company', 'Confidence', 'Score', 'Contact Angle', 'Status', ''].map((h, idx) => (
                    <th key={idx} className="text-left px-5 py-3">
                      {h && <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</p>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(contact => {
                  const dotColor = PIPELINE_STATUS_DOT[contact.pipeline_status] ?? PIPELINE_STATUS_DOT.default;
                  return (
                    <tr key={contact.id} className={`hover:bg-muted/30 transition-colors ${updatingId === contact.id ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-xs font-bold">
                              {(contact.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{contact.name || 'Unknown'}</div>
                            <div className="text-muted-foreground text-xs">{contact.title || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="font-medium text-foreground">{contact.company_name}</span>
                        </div>
                        {contact.industry && <div className="text-xs text-muted-foreground mt-0.5">{contact.industry}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={(contact.confidence as 'high' | 'medium' | 'low') ?? 'medium'}>
                          {contact.confidence}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {contact.engagement_score
                          ? <ScoreRing score={contact.engagement_score} />
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-56">
                        <p className="text-muted-foreground text-xs line-clamp-2 italic">{contact.contact_angle || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <Select
                          value={contact.prospect_status || 'new'}
                          onChange={e => handleStatusChange(contact.id, e.target.value)}
                          className="text-xs h-7 py-0"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3.5">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/pipeline/${contact.pipeline_id}/prospect/${contact.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
