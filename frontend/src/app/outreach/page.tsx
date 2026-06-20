'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Search, Send, CheckCircle2, Copy, MessageSquare, Mail, ChevronDown } from 'lucide-react';
import { getAllOutreach, updateOutreachTracking, EmailWithContext } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';

type TrackingStatus = 'all' | 'unsent' | 'sent' | 'replied';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);
  return (
    <Button variant="ghost" size="sm" onClick={copy}>
      <Copy className="w-3.5 h-3.5" />
      {copied ? 'Copied ✓' : 'Copy'}
    </Button>
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

  const statusVariant = isReplied ? 'success' : isSent ? 'active' : 'muted';
  const statusLabel = isReplied ? 'Replied' : isSent ? 'Sent' : 'Draft';

  return (
    <Card className="overflow-hidden animate-fade-in">
      {/* Card header */}
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-primary text-sm font-bold">
            {(email.to_name || email.prospect_name || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{email.to_name || email.prospect_name || 'Unknown'}</span>
            {email.to_title && <span className="text-muted-foreground text-xs">·</span>}
            {email.to_title && <span className="text-muted-foreground text-sm">{email.to_title || email.prospect_title}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {email.company_name && <span className="font-medium text-foreground">{email.company_name}</span>}
            {email.tone && <span className="ml-2">{email.tone}</span>}
          </div>
          <div className="font-medium text-foreground text-sm mt-1.5 truncate">{email.subject}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(e => !e)}>
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border">
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Email Body</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{email.body}</p>
          </div>
          {email.follow_up_subject && (
            <div className="px-5 pb-4 border-t border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-4">Follow-Up</p>
              <p className="text-xs font-medium text-foreground mb-1">{email.follow_up_subject}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{email.follow_up_body}</p>
            </div>
          )}
        </div>
      )}

      {/* Tracking timeline */}
      {(isSent || isReplied) && (
        <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          {isSent && (
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-primary" />
              Sent {new Date(email.sent_at!).toLocaleDateString()}
            </span>
          )}
          {isReplied && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              Replied {new Date(email.replied_at!).toLocaleDateString()}
            </span>
          )}
          {email.email_notes && (
            <span className="text-muted-foreground italic truncate max-w-48">{email.email_notes}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-border flex-wrap">
        <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} />
        {!isSent && (
          <Button variant="outline" size="sm" onClick={markSent}>
            <Send className="w-3.5 h-3.5" />Mark sent
          </Button>
        )}
        {isSent && !isReplied && (
          <Button variant="outline" size="sm" onClick={markReplied} className="text-success border-success/30 hover:bg-success-subtle">
            <CheckCircle2 className="w-3.5 h-3.5" />Got a reply
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowNotes(n => !n)}>
          <MessageSquare className="w-3.5 h-3.5" />Notes
        </Button>
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link href={`/pipeline/${email.pipeline_id}`}>Pipeline</Link>
        </Button>
      </div>

      {/* Notes inline editor */}
      {showNotes && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Add notes (next step, call outcome, etc.)"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNotes(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
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

  const sentPct = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const repliedPct = stats.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Outreach Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track every email — mark sent, log replies, add notes</p>
          </div>
        </div>

        {/* Funnel strip */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Emails Generated', value: stats.total, className: 'text-foreground', icon: <Mail className="w-5 h-5 text-muted-foreground" /> },
            { label: 'Sent', value: stats.sent, className: 'text-primary', icon: <Send className="w-5 h-5 text-primary" /> },
            { label: 'Replied', value: stats.replied, className: 'text-success', icon: <CheckCircle2 className="w-5 h-5 text-success" /> },
            { label: 'Reply Rate', value: `${replyRate}%`, className: replyRate >= 20 ? 'text-success' : replyRate >= 10 ? 'text-warning' : 'text-foreground', icon: <MessageSquare className="w-5 h-5 text-muted-foreground" /> },
          ].map(s => (
            <div key={s.label} className="bg-background border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              {s.icon}
              <div>
                <div className={`text-2xl font-bold ${s.className}`}>{loading ? '—' : s.value}</div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Funnel progress bars */}
        {!loading && stats.total > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12 text-right">Sent</span>
              <Progress value={sentPct} className="flex-1 h-1.5" indicatorClassName="bg-primary" />
              <span className="text-[10px] text-muted-foreground w-8">{sentPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12 text-right">Replied</span>
              <Progress value={repliedPct} className="flex-1 h-1.5" indicatorClassName="bg-success" />
              <span className="text-[10px] text-muted-foreground w-8">{repliedPct}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <Tabs value={filter} onValueChange={v => setFilter(v as TrackingStatus)}>
            <TabsList>
              {(['all', 'unsent', 'sent', 'replied'] as const).map(tab => (
                <TabsTrigger key={tab} value={tab} className="capitalize">{tab}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            className="flex-1 min-w-48"
            icon={<Search className="w-4 h-4" />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, name, subject..."
          />
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} email{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex gap-4">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <div className="text-foreground font-semibold mb-1">
              No emails {filter !== 'all' ? `with status "${filter}"` : 'generated yet'}
            </div>
            <p className="text-muted-foreground text-sm mb-4">Generate emails from prospect pages to track them here</p>
            <Button asChild>
              <Link href="/contacts">View Contacts</Link>
            </Button>
          </Card>
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
