'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LinkedInPost, RefineRequest,
  generateLinkedInPosts, listLinkedInPosts, updateLinkedInPostStatus,
  deleteLinkedInPost, refineLinkedInPost,
  LinkedInTarget, FetchedPost, PostIdea, HookEntry,
  LinkedInAnalysis, PostScore, ThreadResult, FirstComment, RemixResult,
  LinkedInAnalytics, ScheduledPost, ContentBrief,
  addLinkedInTarget, listLinkedInTargets, deleteLinkedInTarget,
  fetchAndAnalyzeLinkedIn, getLinkedInAnalysis,
  startIdeaDraft, refineIdeaDraft, publishIdeaAsPost,
  scoreLinkedInPost, buildLinkedInThread, generateFirstComment, remixCompetitorPost,
  getCompanyProfile, CompanyProfile,
  getLinkedInAnalytics, getScheduledPosts, updateLinkedInPost, exportContentBrief,
} from '@/lib/api';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';

import {
  PenLine, BarChart2, Calendar, Target, Sparkles, Copy, Trash2,
  Check, Plus, X, RefreshCw, ChevronDown, ChevronUp, Search, Filter,
  Send, Clock, Tag, MessageSquare, Star, Zap, RotateCcw, Eye, Loader2,
  ArrowRight, CheckCircle2, Lightbulb,
} from 'lucide-react';

function Linkedin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

// ── Toast system ──────────────────────────────────────────────────────────────

interface Toast { id: string; msg: string; type: 'success' | 'error' | 'info'; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          'px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-up pointer-events-auto',
          t.type === 'success' ? 'bg-success text-success-foreground' :
          t.type === 'error'   ? 'bg-destructive text-destructive-foreground' :
          'bg-card text-foreground border border-border'
        )}>
          {t.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> :
           t.type === 'error'   ? <X className="w-4 h-4 flex-shrink-0" /> :
           <Lightbulb className="w-4 h-4 flex-shrink-0" />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, toast };
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/6 mb-4" />
        <div className="flex gap-2 border-t border-border pt-3">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const HOOK_COLORS: Record<string, string> = {
  question:   'bg-primary/10 text-primary',
  stat:       'bg-success-subtle text-success',
  story:      'bg-purple-100 text-purple-700',
  contrarian: 'bg-warning-subtle text-warning-foreground',
  bold_claim: 'bg-danger-subtle text-danger',
};

const ANGLE_COLORS: Record<string, string> = {
  contrarian: 'bg-warning-subtle text-warning-foreground',
  trend:      'bg-purple-100 text-purple-700',
  story:      'bg-primary/10 text-primary',
  'how-to':   'bg-success-subtle text-success',
  data:       'bg-indigo-100 text-indigo-700',
  opinion:    'bg-pink-100 text-pink-700',
};

const STRATEGY_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted' }> = {
  trend_spotlight: { label: 'Trend Spotlight',  variant: 'default' },
  pain_narrative:  { label: 'Pain Narrative',   variant: 'danger' },
  contrarian:      { label: 'Contrarian Take',  variant: 'warning' },
  how_we_help:     { label: 'How We Help',      variant: 'default' },
  industry_take:   { label: 'Industry Take',    variant: 'secondary' },
  case_signal:     { label: 'Case Signal',      variant: 'success' },
};

const PERSONAS = [
  { value: 'auto',            label: 'Auto',            desc: 'Balanced, inferred from profile',     icon: Zap },
  { value: 'founder',         label: 'Founder Voice',   desc: 'Visionary, candid, big-picture',      icon: Star },
  { value: 'technical',       label: 'Technical Expert', desc: 'Precise, credible, how-things-work', icon: Target },
  { value: 'business_leader', label: 'Business Leader', desc: 'ROI-focused, executive-level',        icon: BarChart2 },
  { value: 'bd_lead',         label: 'BD Lead',         desc: 'Client-centric, opportunity-aware',   icon: Linkedin },
];

function charCountVariant(n: number): 'success' | 'warning' | 'danger' {
  return n <= 1300 ? 'success' : n <= 1700 ? 'warning' : 'danger';
}

function charProgressColor(n: number) {
  return n <= 1300 ? 'bg-success' : n <= 1700 ? 'bg-warning' : 'bg-danger';
}

// ── Analytics bar ─────────────────────────────────────────────────────────────

