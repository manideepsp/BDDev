'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { getAllOutreach, updateOutreachTracking, EmailWithContext } from '@/lib/api';

type TrackingStatus = 'all' | 'unsent' | 'sent' | 'replied';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);
  return (
    <button onClick={copy}
      className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1">
      {copied ? (
        <><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
      )}
    </button>
  );
}

function EmailCard({ email, onUpdate }: { email: EmailWithContext; onUpdate: (id: string, fields: Partial<EmailWithContext>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(email.email_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const isSent = !!email.sent_at;
  const isReplied = !!email.replied_at;

  async function markSent() {
    const now = new Date().toISOString();
    await updateOutreachTracking(email.id, { sent_at: now });
    onUpdate(email.id, { sent_at: now });
  }

  async function markReplied() {
    const now = new Date().toISOString();
    const fields: Record<string, string> = { replied_at: now };
    if (!email.sent_at) fields.sent_at = now;
    await updateOutreachTracking(email.id, fields);
    onUpdate(email.id, { replied_at: now, sent_at: email.sent_at || now });
  }

  async function saveNotes() {
    setSavingNotes(true);
    await updateOutreachTracking(email.id, { email_notes: notes });
    onUpdate(email.id, { email_notes: notes });
    setSavingNotes(false);
    setShowNotes(false);
  }

  const statusBadge = isReplied
    ? 'bg-emerald-100 text-emerald-700'
    : isSent
    ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-500';
  const statusLabel = isReplied ? 'Replied' : isSent ? 'Sent' : 'Draft';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-indigo-700 text-sm font-bold">
            {(email.to_name || email.prospect_name || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{email.to_name || email.prospect_name || 'Unknown'}</span>
            {email.to_title && <span className="text-slate-400 text-xs">·</span>}
            {email.to_title && <span className="text-slate-500 text-sm">{email.to_title || email.prospect_title}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {email.company_name && <span className="font-medium text-slate-700">{email.company_name}</span>}
            {email.tone && <span className="ml-2 text-slate-400">{email.tone}</span>}
          </div>
          <div className="font-medium text-slate-800 text-sm mt-1.5 truncate">{email.subject}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge}`}>{statusLabel}</span>
          <button onClick={() => setExpanded(e => !e)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Body</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{email.body}</p>
          </div>
          {email.follow_up_subject && (
            <div className="px-5 pb-4 border-t border-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 mt-4">Follow-Up</p>
              <p className="text-xs font-medium text-slate-600 mb-1">{email.follow_up_subject}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{email.follow_up_body}</p>
            </div>
          )}
        </div>
      )}

      {/* Tracking timeline */}
      {(isSent || isReplied) && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          {isSent && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Sent {new Date(email.sent_at!).toLocaleDateString()}
            </span>
          )}
          {isReplied && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              Replied {new Date(email.replied_at!).toLocaleDateString()}
            </span>
          )}
          {email.email_notes && (
            <span className="text-slate-400 italic truncate max-w-48">{email.email_notes}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100 flex-wrap">
        <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} />
        {!isSent && (
          <button onClick={markSent}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Mark sent
          </button>
        )}
        {isSent && !isReplied && (
          <button onClick={markReplied}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Got a reply
          </button>
        )}
        <button onClick={() => setShowNotes(n => !n)}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Notes
        </button>
        <Link href={`/pipeline/${email.pipeline_id}`}
          className="text-xs font-medium text-slate-400 hover:text-indigo-600 ml-auto">
          Pipeline →
        </Link>
      </div>

      {/* Notes inline editor */}
      {showNotes && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-3">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Add notes (next step, call outcome, etc.)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="flex gap-2 mt-2">
            <button onClick={saveNotes} disabled={savingNotes}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {savingNotes ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowNotes(false)}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OutreachPage() {
  const [emails, setEmails] = useState<EmailWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TrackingStatus>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllOutreach()
      .then(setEmails)
      .finally(() => setLoading(false));
  }, []);

  function handleUpdate(id: string, fields: Partial<EmailWithContext>) {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
  }

  const stats = useMemo(() => ({
    total: emails.length,
    sent: emails.filter(e => e.sent_at).length,
    replied: emails.filter(e => e.replied_at).length,
    unsent: emails.filter(e => !e.sent_at).length,
  }), [emails]);

  const replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return emails.filter(e => {
      if (filter === 'sent' && (!e.sent_at || e.replied_at)) return false;
      if (filter === 'replied' && !e.replied_at) return false;
      if (filter === 'unsent' && e.sent_at) return false;
      if (q && !e.company_name?.toLowerCase().includes(q) && !(e.to_name || e.prospect_name)?.toLowerCase().includes(q) && !e.subject?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [emails, filter, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Outreach Tracker</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track every email — mark sent, log replies, add notes</p>
          </div>
        </div>

        {/* Funnel strip */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Emails Generated', value: stats.total, icon: '✉️', color: 'text-slate-900' },
            { label: 'Sent', value: stats.sent, icon: '📤', color: 'text-blue-600' },
            { label: 'Replied', value: stats.replied, icon: '↩️', color: 'text-emerald-600' },
            { label: 'Reply Rate', value: `${replyRate}%`, icon: '📊', color: replyRate >= 20 ? 'text-emerald-600' : replyRate >= 10 ? 'text-amber-600' : 'text-slate-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Funnel bar */}
        {!loading && stats.total > 0 && (
          <div className="mt-4 flex items-center gap-1 h-2">
            <div className="bg-slate-200 rounded-full flex-1 h-full" />
            {stats.sent > 0 && (
              <div className="bg-blue-400 rounded-full h-full transition-all"
                style={{ width: `${(stats.sent / stats.total) * 100}%` }} />
            )}
            {stats.replied > 0 && (
              <div className="bg-emerald-400 rounded-full h-full transition-all"
                style={{ width: `${(stats.replied / stats.total) * 100}%` }} />
            )}
          </div>
        )}
      </div>

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {(['all', 'unsent', 'sent', 'replied'] as const).map(tab => (
              <button key={tab} onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  filter === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-48">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, name, subject..."
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} email{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex gap-4">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="text-3xl mb-3">📬</div>
            <div className="text-slate-700 font-semibold mb-1">No emails {filter !== 'all' ? `with status "${filter}"` : 'generated yet'}</div>
            <p className="text-slate-500 text-sm mb-4">Generate emails from prospect pages to track them here</p>
            <Link href="/contacts" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-block">
              View Contacts
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(email => (
              <EmailCard key={email.id} email={email} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
