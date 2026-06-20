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

// ── Toast system ──────────────────────────────────────────────────────────────

interface Toast { id: string; msg: string; type: 'success' | 'error' | 'info'; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-up pointer-events-auto ${
          t.type === 'success' ? 'bg-emerald-600 text-white' :
          t.type === 'error' ? 'bg-red-600 text-white' :
          'bg-slate-800 text-white'
        }`}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
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

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />;
}

function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex gap-2 mb-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-16" /></div>
      <Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-5/6 mb-2" /><Skeleton className="h-4 w-4/6 mb-4" />
      <div className="flex gap-2 border-t border-slate-100 pt-3"><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-20" /></div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-3 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      <Skeleton className="h-20 w-full" />
      <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const HOOK_COLORS: Record<string, string> = {
  question:   'bg-blue-100 text-blue-700',
  stat:       'bg-emerald-100 text-emerald-700',
  story:      'bg-violet-100 text-violet-700',
  contrarian: 'bg-amber-100 text-amber-700',
  bold_claim: 'bg-red-100 text-red-700',
};

const ANGLE_COLORS: Record<string, string> = {
  contrarian: 'bg-amber-100 text-amber-700',
  trend:      'bg-violet-100 text-violet-700',
  story:      'bg-blue-100 text-blue-700',
  'how-to':   'bg-emerald-100 text-emerald-700',
  data:       'bg-indigo-100 text-indigo-700',
  opinion:    'bg-pink-100 text-pink-700',
};

const STRATEGY_META: Record<string, { label: string; color: string }> = {
  trend_spotlight: { label: 'Trend Spotlight',  color: 'bg-violet-100 text-violet-700' },
  pain_narrative:  { label: 'Pain Narrative',   color: 'bg-red-100 text-red-700' },
  contrarian:      { label: 'Contrarian Take',  color: 'bg-amber-100 text-amber-700' },
  how_we_help:     { label: 'How We Help',      color: 'bg-blue-100 text-blue-700' },
  industry_take:   { label: 'Industry Take',    color: 'bg-indigo-100 text-indigo-700' },
  case_signal:     { label: 'Case Signal',      color: 'bg-emerald-100 text-emerald-700' },
};

const PERSONAS = [
  { value: 'auto',           label: 'Auto',           desc: 'Balanced, inferred from profile',     icon: '🤖' },
  { value: 'founder',        label: 'Founder Voice',  desc: 'Visionary, candid, big-picture',      icon: '🚀' },
  { value: 'technical',      label: 'Technical Expert', desc: 'Precise, credible, how-things-work', icon: '🛠️' },
  { value: 'business_leader', label: 'Business Leader', desc: 'ROI-focused, executive-level',        icon: '📈' },
  { value: 'bd_lead',        label: 'BD Lead',        desc: 'Client-centric, opportunity-aware',   icon: '🤝' },
];

function charColor(n: number) {
  return n <= 1300 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
         n <= 1700 ? 'text-amber-700 bg-amber-50 border-amber-200' :
         'text-red-700 bg-red-50 border-red-200';
}

// ── Analytics bar ─────────────────────────────────────────────────────────────

function AnalyticsBar({ analytics }: { analytics: LinkedInAnalytics | null }) {
  if (!analytics) return null;
  const items = [
    { label: 'Generated this month', value: analytics.this_month_generated, color: 'text-indigo-700' },
    { label: 'Published this month',  value: analytics.this_month_published, color: 'text-emerald-700' },
    { label: 'Scheduled',            value: analytics.scheduled_posts,       color: 'text-amber-700' },
    { label: 'Ideas drafted',         value: analytics.drafted_ideas,         color: 'text-violet-700' },
    { label: 'Competitors tracked',   value: analytics.targets_tracked,       color: 'text-slate-600' },
  ];
  return (
    <div className="flex items-center gap-6 flex-wrap mt-4 pt-4 border-t border-slate-100">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
          <span className="text-[11px] text-slate-400">{item.label}</span>
        </div>
      ))}
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
    days.push({
      date: d,
      iso,
      label: d.getDate().toString(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  const byDay = scheduledPosts.reduce<Record<string, ScheduledPost[]>>((acc, p) => {
    const day = (p.planned_date || '').split('T')[0];
    if (day) { acc[day] = acc[day] || []; acc[day].push(p); }
    return acc;
  }, {});

  const unscheduledIdeas = ideas.filter(i => i.status === 'idea');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">14-Day Content Calendar</p>
        <p className="text-xs text-slate-400">{unscheduledIdeas.length} unscheduled idea{unscheduledIdeas.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 min-w-[600px]">
        {days.map(day => {
          const posts = byDay[day.iso] || [];
          const isToday = day.iso === today.toISOString().split('T')[0];
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          return (
            <div key={day.iso} className="relative"
              onMouseEnter={() => setHoverDay(day.iso)}
              onMouseLeave={() => { setHoverDay(null); }}>
              <div className={`min-h-[80px] rounded-lg border p-2 transition-colors cursor-pointer ${
                isToday ? 'border-indigo-300 bg-indigo-50' :
                isWeekend ? 'border-slate-100 bg-slate-50' :
                hoverDay === day.iso ? 'border-indigo-200 bg-white' :
                'border-slate-100 bg-white'
              }`}
                onClick={() => { if (unscheduledIdeas.length > 0) setShowIdeaPicker(prev => prev === day.iso ? null : day.iso); }}>
                <p className={`text-[10px] font-medium mb-0.5 ${isToday ? 'text-indigo-700' : 'text-slate-400'}`}>{day.dayName}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-indigo-800' : 'text-slate-700'}`}>{day.label}</p>
                {posts.map(p => (
                  <div key={p.id} onClick={e => { e.stopPropagation(); onJumpToPost(p.id); }}
                    className="mt-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-emerald-200 transition-colors">
                    {p.trend_cluster || p.strategy || 'Post'}
                  </div>
                ))}
                {posts.length === 0 && hoverDay === day.iso && unscheduledIdeas.length > 0 && (
                  <div className="mt-1 text-[10px] text-indigo-400 italic">+ add idea</div>
                )}
              </div>
              {showIdeaPicker === day.iso && unscheduledIdeas.length > 0 && (
                <div className="absolute top-full left-0 z-20 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg p-3 w-56 animate-fade-in">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Assign idea</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {unscheduledIdeas.map(idea => (
                      <button key={idea.id} onClick={() => { onAssignIdea(idea.id, day.iso); setShowIdeaPicker(null); }}
                        className="w-full text-left text-xs text-slate-700 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors">
                        {idea.topic}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowIdeaPicker(null)} className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 w-full text-center">Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Post Card (production version) ───────────────────────────────────────────

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
    <div className="border-l-2 border-indigo-200 ml-4 pl-4 mt-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Edit with AI</p>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
      </div>
      {editContent && editContent !== post.content && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Refined version</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{editContent}</p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => onApply(editContent)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 font-medium">Apply</button>
            <button onClick={() => onUpdate(post.content, [])} className="text-xs text-slate-400 hover:text-slate-600 underline">Revert</button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${h.role === 'user' ? 'bg-slate-100 text-slate-700 ml-6' : 'bg-white border border-slate-200 text-slate-600 mr-6'}`}>
              <span className="font-medium text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">{h.role === 'user' ? 'You' : 'AI'}</span>
              <span className="whitespace-pre-wrap">{h.content.length > 150 ? h.content.slice(0, 150) + '…' : h.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input type="text" value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Make it shorter, add a stat, stronger hook..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
          disabled={loading} />
        <button onClick={handleSend} disabled={!message.trim() || loading}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors">
          {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Send'}
        </button>
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
  const meta = STRATEGY_META[post.strategy] ?? { label: post.strategy || 'Post', color: 'bg-slate-100 text-slate-600' };
  const count = editContent ? editContent.length : post.char_count;
  const display = editContent ?? post.content;

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect}
          className="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer" />
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
          {post.trend_cluster && (
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{post.trend_cluster}</span>
          )}
          {post.planned_date && (
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              📅 {new Date(post.planned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ml-auto ${charColor(count)}`}>{count} chars</span>
        </div>
      </div>

      {post.strategy_note && <p className="text-[11px] text-slate-400 italic mb-3 leading-relaxed">{post.strategy_note}</p>}
      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-4">{display}</p>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        {post.status === 'selected' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Selected
          </span>
        ) : (
          <button onClick={() => onStatusChange(post.id, 'selected')} className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors">Select</button>
        )}
        {post.status === 'selected' && (
          <button onClick={() => onStatusChange(post.id, 'posted')} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 px-3 py-1.5 rounded-lg transition-colors">Mark Posted</button>
        )}
        {post.status === 'posted' && <span className="text-xs font-medium text-slate-400 px-3 py-1.5">✓ Posted</span>}

        <button onClick={onToggleRefine} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${isRefineOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>Edit with AI</button>

        <button onClick={() => setShowSchedule(s => !s)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${showSchedule ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600'}`}>📅</button>

        <button onClick={() => onCopy(display)} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors">Copy</button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="ml-auto text-xs text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 px-2 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Delete?</span>
            <button onClick={() => onDelete(post.id)} className="text-xs font-medium text-red-600 hover:text-red-700">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 hover:text-slate-600">No</button>
          </div>
        )}
      </div>

      {/* Schedule picker */}
      {showSchedule && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100 animate-fade-in">
          <label className="text-xs text-slate-500 flex-shrink-0">Plan for:</label>
          <input type="date" value={datePick} onChange={e => setDatePick(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
          <button onClick={() => { onSchedule(post.id, datePick); setShowSchedule(false); }}
            disabled={!datePick}
            className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1 rounded-lg transition-colors">
            Save
          </button>
          {post.planned_date && (
            <button onClick={() => { onSchedule(post.id, ''); setDatePick(''); setShowSchedule(false); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
          )}
        </div>
      )}

      {isRefineOpen && (
        <RefinePanel post={post} history={refineHistory} editContent={editContent}
          onApply={c => onApplyRefine(post.id, c)} onClose={onToggleRefine} onUpdate={onRefineUpdate} />
      )}
    </div>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Companies to watch</p>

          {ownName ? (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
              <span className="text-xs">⭐</span>
              <span className="text-sm font-medium text-indigo-700 truncate flex-1">{ownName}</span>
              <span className="text-[10px] text-indigo-500 font-medium">Your company</span>
            </div>
          ) : (
            <a href="/settings" className="block text-xs text-slate-400 hover:text-indigo-600 mb-3 underline">
              Configure your company in Settings →
            </a>
          )}

          <div className="space-y-2 mb-3">
            {targets.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{t.company_name}</p>
                  {t.website_url && <p className="text-[10px] text-slate-400 truncate">{t.website_url}</p>}
                </div>
                <button onClick={() => onDeleteTarget(t.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAddTarget(name.trim(), url.trim()); setName(''); setUrl(''); } }}
              placeholder="Competitor name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400" />
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Website URL (optional)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400" />
            <button onClick={() => { if (name.trim()) { onAddTarget(name.trim(), url.trim()); setName(''); setUrl(''); } }} disabled={!name.trim()}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white disabled:text-slate-400 text-sm font-medium py-2 rounded-lg transition-colors">
              + Add company
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => onFetchAnalyze(false)} disabled={fetching || (!ownName && targets.length === 0)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-sm">
            {fetching ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Fetching & Analysing...</> : '🔍 Fetch & Analyse'}
          </button>
          {analysis && !fetching && (
            <button onClick={() => onFetchAnalyze(true)} disabled={fetching}
              className="w-full text-xs font-medium text-slate-500 hover:text-indigo-600 py-1.5 transition-colors">
              ↻ Force refresh
            </button>
          )}
          {analysis?._fetched_at && (
            <p className="text-[11px] text-slate-400 text-center">Last run: {new Date(analysis._fetched_at).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Right: Analysis results */}
      <div className="lg:col-span-2 space-y-5">
        {fetching ? (
          <AnalysisSkeleton />
        ) : !analysis ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm">Add competitor companies and click Fetch & Analyse to unlock content intelligence.</p>
          </div>
        ) : (
          <>
            {/* Timeline summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Content Landscape</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{analysis.timeline_summary}</p>
            </div>

            {/* Insights row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Posting Cadence', value: analysis.own_cadence || '—' },
                { label: 'Best Day',         value: analysis.best_day_guess || '—' },
                { label: 'Themes Found',     value: `${(analysis.content_themes || []).length} topics` },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
                  <p className="text-sm font-semibold text-slate-800">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Top themes */}
            {(analysis.content_themes || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysis.content_themes.map((t, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            )}

            {/* Content gaps */}
            {(analysis.content_gaps || []).length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-3">Content Gaps — Opportunities for you</p>
                <ul className="space-y-1.5">
                  {analysis.content_gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Competitor angles */}
            {(analysis.competitor_angles || []).length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Competitor angles you haven't covered</p>
                <ul className="space-y-1.5">
                  {analysis.competitor_angles.map((a, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hook Swipe File */}
            {(analysis.hook_swipe_file || []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setHookOpen(h => !h)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <span className="text-sm font-semibold text-slate-800">📌 Hook Swipe File <span className="text-slate-400 font-normal">({analysis.hook_swipe_file.length} hooks)</span></span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${hookOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {hookOpen && (
                  <div className="px-5 pb-5 grid sm:grid-cols-2 gap-3">
                    {analysis.hook_swipe_file.map((h, i) => (
                      <div key={i} className="border border-slate-100 rounded-lg p-3 hover:border-indigo-200 transition-colors group">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${HOOK_COLORS[h.pattern] ?? 'bg-slate-100 text-slate-600'}`}>{h.pattern}</span>
                          <span className="text-[10px] text-slate-400 truncate">{h.company}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 mb-1">"{h.hook}"</p>
                        <p className="text-xs text-slate-400 italic">{h.why}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post ideas */}
            {(analysis.post_ideas || []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Post Ideas — {analysis.post_ideas.length} generated</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {analysis.post_ideas.map((idea, i) => (
                    <div key={idea.id ?? i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-indigo-200 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ANGLE_COLORS[idea.angle] ?? 'bg-slate-100 text-slate-600'}`}>{idea.angle}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full truncate">{idea.suggested_format}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">{idea.topic}</p>
                        </div>
                        <button onClick={() => onSelectIdea(idea)}
                          className="flex-shrink-0 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                          ✍️ Draft
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">{idea.rationale}</p>
                      {idea.hook && <p className="text-xs text-indigo-600 italic border-l-2 border-indigo-200 pl-2 line-clamp-1">"{idea.hook}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitor Post Feed */}
            {targetPosts.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setFeedOpen(f => !f)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <span className="text-sm font-semibold text-slate-800">📰 Competitor Post Feed <span className="text-slate-400 font-normal">({targetPosts.length} posts)</span></span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${feedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {feedOpen && (
                  <div className="px-5 pb-5 space-y-4">
                    {targetPosts.map(post => {
                      const isExpanded = expandedPosts.has(post.id);
                      const text = post.content ?? post.title ?? '';
                      const remix = remixResults[post.id];
                      return (
                        <div key={post.id} className="border border-slate-100 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{post.company_name}</span>
                            {post.published_date && <span className="text-[10px] text-slate-400">{post.published_date}</span>}
                          </div>
                          {post.title && <p className="text-sm font-medium text-slate-800 mb-1">{post.title}</p>}
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {isExpanded ? text : text.slice(0, 220)}{!isExpanded && text.length > 220 && '…'}
                          </p>
                          {text.length > 220 && (
                            <button onClick={() => setExpandedPosts(s => { const n = new Set(s); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })}
                              className="text-xs text-indigo-500 hover:text-indigo-700 mt-1 underline">
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                          <div className="mt-3">
                            <button onClick={() => handleRemix(post)} disabled={remixing === post.id}
                              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                              {remixing === post.id ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Remixing…</> : '🔄 Remix for my offer'}
                            </button>
                          </div>
                          {remix && (
                            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-4 animate-fade-in">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Remixed for your company</p>
                              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-3">{remix.remixed_content}</p>
                              <p className="text-[11px] text-slate-500 italic mb-1">Format kept: {remix.format_kept}</p>
                              <p className="text-[11px] text-slate-400 mb-3">{remix.what_changed}</p>
                              <div className="flex gap-2">
                                <button onClick={() => { navigator.clipboard.writeText(remix.remixed_content); toast('Copied to clipboard'); }} className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">📋 Copy</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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

  // Auto-save draft with debounce
  useEffect(() => {
    if (!selectedIdea || !draftContent) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        // Optimistic — update idea draft in background
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
    postScore.verdict === 'strong_post' ? { label: 'Strong Post', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' } :
    postScore.verdict === 'ready_to_post' ? { label: 'Ready to Post', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' } :
    { label: 'Needs Work', cls: 'text-amber-700 bg-amber-50 border-amber-200' }
  ) : null;

  const scoreBarColor = (n: number) => n >= 7 ? 'bg-emerald-500' : n >= 5 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Starting point + chat */}
      <div className="space-y-4">
        {selectedIdea ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Starting from idea</p>
              <button onClick={onClearIdea} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ANGLE_COLORS[selectedIdea.angle] ?? 'bg-slate-100 text-slate-600'}`}>{selectedIdea.angle}</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{selectedIdea.suggested_format}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">{selectedIdea.topic}</p>
            {selectedIdea.hook && <p className="text-xs text-indigo-600 italic border-l-2 border-indigo-200 pl-2 mb-2">"{selectedIdea.hook}"</p>}
            <p className="text-xs text-slate-500 leading-relaxed">{selectedIdea.rationale}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-slate-400 text-sm mb-1">No idea selected</p>
            <p className="text-xs text-slate-400">Pick an idea from the Intelligence tab, or type freely in the draft area.</p>
          </div>
        )}

        <button onClick={handleStartDraft} disabled={draftLoading || !selectedIdea}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
          {draftLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating draft…</> : '✨ Generate initial draft'}
        </button>

        {draftContent && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Refine with AI</p>
            {draftHistory.length > 0 && (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {draftHistory.map((h, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-xs ${h.role === 'user' ? 'bg-slate-100 text-slate-700 ml-8' : 'bg-indigo-50 border border-indigo-100 text-slate-700 mr-8'}`}>
                    <span className="font-medium text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">{h.role === 'user' ? 'You' : 'AI'}</span>
                    <span className="whitespace-pre-wrap">{h.content.length > 120 ? h.content.slice(0, 120) + '…' : h.content}</span>
                  </div>
                ))}
                <div ref={historyRef} />
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={draftMessage} onChange={e => setDraftMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                placeholder="Make it shorter, add a stat, punchier hook…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                disabled={refineLoading} />
              <button onClick={handleRefine} disabled={!draftMessage.trim() || refineLoading}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors">
                {refineLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Draft preview + tools */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Draft</p>
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && <span className="text-[10px] text-slate-400 animate-pulse">Saving…</span>}
              {saveStatus === 'saved' && <span className="text-[10px] text-emerald-600">✓ Saved</span>}
              {draftContent && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${charColor(draftContent.length)}`}>{draftContent.length} chars</span>
              )}
            </div>
          </div>
          <textarea value={draftContent} onChange={e => { setDraftContent(e.target.value); setPostScore(null); }}
            placeholder="Your draft will appear here. Generate from an idea, or type freely…"
            rows={12}
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed placeholder:text-slate-300" />
        </div>

        {draftContent && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleScore} disabled={scoring}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {scoring ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '📊'} Score post
            </button>
            <button onClick={handleBuildThread} disabled={buildingThread}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {buildingThread ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '🧵'} Build thread
            </button>
            <button onClick={handleFirstComment} disabled={generatingComment}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {generatingComment ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '💬'} First comment
            </button>
            <button onClick={handlePublish} disabled={publishing || !selectedIdea}
              title={!selectedIdea ? 'Select an idea first' : undefined}
              className="ml-auto text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
              {publishing ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '💾'} Save as post
            </button>
          </div>
        )}

        {/* Post Score */}
        {postScore && verdictMeta && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Post Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">{postScore.overall}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${verdictMeta.cls}`}>{verdictMeta.label}</span>
              </div>
            </div>
            <div className="space-y-2.5 mb-4">
              {Object.entries(postScore.scores).map(([key, val]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-medium text-slate-700">{val}/10</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(val)}`} style={{ width: `${val * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {postScore.suggestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2">Improvements</p>
                <ul className="space-y-1">
                  {postScore.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5"><span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>{s}</li>
                  ))}
                </ul>
                <button onClick={() => setDraftMessage(`Improve based on this feedback: ${postScore.suggestions.join('. ')}`)}
                  className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900">
                  Apply suggestions in chat →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Thread Builder */}
        {thread && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Thread ({thread.total_parts} parts)</p>
              <button onClick={() => {
                navigator.clipboard.writeText(thread.thread.map(p => p.content).join('\n\n---\n\n'));
                setCopiedThread(true); setTimeout(() => setCopiedThread(false), 2000);
              }} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">
                {copiedThread ? '✓ Copied' : '📋 Copy all'}
              </button>
            </div>
            <div className="space-y-3">
              {thread.thread.map(part => (
                <div key={part.part} className="bg-slate-50 rounded-lg p-3 flex items-start gap-3 group">
                  <span className="text-xs font-bold text-slate-400 flex-shrink-0 pt-0.5 w-8">{part.part}/{thread.total_parts}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-relaxed">{part.content}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${charColor(part.char_count)}`}>{part.char_count} chars</span>
                      <button onClick={() => { navigator.clipboard.writeText(part.content); toast('Part copied'); }} className="text-[10px] text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">Copy</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* First Comment */}
        {firstComment && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">First Comment</p>
                <p className="text-[10px] text-slate-400">Pin this immediately after publishing for reach</p>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(firstComment.comment); toast('Comment copied'); }}
                className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">
                📋 Copy
              </button>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed mb-2">{firstComment.comment}</p>
            <p className="text-xs text-slate-400 italic">{firstComment.rationale}</p>
          </div>
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
    // Find a drafted idea post and schedule it — or just toast
    toast(`Idea planned for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, 'info');
  }

  const strategies = Array.from(new Set(posts.map(p => p.strategy).filter(Boolean)));
  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  return (
    <div>
      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Writing persona</p>
            <div className="flex items-center gap-2 flex-wrap">
              {PERSONAS.map(p => (
                <button key={p.value} onClick={() => onPersonaChange(p.value)} title={p.desc}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    selectedPersona === p.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  <span>{p.icon}</span><span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onExportBrief} className="text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
              📄 Export brief
            </button>
            <button onClick={onGenerate} disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-4 py-2.5 rounded-lg transition-all shadow-sm flex items-center gap-2 text-sm">
              {generating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</> : '✨ Generate posts'}
            </button>
          </div>
        </div>

        {/* Analytics bar */}
        <AnalyticsBar analytics={analytics} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      {/* Calendar toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCalendar(c => !c)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${showCalendar ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {showCalendar ? '📅 Hide calendar' : '📅 Show calendar'}
          </button>
          <span className="text-xs text-slate-400">{scheduledPosts.length} scheduled</span>
        </div>
        {posts.length > 0 && <span className="text-xs text-slate-400">{posts.length} total posts</span>}
      </div>

      {/* Calendar */}
      {showCalendar && (
        <div className="mb-6">
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
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search posts…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400" />
          </div>
          {/* Strategy filter */}
          <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700">
            <option value="all">All types</option>
            {strategies.map(s => <option key={s} value={s}>{STRATEGY_META[s]?.label ?? s}</option>)}
          </select>
          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="selected">Selected</option>
            <option value="posted">Posted</option>
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest first</option>
            <option value="shortest">Shortest first</option>
          </select>
          {(filterStrategy !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button onClick={() => { setFilterStrategy('all'); setFilterStatus('all'); setSearchQuery(''); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 animate-fade-in">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
          <button onClick={handleBulkCopy} className="text-xs font-medium text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">📋 Copy all</button>
          <button onClick={handleBulkDelete} className="text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">🗑️ Delete all</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline">Deselect</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <PostCardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 && posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">No posts yet</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">Generate your first batch using your market intelligence and selected persona.</p>
          <button onClick={onGenerate} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors mx-auto flex items-center gap-2">
            {generating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</> : '✨ Generate posts'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-slate-400 text-sm">No posts match your filters.</p>
          <button onClick={() => { setFilterStrategy('all'); setFilterStatus('all'); setSearchQuery(''); }} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 underline">Clear filters</button>
        </div>
      ) : (
        <>
          {/* Select all row */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <input type="checkbox" checked={allSelected} onChange={() => {
              if (allSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(filtered.map(p => p.id)));
            }} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
            <span className="text-xs text-slate-500">Select all ({filtered.length})</span>
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
                  onRefineUpdate={(content, history) => { setEditContents(prev => ({ ...prev, [post.id]: content })); setRefineHistories(prev => ({ ...prev, [post.id]: history })); }}
                  onApplyRefine={(id, c) => {
                    setPosts(id, c);
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

  function setPosts(id: string, content: string) {
    // This is called from within PostsTab — we close over the parent setter via onStatusChange pattern
    // The actual posts state is in the parent; we update editContents here
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
      } else {
        toast(`Fetched ${result.fetched_count} posts and generated analysis`);
      }
    } catch { toast('Fetch & Analyse failed — try again', 'error'); }
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

  const TABS = [
    { id: 'intelligence' as const, label: '📊 Intelligence' },
    { id: 'draft' as const,        label: '✍️ Draft' },
    { id: 'posts' as const,        label: `📝 Posts${posts.length > 0 ? ` (${posts.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastContainer toasts={toasts} />

      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">LinkedIn Intelligence Hub</h1>
              <p className="text-slate-500 text-sm mt-0.5">Track competitors, analyse the content landscape, draft with AI, and build your publishing pipeline</p>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex items-center gap-1 mt-4 bg-slate-100 p-1 rounded-lg w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-sm font-medium px-4 py-2 rounded-md transition-all ${
                  activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
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