function AnalyticsBar({ analytics }: { analytics: LinkedInAnalytics | null }) {
  if (!analytics) return null;
  const items = [
    { label: 'Generated',    value: analytics.this_month_generated, icon: Sparkles },
    { label: 'Published',    value: analytics.this_month_published,  icon: CheckCircle2 },
    { label: 'Scheduled',    value: analytics.scheduled_posts,       icon: Calendar },
    { label: 'Ideas drafted', value: analytics.drafted_ideas,        icon: PenLine },
    { label: 'Tracked',      value: analytics.targets_tracked,       icon: Eye },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap mt-4 pt-4 border-t border-border">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-base font-bold text-foreground">{item.value}</span>
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Content Calendar (2-week view) ────────────────────────────────────────────

interface CalendarProps {
  scheduledPosts: ScheduledPost[];
  ideas: PostIdea[];
  onAssignIdea: (ideaId: string, date: string) => void;
  onJumpToPost: (postId: string) => void;
}

function ContentCalendar({ scheduledPosts, ideas, onAssignIdea, onJumpToPost }: CalendarProps) {
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [showIdeaPicker, setShowIdeaPicker] = useState<string | null>(null);

  const days: { date: Date; iso: string; label: string; dayName: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    days.push({ date: d, iso, label: d.getDate().toString(), dayName: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }

  const byDay = scheduledPosts.reduce<Record<string, ScheduledPost[]>>((acc, p) => {
    const day = (p.planned_date || '').split('T')[0];
    if (day) { acc[day] = acc[day] || []; acc[day].push(p); }
    return acc;
  }, {});

  const unscheduledIdeas = ideas.filter(i => i.status === 'idea');

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">14-Day Content Calendar</p>
          <Badge variant="muted" size="sm">{unscheduledIdeas.length} unscheduled idea{unscheduledIdeas.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="grid grid-cols-7 gap-1.5 min-w-[600px] overflow-x-auto">
          {days.map(day => {
            const posts = byDay[day.iso] || [];
            const isToday = day.iso === today.toISOString().split('T')[0];
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
            return (
              <div key={day.iso} className="relative"
                onMouseEnter={() => setHoverDay(day.iso)}
                onMouseLeave={() => setHoverDay(null)}>
                <div className={cn(
                  'min-h-[80px] rounded-xl border p-2 transition-colors cursor-pointer',
                  isToday    ? 'border-primary/50 bg-primary/5' :
                  isWeekend  ? 'border-border bg-muted/40' :
                  hoverDay === day.iso ? 'border-primary/30 bg-card' :
                  'border-border bg-card'
                )}
                  onClick={() => { if (unscheduledIdeas.length > 0) setShowIdeaPicker(prev => prev === day.iso ? null : day.iso); }}>
                  <p className={cn('text-[10px] font-medium mb-0.5', isToday ? 'text-primary' : 'text-muted-foreground')}>{day.dayName}</p>
                  <p className={cn('text-sm font-bold', isToday ? 'text-primary' : 'text-foreground')}>{day.label}</p>
                  {posts.map(p => (
                    <div key={p.id} onClick={e => { e.stopPropagation(); onJumpToPost(p.id); }}
                      className="mt-1 text-[10px] bg-success-subtle text-success px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-success/20 transition-colors">
                      {p.trend_cluster || p.strategy || 'Post'}
                    </div>
                  ))}
                  {posts.length === 0 && hoverDay === day.iso && unscheduledIdeas.length > 0 && (
                    <div className="mt-1 text-[10px] text-primary/60 italic">+ add idea</div>
                  )}
                </div>
                {showIdeaPicker === day.iso && unscheduledIdeas.length > 0 && (
                  <div className="absolute top-full left-0 z-20 mt-1 bg-card rounded-2xl border border-border shadow-card p-3 w-56 animate-fade-in">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assign idea</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {unscheduledIdeas.map(idea => (
                        <button key={idea.id} onClick={() => { onAssignIdea(idea.id, day.iso); setShowIdeaPicker(null); }}
                          className="w-full text-left text-xs text-foreground hover:bg-primary/5 px-2 py-1.5 rounded-lg transition-colors">
                          {idea.topic}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowIdeaPicker(null)} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground w-full text-center">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────

interface HistoryEntry { role: 'user' | 'assistant'; content: string; }

interface RefinePanelProps {
  post: LinkedInPost; onApply: (c: string) => void; onClose: () => void;
  history: HistoryEntry[]; editContent: string | undefined;
  onUpdate: (content: string, history: HistoryEntry[]) => void;
}

function RefinePanel({ post, onApply, onClose, history, editContent, onUpdate }: RefinePanelProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentContent = editContent ?? post.content;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  async function handleSend() {
    if (!message.trim() || loading) return;
    const msg = message.trim(); setMessage(''); setLoading(true); setError('');
    try {
      const res = await refineLinkedInPost(post.id, { message: msg, current_content: currentContent, history });
      onUpdate(res.content, res.history as HistoryEntry[]);
    } catch { setError('Refine failed — try again'); }
    finally { setLoading(false); }
  }

  return (
    <div className="border-l-2 border-primary/30 ml-4 pl-4 mt-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Edit with AI</p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="w-3.5 h-3.5" /></Button>
      </div>
      {editContent && editContent !== post.content && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Refined version</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{editContent}</p>
          <div className="flex gap-3 mt-3">
            <Button size="sm" onClick={() => onApply(editContent)}>Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate(post.content, [])}>Revert</Button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className={cn(
              'px-3 py-2 rounded-lg text-xs leading-relaxed',
              h.role === 'user' ? 'bg-muted text-foreground ml-6' : 'bg-card border border-border text-muted-foreground mr-6'
            )}>
              <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">{h.role === 'user' ? 'You' : 'AI'}</span>
              <span className="whitespace-pre-wrap">{h.content.length > 150 ? h.content.slice(0, 150) + '…' : h.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Make it shorter, add a stat, stronger hook..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={!message.trim() || loading} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

interface PostCardProps {
  post: LinkedInPost & { planned_date?: string; post_notes?: string };
  isRefineOpen: boolean; refineHistory: HistoryEntry[];
  editContent: string | undefined; isSelected: boolean;
  onToggleSelect: () => void; onToggleRefine: () => void;
  onRefineUpdate: (content: string, history: HistoryEntry[]) => void;
  onApplyRefine: (postId: string, newContent: string) => void;
  onStatusChange: (postId: string, status: string) => void;
  onDelete: (postId: string) => void;
  onSchedule: (postId: string, date: string) => void;
  onCopy: (content: string) => void;
}

function PostCard({ post, isRefineOpen, refineHistory, editContent, isSelected, onToggleSelect, onToggleRefine, onRefineUpdate, onApplyRefine, onStatusChange, onDelete, onSchedule, onCopy }: PostCardProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [datePick, setDatePick] = useState(post.planned_date ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = STRATEGY_META[post.strategy] ?? { label: post.strategy || 'Post', variant: 'muted' as const };
  const count = editContent ? editContent.length : post.char_count;
  const display = editContent ?? post.content;
  const charPct = Math.min(100, Math.round((count / 3000) * 100));

  return (
    <Card className={cn('transition-all', isSelected ? 'border-primary/40 ring-1 ring-primary/20' : '')}>
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1 w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary flex-shrink-0 cursor-pointer"
          />
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
            {post.trend_cluster && (
              <Badge variant="secondary" size="sm">{post.trend_cluster}</Badge>
            )}
            {post.planned_date && (
              <Badge variant="warning" size="sm">
                <Calendar className="w-3 h-3" />
                {new Date(post.planned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Badge>
            )}
            {post.status === 'selected' && (
              <Badge variant="success" size="sm" className="ml-auto"><Check className="w-3 h-3" /> Selected</Badge>
            )}
            {post.status === 'posted' && (
              <Badge variant="muted" size="sm" className="ml-auto"><CheckCircle2 className="w-3 h-3" /> Posted</Badge>
            )}
          </div>
        </div>

        {post.strategy_note && <p className="text-[11px] text-muted-foreground italic mb-3 leading-relaxed">{post.strategy_note}</p>}
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-3">{display}</p>

        {/* Char count progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Character count</span>
            <Badge variant={charCountVariant(count)} size="sm">{count} chars</Badge>
          </div>
          <Progress value={charPct} indicatorClassName={charProgressColor(count)} className="h-1" />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3">
          {post.status !== 'selected' && post.status !== 'posted' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(post.id, 'selected')}>Select</Button>
          )}
          {post.status === 'selected' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(post.id, 'posted')}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Posted
            </Button>
          )}

          <Button
            size="sm"
            variant={isRefineOpen ? 'secondary' : 'outline'}
            onClick={onToggleRefine}
          >
            <PenLine className="w-3.5 h-3.5" /> Edit with AI
          </Button>

          <Button
            size="icon-sm"
            variant={showSchedule ? 'secondary' : 'outline'}
            onClick={() => setShowSchedule(s => !s)}
            title="Schedule"
          >
            <Calendar className="w-3.5 h-3.5" />
          </Button>

          <Button size="icon-sm" variant="outline" onClick={() => onCopy(display)} title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </Button>

          <div className="ml-auto">
            {!confirmDelete ? (
              <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-danger hover:bg-danger-subtle">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button size="sm" variant="destructive" onClick={() => onDelete(post.id)}>Yes</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule picker */}
        {showSchedule && (
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border animate-fade-in">
            <label className="text-xs text-muted-foreground flex-shrink-0">Plan for:</label>
            <input
              type="date"
              value={datePick}
              onChange={e => setDatePick(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex h-9 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={() => { onSchedule(post.id, datePick); setShowSchedule(false); }} disabled={!datePick}>
              Save
            </Button>
            {post.planned_date && (
              <Button size="sm" variant="ghost" onClick={() => { onSchedule(post.id, ''); setDatePick(''); setShowSchedule(false); }}>
                Clear
              </Button>
            )}
          </div>
        )}

        {isRefineOpen && (
          <RefinePanel
            post={post}
            history={refineHistory}
            editContent={editContent}
            onApply={c => onApplyRefine(post.id, c)}
            onClose={onToggleRefine}
            onUpdate={onRefineUpdate}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Intelligence Tab ──────────────────────────────────────────────────────────

interface IntelligenceTabProps {
  companyProfile: Partial<CompanyProfile> | null;
  targets: LinkedInTarget[];
  analysis: LinkedInAnalysis | null;
  fetching: boolean;
  onAddTarget: (name: string, url: string) => void;
  onDeleteTarget: (id: string) => void;
  onFetchAnalyze: (force?: boolean) => void;
  onSelectIdea: (idea: PostIdea) => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

function IntelligenceTab({ companyProfile, targets, analysis, fetching, onAddTarget, onDeleteTarget, onFetchAnalyze, onSelectIdea, toast }: IntelligenceTabProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [hookOpen, setHookOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [remixResults, setRemixResults] = useState<Record<string, RemixResult>>({});
  const [remixing, setRemixing] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  const ownName = companyProfile?.company_name;
  const fetchedPosts = analysis?.fetched_posts ?? [];
  const targetPosts = fetchedPosts.filter(p => p.source_type === 'target');

  async function handleRemix(post: FetchedPost) {
    setRemixing(post.id);
    try {
      const result = await remixCompetitorPost(post.content ?? post.title ?? '', post.company_name);
      setRemixResults(prev => ({ ...prev, [post.id]: result }));
    } catch { toast('Remix failed — try again', 'error'); }
    finally { setRemixing(null); }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left: Companies panel */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Companies to watch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ownName ? (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                <Star className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-primary truncate flex-1">{ownName}</span>
                <Badge variant="default" size="sm">Your company</Badge>
              </div>
            ) : (
              <a href="/settings" className="block text-xs text-muted-foreground hover:text-primary underline">
                Configure your company in Settings →
              </a>
            )}

            <div className="space-y-2">
              {targets.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{t.company_name}</p>
                    {t.website_url && <p className="text-[10px] text-muted-foreground truncate">{t.website_url}</p>}
                  </div>
                  <button
                    onClick={() => onDeleteTarget(t.id)}
                    className="text-muted-foreground hover:text-danger transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAddTarget(name.trim(), url.trim()); setName(''); setUrl(''); } }}
                placeholder="Competitor name"
                icon={<Tag className="w-3.5 h-3.5" />}
              />
              <Input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Website URL (optional)"
              />
              <Button
                className="w-full"
                onClick={() => { if (name.trim()) { onAddTarget(name.trim(), url.trim()); setName(''); setUrl(''); } }}
                disabled={!name.trim()}
              >
                <Plus className="w-4 h-4" /> Add company
              </Button>
            </div>
          </CardContent>
        </Card>

        {!ownName && targets.length === 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning-foreground flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>
              Set your company name &amp; website in{' '}
              <a href="/settings" className="underline font-medium hover:text-foreground">Settings</a>
              {' '}or add a competitor above to enable fetching.
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={() => onFetchAnalyze(false)}
            disabled={fetching || (!ownName && targets.length === 0)}
            title={!ownName && targets.length === 0 ? 'Add your company in Settings first' : undefined}
          >
            {fetching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Fetching &amp; Analysing…</>
            ) : (
              <><Search className="w-4 h-4" /> Fetch &amp; Analyse</>
            )}
          </Button>
          {analysis && !fetching && (
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => onFetchAnalyze(true)}
              disabled={fetching}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Force refresh
            </Button>
          )}
          {analysis?._fetched_at && (
            <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Last run: {new Date(analysis._fetched_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Right: Analysis results */}
      <div className="lg:col-span-2 space-y-5">
        {fetching ? (
          <AnalysisSkeleton />
        ) : !analysis ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">No intelligence yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click <strong>Fetch &amp; Analyse</strong> to scrape your company&apos;s website, LinkedIn, and any competitor companies you add — then get an AI content intelligence report.
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-left text-xs text-muted-foreground space-y-1 max-w-sm mx-auto">
                <p className="font-medium text-foreground">How it works:</p>
                <p>1. Set your company &amp; website in <a href="/settings" className="underline text-primary">Settings</a></p>
                <p>2. Add competitor companies in the panel on the left</p>
                <p>3. Click Fetch &amp; Analyse — takes ~15 seconds</p>
                <p>4. Browse post ideas, competitor angles, and content gaps</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Timeline summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Content Landscape</p>
                <p className="text-sm text-foreground leading-relaxed">{analysis.timeline_summary}</p>
              </CardContent>
            </Card>

            {/* Insights row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Posting Cadence', value: analysis.own_cadence || '—',                       icon: Clock },
                { label: 'Best Day',        value: analysis.best_day_guess || '—',                    icon: Calendar },
                { label: 'Themes Found',    value: `${(analysis.content_themes || []).length} topics`, icon: Tag },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <Card key={card.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{card.value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Top themes */}
            {(analysis.content_themes || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysis.content_themes.map((t, i) => (
                  <Badge key={i} variant="muted">{t}</Badge>
                ))}
              </div>
            )}

            {/* Content gaps */}
            {(analysis.content_gaps || []).length > 0 && (
              <Card className="border-warning/30 bg-warning-subtle">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-warning-foreground mb-3">Content Gaps — Opportunities for you</p>
                  <ul className="space-y-1.5">
                    {analysis.content_gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <ArrowRight className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />{g}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Competitor angles */}
            {(analysis.competitor_angles || []).length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Competitor angles you haven&apos;t covered</p>
                  <ul className="space-y-1.5">
                    {analysis.competitor_angles.map((a, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>{a}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Hook Swipe File */}
            {(analysis.hook_swipe_file || []).length > 0 && (
              <Card>
                <button
                  onClick={() => setHookOpen(h => !h)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl"
                >
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    Hook Swipe File
                    <Badge variant="muted" size="sm">{analysis.hook_swipe_file.length} hooks</Badge>
                  </span>
                  {hookOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {hookOpen && (
                  <CardContent className="pt-0 pb-5 px-5 grid sm:grid-cols-2 gap-3">
                    {analysis.hook_swipe_file.map((h, i) => (
                      <div key={i} className="border border-border rounded-xl p-3 hover:border-primary/40 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', HOOK_COLORS[h.pattern] ?? 'bg-muted text-muted-foreground')}>{h.pattern}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{h.company}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">&ldquo;{h.hook}&rdquo;</p>
                        <p className="text-xs text-muted-foreground italic">{h.why}</p>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Post ideas */}
            {(analysis.post_ideas || []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Post Ideas — {analysis.post_ideas.length} generated
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {analysis.post_ideas.map((idea, i) => (
                    <Card key={idea.id ?? i} className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', ANGLE_COLORS[idea.angle] ?? 'bg-muted text-muted-foreground')}>{idea.angle}</span>
                              <Badge variant="muted" size="sm">{idea.suggested_format}</Badge>
                            </div>
                            <p className="text-sm font-semibold text-foreground line-clamp-2">{idea.topic}</p>
                          </div>
                          <Button size="sm" onClick={() => onSelectIdea(idea)} className="flex-shrink-0">
                            <PenLine className="w-3.5 h-3.5" /> Draft
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{idea.rationale}</p>
                        {idea.hook && (
                          <p className="text-xs text-primary italic border-l-2 border-primary/30 pl-2 line-clamp-1">&ldquo;{idea.hook}&rdquo;</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Competitor Post Feed */}
            {targetPosts.length > 0 && (
              <Card>
                <button
                  onClick={() => setFeedOpen(f => !f)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl"
                >
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Competitor Post Feed
                    <Badge variant="muted" size="sm">{targetPosts.length} posts</Badge>
                  </span>
                  {feedOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {feedOpen && (
                  <CardContent className="pt-0 pb-5 px-5 space-y-4">
                    {targetPosts.map(post => {
                      const isExpanded = expandedPosts.has(post.id);
                      const text = post.content ?? post.title ?? '';
                      const remix = remixResults[post.id];
                      return (
                        <div key={post.id} className="border border-border rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" size="sm">{post.company_name}</Badge>
                            {post.published_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />{post.published_date}
                              </span>
                            )}
                          </div>
                          {post.title && <p className="text-sm font-medium text-foreground mb-1">{post.title}</p>}
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isExpanded ? text : text.slice(0, 220)}{!isExpanded && text.length > 220 && '…'}
                          </p>
                          {text.length > 220 && (
                            <button
                              onClick={() => setExpandedPosts(s => { const n = new Set(s); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })}
                              className="text-xs text-primary hover:text-primary/80 mt-1 underline"
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemix(post)}
                              disabled={remixing === post.id}
                            >
                              {remixing === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              {remixing === post.id ? 'Remixing…' : 'Remix for my offer'}
                            </Button>
                          </div>
                          {remix && (
                            <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-4 animate-fade-in">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Remixed for your company</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-3">{remix.remixed_content}</p>
                              <p className="text-[11px] text-muted-foreground italic mb-1">Format kept: {remix.format_kept}</p>
                              <p className="text-[11px] text-muted-foreground mb-3">{remix.what_changed}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { navigator.clipboard.writeText(remix.remixed_content); toast('Copied to clipboard'); }}
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Draft Tab ─────────────────────────────────────────────────────────────────

interface DraftTabProps {
  selectedIdea: PostIdea | null;
  onClearIdea: () => void;
  onPublished: (postId: string) => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

function DraftTab({ selectedIdea, onClearIdea, onPublished, toast }: DraftTabProps) {
  const [draftContent, setDraftContent] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftHistory, setDraftHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [postScore, setPostScore] = useState<PostScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [thread, setThread] = useState<ThreadResult | null>(null);
  const [buildingThread, setBuildingThread] = useState(false);
  const [firstComment, setFirstComment] = useState<FirstComment | null>(null);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copiedThread, setCopiedThread] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save draft with debounce (2.5s)
  useEffect(() => {
    if (!selectedIdea || !draftContent) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/v2/linkedin/ideas/${selectedIdea.id}/draft/start`, { method: 'POST' });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('idle'); }
    }, 2500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draftContent, selectedIdea?.id]);

  useEffect(() => {
    setDraftContent('');
    setDraftHistory([]);
    setPostScore(null);
    setThread(null);
    setFirstComment(null);
    setSaveStatus('idle');
  }, [selectedIdea?.id]);

  useEffect(() => { historyRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [draftHistory]);

  async function handleStartDraft() {
    if (!selectedIdea) return;
    setDraftLoading(true);
    try {
      const { content } = await startIdeaDraft(selectedIdea.id);
      setDraftContent(content);
      setPostScore(null);
    } catch { toast('Draft generation failed', 'error'); }
    finally { setDraftLoading(false); }
  }

  async function handleRefine() {
    if (!draftMessage.trim() || !draftContent || !selectedIdea) return;
    const msg = draftMessage.trim();
    setDraftMessage('');
    setRefineLoading(true);
    try {
      const { content, history } = await refineIdeaDraft(selectedIdea.id, {
        message: msg, current_content: draftContent, history: draftHistory,
      });
      setDraftContent(content);
      setDraftHistory(history as { role: 'user' | 'assistant'; content: string }[]);
      setPostScore(null);
    } catch { toast('Refine failed', 'error'); }
    finally { setRefineLoading(false); }
  }

  async function handleScore() {
    if (!draftContent.trim()) return;
    setScoring(true);
    try { setPostScore(await scoreLinkedInPost(draftContent)); }
    catch { toast('Scoring failed', 'error'); }
    finally { setScoring(false); }
  }

  async function handleBuildThread() {
    if (!draftContent.trim()) return;
    setBuildingThread(true);
    try { setThread(await buildLinkedInThread(draftContent)); }
    catch { toast('Thread build failed', 'error'); }
    finally { setBuildingThread(false); }
  }

  async function handleFirstComment() {
    if (!draftContent.trim()) return;
    setGeneratingComment(true);
    try { setFirstComment(await generateFirstComment(draftContent)); }
    catch { toast('First comment failed', 'error'); }
    finally { setGeneratingComment(false); }
  }

  async function handlePublish() {
    if (!selectedIdea || !draftContent.trim()) return;
    setPublishing(true);
    try {
      const { post_id } = await publishIdeaAsPost(selectedIdea.id);
      toast('Post saved to Posts tab');
      onPublished(post_id);
    } catch { toast('Publish failed', 'error'); }
    finally { setPublishing(false); }
  }

  const verdictMeta = postScore ? (
    postScore.verdict === 'strong_post'   ? { label: 'Strong Post',   variant: 'success'  as const } :
    postScore.verdict === 'ready_to_post' ? { label: 'Ready to Post', variant: 'default'  as const } :
    { label: 'Needs Work', variant: 'warning' as const }
  ) : null;

  const scoreBarColor = (n: number) => n >= 7 ? 'bg-success' : n >= 5 ? 'bg-warning' : 'bg-danger';
  const charPct = Math.min(100, Math.round((draftContent.length / 3000) * 100));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Idea panel + refine chat */}
      <div className="space-y-4">
        {selectedIdea ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" /> Starting from idea
                </p>
                <Button variant="ghost" size="sm" onClick={onClearIdea}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', ANGLE_COLORS[selectedIdea.angle] ?? 'bg-muted text-muted-foreground')}>{selectedIdea.angle}</span>
                <Badge variant="muted" size="sm">{selectedIdea.suggested_format}</Badge>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{selectedIdea.topic}</p>
              {selectedIdea.hook && (
                <p className="text-xs text-primary italic border-l-2 border-primary/30 pl-2 mb-2">&ldquo;{selectedIdea.hook}&rdquo;</p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">{selectedIdea.rationale}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Lightbulb className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm mb-1">No idea selected</p>
              <p className="text-xs text-muted-foreground">Pick an idea from the Intelligence tab, or type freely in the draft area.</p>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleStartDraft}
          disabled={draftLoading || !selectedIdea}
        >
          {draftLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating draft…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate initial draft</>
          )}
        </Button>

        {draftContent && (
          <Card>
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" /> Refine with AI
              </p>
              {draftHistory.length > 0 && (
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {draftHistory.map((h, i) => (
                    <div key={i} className={cn(
                      'px-3 py-2 rounded-lg text-xs',
                      h.role === 'user' ? 'bg-muted text-foreground ml-8' : 'bg-primary/5 border border-primary/20 text-foreground mr-8'
                    )}>
                      <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">{h.role === 'user' ? 'You' : 'AI'}</span>
                      <span className="whitespace-pre-wrap">{h.content.length > 120 ? h.content.slice(0, 120) + '…' : h.content}</span>
                    </div>
                  ))}
                  <div ref={historyRef} />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={draftMessage}
                  onChange={e => setDraftMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                  placeholder="Make it shorter, add a stat, punchier hook…"
                  disabled={refineLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleRefine}
                  disabled={!draftMessage.trim() || refineLoading}
                >
                  {refineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Draft preview + tools */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Draft</p>
              <div className="flex items-center gap-2">
                {saveStatus === 'saving' && (
                  <Badge variant="muted" size="sm"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</Badge>
                )}
                {saveStatus === 'saved' && (
                  <Badge variant="success" size="sm"><Check className="w-3 h-3" /> Saved</Badge>
                )}
                {draftContent && (
                  <Badge variant={charCountVariant(draftContent.length)} size="sm">{draftContent.length} chars</Badge>
                )}
              </div>
            </div>
            {draftContent && (
              <div className="mb-3">
                <Progress value={charPct} indicatorClassName={charProgressColor(draftContent.length)} className="h-1" />
              </div>
            )}
            <Textarea
              value={draftContent}
              onChange={e => { setDraftContent(e.target.value); setPostScore(null); }}
              placeholder="Your draft will appear here. Generate from an idea, or type freely…"
              rows={12}
              className="resize-none leading-relaxed"
            />
          </CardContent>
        </Card>

        {draftContent && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleScore} disabled={scoring}>
              {scoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
              Score post
            </Button>
            <Button variant="outline" size="sm" onClick={handleBuildThread} disabled={buildingThread}>
              {buildingThread ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Build thread
            </Button>
            <Button variant="outline" size="sm" onClick={handleFirstComment} disabled={generatingComment}>
              {generatingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              First comment
            </Button>
            <Button
              className="ml-auto"
              variant="success"
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !selectedIdea}
              title={!selectedIdea ? 'Select an idea first' : undefined}
            >
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Save as post
            </Button>
          </div>
        )}

        {/* Post Score */}
        {postScore && verdictMeta && (
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Post Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">{postScore.overall}</span>
                  <Badge variant={verdictMeta.variant}>{verdictMeta.label}</Badge>
                </div>
              </div>
              <div className="space-y-2.5 mb-4">
                {Object.entries(postScore.scores).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-medium text-foreground">{val}/10</span>
                    </div>
                    <Progress value={val * 10} indicatorClassName={scoreBarColor(val)} />
                  </div>
                ))}
              </div>
              {postScore.suggestions.length > 0 && (
                <div className="bg-warning-subtle border border-warning/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-warning-foreground mb-2">Improvements</p>
                  <ul className="space-y-1">
                    {postScore.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-warning mt-0.5 flex-shrink-0">•</span>{s}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 text-warning-foreground hover:text-foreground p-0 h-auto"
                    onClick={() => setDraftMessage(`Improve based on this feedback: ${postScore.suggestions.join('. ')}`)}
                  >
                    Apply suggestions in chat <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Thread Builder */}
        {thread && (
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Thread ({thread.total_parts} parts)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(thread.thread.map(p => p.content).join('\n\n---\n\n'));
                    setCopiedThread(true); setTimeout(() => setCopiedThread(false), 2000);
                  }}
                >
                  {copiedThread ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
                </Button>
              </div>
              <div className="space-y-3">
                {thread.thread.map(part => (
                  <div key={part.part} className="bg-muted rounded-xl p-3 flex items-start gap-3 group">
                    <span className="text-xs font-bold text-muted-foreground flex-shrink-0 pt-0.5 w-8">{part.part}/{thread.total_parts}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{part.content}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant={charCountVariant(part.char_count)} size="sm">{part.char_count} chars</Badge>
                        <button
                          onClick={() => { navigator.clipboard.writeText(part.content); toast('Part copied'); }}
                          className="text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* First Comment */}
        {firstComment && (
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" /> First Comment
                  </p>
                  <p className="text-[10px] text-muted-foreground">Pin this immediately after publishing for reach</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(firstComment.comment); toast('Comment copied'); }}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-2">{firstComment.comment}</p>
              <p className="text-xs text-muted-foreground italic">{firstComment.rationale}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Posts Tab ─────────────────────────────────────────────────────────────────

interface PostsTabProps {
  posts: (LinkedInPost & { planned_date?: string; post_notes?: string })[];
  loading: boolean;
  error: string;
  generating: boolean;
  selectedPersona: string;
  analytics: LinkedInAnalytics | null;
  scheduledPosts: ScheduledPost[];
  ideas: PostIdea[];
  onGenerate: () => void;
  onPersonaChange: (p: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string, date: string) => void;
  onExportBrief: () => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

function PostsTab({ posts, loading, error, generating, selectedPersona, analytics, scheduledPosts, ideas, onGenerate, onPersonaChange, onStatusChange, onDelete, onSchedule, onExportBrief, toast }: PostsTabProps) {
  const [activeRefineId, setActiveRefineId] = useState<string | null>(null);
  const [refineHistories, setRefineHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [editContents, setEditContents] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [showCalendar, setShowCalendar] = useState(false);
  const [jumpToId, setJumpToId] = useState<string | null>(null);
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter + sort
  let filtered = posts.filter(p => {
    if (filterStrategy !== 'all' && p.strategy !== filterStrategy) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQuery && !p.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'longest') return b.char_count - a.char_count;
    return a.char_count - b.char_count;
  });

  // Jump to post (from calendar)
  useEffect(() => {
    if (jumpToId && postRefs.current[jumpToId]) {
      postRefs.current[jumpToId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setJumpToId(null);
    }
  }, [jumpToId]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleBulkCopy() {
    const selected = posts.filter(p => selectedIds.has(p.id));
    const text = selected.map(p => (editContents[p.id] ?? p.content)).join('\n\n─────────────────────\n\n');
    navigator.clipboard.writeText(text);
    toast(`Copied ${selected.length} post${selected.length !== 1 ? 's' : ''}`);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    for (const id of ids) { await onDelete(id); }
    setSelectedIds(new Set());
    toast(`Deleted ${ids.length} post${ids.length !== 1 ? 's' : ''}`);
  }

  function handleAssignIdea(ideaId: string, date: string) {
    toast(`Idea planned for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, 'info');
  }

  const strategies = Array.from(new Set(posts.map(p => p.strategy).filter(Boolean)));
  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  return (
    <div>
      {/* Controls bar */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Writing persona</p>
              <div className="flex items-center gap-2 flex-wrap">
                {PERSONAS.map(p => {
                  const Icon = p.icon;
                  return (
                    <Button
                      key={p.value}
                      variant={selectedPersona === p.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPersonaChange(p.value)}
                      title={p.desc}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" onClick={onExportBrief}>
                <Eye className="w-4 h-4" /> Export brief
              </Button>
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate posts</>
                )}
              </Button>
            </div>
          </div>

          {/* Analytics bar */}
          <AnalyticsBar analytics={analytics} />
        </CardContent>
      </Card>

      {error && (
        <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Calendar toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={showCalendar ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowCalendar(c => !c)}
          >
            <Calendar className="w-3.5 h-3.5" />
            {showCalendar ? 'Hide calendar' : 'Show calendar'}
          </Button>
          <Badge variant="muted" size="sm">{scheduledPosts.length} scheduled</Badge>
        </div>
        {posts.length > 0 && <span className="text-xs text-muted-foreground">{posts.length} total posts</span>}
      </div>

      {/* Calendar */}
      {showCalendar && (
        <div className="mb-6 animate-fade-in">
          <ContentCalendar
            scheduledPosts={scheduledPosts}
            ideas={ideas}
            onAssignIdea={handleAssignIdea}
            onJumpToPost={(id) => { setJumpToId(id); setFilterStrategy('all'); setFilterStatus('all'); setSearchQuery(''); }}
          />
        </div>
      )}

      {/* Filter + search bar */}
      {posts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="flex-1 min-w-[160px]">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search posts…"
              icon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
          <Select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} className="w-auto">
            <option value="all">All types</option>
            {strategies.map(s => <option key={s} value={s}>{STRATEGY_META[s]?.label ?? s}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-auto">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="selected">Selected</option>
            <option value="posted">Posted</option>
          </Select>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="w-auto">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest first</option>
            <option value="shortest">Shortest first</option>
          </Select>
          {(filterStrategy !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterStrategy('all'); setFilterStatus('all'); setSearchQuery(''); }}
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 animate-fade-in">
          <Badge variant="default">{selectedIds.size} selected</Badge>
          <Button size="sm" variant="outline" onClick={handleBulkCopy}>
            <Copy className="w-3.5 h-3.5" /> Copy all
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete all
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            Deselect
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <PostCardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 && posts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Linkedin className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">No posts yet</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Generate your first batch using your market intelligence and selected persona.
            </p>
            <Button onClick={onGenerate} disabled={generating} size="lg">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate posts</>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm mb-2">No posts match your filters.</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => { setFilterStrategy('all'); setFilterStatus('all'); setSearchQuery(''); }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Select all row */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) setSelectedIds(new Set());
                else setSelectedIds(new Set(filtered.map(p => p.id)));
              }}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Select all ({filtered.length})</span>
          </div>
          <div className="space-y-4">
            {filtered.map(post => (
              <div key={post.id} ref={el => { postRefs.current[post.id] = el; }}>
                <PostCard
                  post={post}
                  isRefineOpen={activeRefineId === post.id}
                  refineHistory={refineHistories[post.id] ?? []}
                  editContent={editContents[post.id]}
                  isSelected={selectedIds.has(post.id)}
                  onToggleSelect={() => toggleSelect(post.id)}
                  onToggleRefine={() => setActiveRefineId(prev => prev === post.id ? null : post.id)}
                  onRefineUpdate={(content, history) => {
                    setEditContents(prev => ({ ...prev, [post.id]: content }));
                    setRefineHistories(prev => ({ ...prev, [post.id]: history }));
                  }}
                  onApplyRefine={(id, c) => {
                    setLocalContent(id, c);
                    setEditContents(prev => { const n = { ...prev }; delete n[id]; return n; });
                    setRefineHistories(prev => ({ ...prev, [id]: [] }));
                    setActiveRefineId(null);
                    toast('Changes applied');
                  }}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onSchedule={onSchedule}
                  onCopy={content => { navigator.clipboard.writeText(content); toast('Copied to clipboard'); }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  function setLocalContent(id: string, content: string) {
    setEditContents(prev => ({ ...prev, [id]: content }));
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LinkedInPage() {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'draft' | 'posts'>('intelligence');
  const { toasts, toast } = useToast();

  // Intelligence state
  const [companyProfile, setCompanyProfile] = useState<Partial<CompanyProfile> | null>(null);
  const [targets, setTargets] = useState<LinkedInTarget[]>([]);
  const [analysis, setAnalysis] = useState<LinkedInAnalysis | null>(null);
  const [fetching, setFetching] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null);

  // Posts state
  const [posts, setPosts] = useState<(LinkedInPost & { planned_date?: string; post_notes?: string })[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState('auto');
  const [analytics, setAnalytics] = useState<LinkedInAnalytics | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  useEffect(() => {
    Promise.all([
      listLinkedInTargets().then(setTargets).catch(() => {}),
      getLinkedInAnalysis().then(a => { if (a) setAnalysis(a); }).catch(() => {}),
      getCompanyProfile().then(p => setCompanyProfile(p ?? null)).catch(() => {}),
      listLinkedInPosts().then(setPosts).catch(() => setPostsError('Failed to load posts')).finally(() => setPostsLoading(false)),
      getLinkedInAnalytics().then(setAnalytics).catch(() => {}),
      getScheduledPosts().then(setScheduledPosts).catch(() => {}),
    ]);
  }, []);

  // Intelligence handlers
  async function handleAddTarget(name: string, url: string) {
    try {
      const { id } = await addLinkedInTarget({ company_name: name, website_url: url });
      setTargets(prev => [...prev, { id, company_name: name, website_url: url, created_at: new Date().toISOString() }]);
      toast(`Added ${name}`);
    } catch { toast('Failed to add company', 'error'); }
  }

  async function handleDeleteTarget(id: string) {
    const target = targets.find(t => t.id === id);
    try {
      await deleteLinkedInTarget(id);
      setTargets(prev => prev.filter(t => t.id !== id));
      toast(`Removed ${target?.company_name ?? 'company'}`);
    } catch { toast('Failed to remove', 'error'); }
  }

  async function handleFetchAnalyze(force = false) {
    setFetching(true);
    try {
      const result = await fetchAndAnalyzeLinkedIn(force);
      setAnalysis({ ...result.analysis, fetched_posts: result.fetched_posts });
      if (result.skipped) {
        toast(`Using cached analysis (${result.age_minutes}m old) — click Force refresh to re-fetch`, 'info');
      } else if (result.fetched_count === 0) {
        toast('No posts found — make sure your company Website URL is set in Settings, then try Force refresh', 'error');
      } else {
        toast(`Fetched ${result.fetched_count} posts and generated analysis`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fetch & Analyse failed — check that your backend is running', 'error');
    }
    finally { setFetching(false); }
  }

  function handleSelectIdea(idea: PostIdea) {
    setSelectedIdea(idea);
    setActiveTab('draft');
  }

  // Posts handlers
  async function handleGenerate() {
    setGenerating(true); setPostsError('');
    try {
      const newPosts = await generateLinkedInPosts(selectedPersona);
      setPosts(prev => [...newPosts, ...prev]);
      getLinkedInAnalytics().then(setAnalytics).catch(() => {});
      toast(`Generated ${newPosts.length} new posts`);
    } catch (err) {
      setPostsError(err instanceof Error ? err.message : 'Failed to generate posts');
      toast('Generation failed', 'error');
    } finally { setGenerating(false); }
  }

  async function handleStatusChange(postId: string, status: string) {
    try {
      await updateLinkedInPostStatus(postId, status);
      setPosts(prev => prev.map(p => {
        if (status === 'selected') {
          if (p.id === postId) return { ...p, status: 'selected' as const };
          if (p.status === 'selected') return { ...p, status: 'draft' as const };
          return p;
        }
        return p.id === postId ? { ...p, status: status as LinkedInPost['status'] } : p;
      }));
      getLinkedInAnalytics().then(setAnalytics).catch(() => {});
    } catch { toast('Status update failed', 'error'); }
  }

  async function handleDelete(postId: string) {
    try {
      await deleteLinkedInPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      getLinkedInAnalytics().then(setAnalytics).catch(() => {});
    } catch { toast('Delete failed', 'error'); }
  }

  async function handleSchedule(postId: string, date: string) {
    try {
      await updateLinkedInPost(postId, { planned_date: date });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, planned_date: date } : p));
      getScheduledPosts().then(setScheduledPosts).catch(() => {});
      if (date) toast(`Scheduled for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      else toast('Schedule cleared');
    } catch { toast('Scheduling failed', 'error'); }
  }

  async function handleExportBrief() {
    try {
      const { brief } = await exportContentBrief();
      await navigator.clipboard.writeText(brief);
      toast('Content brief copied to clipboard');
    } catch { toast('Export failed', 'error'); }
  }

  function handlePublished(postId: string) {
    listLinkedInPosts().then(setPosts).catch(() => {});
    getLinkedInAnalytics().then(setAnalytics).catch(() => {});
    setActiveTab('posts');
  }

  const ideas = analysis?.post_ideas ?? [];

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} />

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-8 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                <Linkedin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">LinkedIn Intelligence Hub</h1>
                <p className="text-xs text-muted-foreground">Track competitors · draft with AI · build your pipeline</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="intelligence">
                  <BarChart2 className="w-4 h-4" /> Intelligence
                </TabsTrigger>
                <TabsTrigger value="draft">
                  <PenLine className="w-4 h-4" /> Draft
                </TabsTrigger>
                <TabsTrigger value="posts">
                  <Sparkles className="w-4 h-4" />
                  Posts{posts.length > 0 ? ` (${posts.length})` : ''}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 animate-fade-in">
        {activeTab === 'intelligence' && (
          <IntelligenceTab
            companyProfile={companyProfile}
            targets={targets}
            analysis={analysis}
            fetching={fetching}
            onAddTarget={handleAddTarget}
            onDeleteTarget={handleDeleteTarget}
            onFetchAnalyze={handleFetchAnalyze}
            onSelectIdea={handleSelectIdea}
            toast={toast}
          />
        )}

        {activeTab === 'draft' && (
          <DraftTab
            selectedIdea={selectedIdea}
            onClearIdea={() => setSelectedIdea(null)}
            onPublished={handlePublished}
            toast={toast}
          />
        )}

        {activeTab === 'posts' && (
          <PostsTab
            posts={posts}
            loading={postsLoading}
            error={postsError}
            generating={generating}
            selectedPersona={selectedPersona}
            analytics={analytics}
            scheduledPosts={scheduledPosts}
            ideas={ideas}
            onGenerate={handleGenerate}
            onPersonaChange={setSelectedPersona}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onSchedule={handleSchedule}
            onExportBrief={handleExportBrief}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}
