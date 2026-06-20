'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LinkedInPost, RefineRequest,
  generateLinkedInPosts, listLinkedInPosts, updateLinkedInPostStatus,
  deleteLinkedInPost, refineLinkedInPost,
  LinkedInTarget, FetchedPost, PostIdea, HookEntry,
  LinkedInAnalysis, PostScore, ThreadResult, FirstComment, RemixResult,
  addLinkedInTarget, listLinkedInTargets, deleteLinkedInTarget,
  fetchAndAnalyzeLinkedIn, getLinkedInAnalysis,
  startIdeaDraft, refineIdeaDraft, publishIdeaAsPost,
  scoreLinkedInPost, buildLinkedInThread, generateFirstComment, remixCompetitorPost,
  getCompanyProfile, CompanyProfile,
} from '@/lib/api';

// ── Shared helpers ────────────────────────────────────────────────────────────

const HOOK_COLORS: Record<string, string> = {
  question:    'bg-blue-100 text-blue-700',
  stat:        'bg-emerald-100 text-emerald-700',
  story:       'bg-violet-100 text-violet-700',
  contrarian:  'bg-amber-100 text-amber-700',
  bold_claim:  'bg-red-100 text-red-700',
};

const ANGLE_COLORS: Record<string, string> = {
  contrarian:  'bg-amber-100 text-amber-700',
  trend:       'bg-violet-100 text-violet-700',
  story:       'bg-blue-100 text-blue-700',
  'how-to':    'bg-emerald-100 text-emerald-700',
  data:        'bg-indigo-100 text-indigo-700',
  opinion:     'bg-pink-100 text-pink-700',
};

function charColor(n: number) {
  return n <= 1300 ? 'bg-emerald-100 text-emerald-700' : n <= 1700 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
}

// ── Existing Posts tab components (unchanged) ─────────────────────────────────

const STRATEGY_META: Record<string, { label: string; color: string }> = {
  trend_spotlight: { label: 'Trend Spotlight',  color: 'bg-violet-100 text-violet-700' },
  pain_narrative:  { label: 'Pain Narrative',   color: 'bg-red-100 text-red-700' },
  contrarian:      { label: 'Contrarian Take',  color: 'bg-amber-100 text-amber-700' },
  how_we_help:     { label: 'How We Help',      color: 'bg-blue-100 text-blue-700' },
  industry_take:   { label: 'Industry Take',    color: 'bg-indigo-100 text-indigo-700' },
  case_signal:     { label: 'Case Signal',      color: 'bg-emerald-100 text-emerald-700' },
};

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
      const req: RefineRequest = { message: msg, current_content: currentContent, history };
      const res = await refineLinkedInPost(post.id, req);
      onUpdate(res.content, res.history as HistoryEntry[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Refine failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="border-l-2 border-indigo-200 ml-4 pl-4 mt-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Edit with AI</p>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Close</button>
      </div>
      {editContent && editContent !== post.content && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Refined version</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{editContent}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => onApply(editContent)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors font-medium">Apply changes</button>
            <button onClick={() => onUpdate(post.content, [])} className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">Revert</button>
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
          placeholder="e.g. Make it shorter, add a contrarian angle..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
          disabled={loading} />
        <button onClick={handleSend} disabled={!message.trim() || loading}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1">
          {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Send'}
        </button>
      </div>
    </div>
  );
}

interface PostCardProps {
  post: LinkedInPost; isRefineOpen: boolean; refineHistory: HistoryEntry[];
  editContent: string | undefined; onToggleRefine: () => void;
  onRefineUpdate: (content: string, history: HistoryEntry[]) => void;
  onApplyRefine: (postId: string, newContent: string) => void;
  onStatusChange: (postId: string, status: string) => void;
  onDelete: (postId: string) => void;
}

function PostCard({ post, isRefineOpen, refineHistory, editContent, onToggleRefine, onRefineUpdate, onApplyRefine, onStatusChange, onDelete }: PostCardProps) {
  const [copied, setCopied] = useState(false);
  const meta = STRATEGY_META[post.strategy] ?? { label: post.strategy, color: 'bg-slate-100 text-slate-600' };
  const count = editContent ? editContent.length : post.char_count;
  const display = editContent ?? post.content;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-slide-up">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
        {post.trend_cluster && <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{post.trend_cluster}</span>}
        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ml-auto ${charColor(count)}`}>{count} chars</span>
      </div>
      {post.strategy_note && <p className="text-[11px] text-slate-400 italic mb-3 leading-relaxed">{post.strategy_note}</p>}
      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-4">{display}</p>
      <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        {post.status === 'selected' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Selected
          </span>
        ) : (
          <button onClick={() => onStatusChange(post.id, 'selected')} className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors">Select</button>
        )}
        {post.status === 'selected' && <button onClick={() => onStatusChange(post.id, 'posted')} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 px-3 py-1.5 rounded-lg transition-colors">Mark as Posted</button>}
        {post.status === 'posted' && <span className="text-xs font-medium text-slate-400 px-3 py-1.5">Posted</span>}
        <button onClick={onToggleRefine} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${isRefineOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>Edit with AI</button>
        <button onClick={() => { navigator.clipboard.writeText(display); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors">{copied ? '✓ Copied' : 'Copy'}</button>
        <button onClick={() => onDelete(post.id)} className="ml-auto text-xs font-medium text-slate-400 hover:text-red-600 border border-transparent hover:border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors" title="Discard">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
      {isRefineOpen && <RefinePanel post={post} history={refineHistory} editContent={editContent} onApply={(c) => onApplyRefine(post.id, c)} onClose={onToggleRefine} onUpdate={onRefineUpdate} />}
    </div>
  );
}

const PERSONAS = [
  { value: 'auto', label: 'Auto', desc: 'Balanced, inferred from profile', icon: '🤖' },
  { value: 'founder', label: 'Founder Voice', desc: 'Visionary, candid, big-picture', icon: '🚀' },
  { value: 'technical', label: 'Technical Expert', desc: 'Precise, credible, how-things-work', icon: '🛠️' },
  { value: 'business_leader', label: 'Business Leader', desc: 'ROI-focused, executive-level', icon: '📈' },
  { value: 'bd_lead', label: 'BD Lead', desc: 'Client-centric, opportunity-aware', icon: '🤝' },
];

// ── Intelligence Tab ──────────────────────────────────────────────────────────

interface IntelligenceTabProps {
  companyProfile: Partial<CompanyProfile> | null;
  targets: LinkedInTarget[];
  analysis: LinkedInAnalysis | null;
  onAddTarget: (name: string, url: string) => void;
  onDeleteTarget: (id: string) => void;
  onFetchAnalyze: () => void;
  fetching: boolean;
  onSelectIdea: (idea: PostIdea) => void;
}

function IntelligenceTab({ companyProfile, targets, analysis, onAddTarget, onDeleteTarget, onFetchAnalyze, fetching, onSelectIdea }: IntelligenceTabProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [hookOpen, setHookOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [remixResults, setRemixResults] = useState<Record<string, RemixResult>>({});
  const [remixing, setRemixing] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  const ownName = companyProfile?.company_name;
  const fetchedPosts = analysis?.fetched_posts ?? [];

  async function handleRemix(post: FetchedPost) {
    setRemixing(post.id);
    try {
      const result = await remixCompetitorPost(post.content ?? post.title ?? '', post.company_name);
      setRemixResults(prev => ({ ...prev, [post.id]: result }));
    } catch {
      alert('Remix failed — try again');
    } finally {
      setRemixing(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left: companies panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Companies to watch</p>
          {/* Own company */}
          {ownName ? (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
              <span className="text-xs">⭐</span>
              <span className="text-sm font-medium text-indigo-700 truncate">{ownName}</span>
              <span className="ml-auto text-[10px] text-indigo-500 font-medium">Your company</span>
            </div>
          ) : (
            <a href="/settings" className="block text-xs text-slate-400 hover:text-indigo-600 mb-3 underline">
              Configure your company in Settings →
            </a>
          )}
          {/* Targets */}
          <div className="space-y-2 mb-3">
            {targets.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-700 truncate flex-1">{t.company_name}</span>
                <button onClick={() => onDeleteTarget(t.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          {/* Add form */}
          <div className="space-y-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Company name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400" />
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Website URL (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400" />
            <button onClick={() => { if (name.trim()) { onAddTarget(name.trim(), url.trim()); setName(''); setUrl(''); } }} disabled={!name.trim()}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white disabled:text-slate-400 text-sm font-medium py-2 rounded-lg transition-colors">
              + Add company
            </button>
          </div>
        </div>

        <button onClick={onFetchAnalyze} disabled={fetching || (!ownName && targets.length === 0)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
          {fetching ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Fetching & Analysing...</>
          ) : '🔍 Fetch & Analyse'}
        </button>
        {analysis?._fetched_at && (
          <p className="text-[11px] text-slate-400 text-center">Last run: {new Date(analysis._fetched_at).toLocaleString()}</p>
        )}
      </div>

      {/* Right: analysis results */}
      <div className="lg:col-span-2 space-y-5">
        {!analysis ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm">Add companies and click Fetch & Analyse to unlock content intelligence.</p>
          </div>
        ) : (
          <>
            {/* Timeline summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Timeline Summary</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{analysis.timeline_summary}</p>
            </div>

            {/* Insight row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Posting Cadence</p>
                <p className="text-sm font-medium text-slate-800">{analysis.own_cadence || '—'}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Top Themes</p>
                <div className="flex flex-wrap gap-1">
                  {(analysis.content_themes || []).slice(0, 3).map((t, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Best Day</p>
                <p className="text-sm font-medium text-slate-800">{analysis.best_day_guess || '—'}</p>
              </div>
            </div>

            {/* Content gaps */}
            {(analysis.content_gaps || []).length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-3">Content Gaps</p>
                <ul className="space-y-1.5">
                  {analysis.content_gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hook Swipe File */}
            {(analysis.hook_swipe_file || []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setHookOpen(h => !h)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <span className="text-sm font-semibold text-slate-800">📌 Hook Swipe File <span className="text-slate-400 font-normal">({analysis.hook_swipe_file.length} hooks)</span></span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${hookOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {hookOpen && (
                  <div className="px-5 pb-5 grid gap-3">
                    {analysis.hook_swipe_file.map((h, i) => (
                      <div key={i} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${HOOK_COLORS[h.pattern] ?? 'bg-slate-100 text-slate-600'}`}>{h.pattern}</span>
                          <span className="text-[10px] text-slate-400">from {h.company}</span>
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Post Ideas</p>
                <div className="grid gap-3">
                  {analysis.post_ideas.map((idea, i) => (
                    <div key={idea.id ?? i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ANGLE_COLORS[idea.angle] ?? 'bg-slate-100 text-slate-600'}`}>{idea.angle}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{idea.suggested_format}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{idea.topic}</p>
                        </div>
                        <button onClick={() => onSelectIdea(idea)}
                          className="flex-shrink-0 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          ✍️ Draft
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">{idea.rationale}</p>
                      {idea.hook && <p className="text-xs text-indigo-600 italic border-l-2 border-indigo-200 pl-2">"{idea.hook}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitor Post Feed */}
            {fetchedPosts.filter(p => p.source_type === 'target').length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setFeedOpen(f => !f)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <span className="text-sm font-semibold text-slate-800">📰 Competitor Post Feed <span className="text-slate-400 font-normal">({fetchedPosts.filter(p => p.source_type === 'target').length} posts)</span></span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${feedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {feedOpen && (
                  <div className="px-5 pb-5 space-y-4">
                    {fetchedPosts.filter(p => p.source_type === 'target').map(post => {
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
                            {isExpanded ? text : text.slice(0, 200)}{!isExpanded && text.length > 200 && '…'}
                          </p>
                          {text.length > 200 && (
                            <button onClick={() => setExpandedPosts(s => { const n = new Set(s); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })} className="text-xs text-indigo-500 hover:text-indigo-700 mt-1 underline">
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => handleRemix(post)} disabled={remixing === post.id}
                              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                              {remixing === post.id ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Remixing…</> : '🔄 Remix for my offer'}
                            </button>
                          </div>
                          {remix && (
                            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Remixed for your company</p>
                              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-3">{remix.remixed_content}</p>
                              <p className="text-[11px] text-slate-500 italic mb-1">Format kept: {remix.format_kept}</p>
                              <p className="text-[11px] text-slate-400 mb-3">{remix.what_changed}</p>
                              <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(remix.remixed_content)} className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">📋 Copy</button>
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
}

function DraftTab({ selectedIdea, onClearIdea, onPublished }: DraftTabProps) {
  const [draftContent, setDraftContent] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftHistory, setDraftHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [postScore, setPostScore] = useState<PostScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [thread, setThread] = useState<ThreadResult | null>(null);
  const [buildingThread, setBuildingThread] = useState(false);
  const [firstComment, setFirstComment] = useState<FirstComment | null>(null);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copiedThread, setCopiedThread] = useState(false);
  const [hookOpen, setHookOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Reset when idea changes
  useEffect(() => {
    setDraftContent('');
    setDraftHistory([]);
    setPostScore(null);
    setThread(null);
    setFirstComment(null);
  }, [selectedIdea?.id]);

  useEffect(() => { historyRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [draftHistory]);

  async function handleStartDraft() {
    if (!selectedIdea) return;
    setDraftLoading(true);
    try {
      const { content } = await startIdeaDraft(selectedIdea.id);
      setDraftContent(content);
      setPostScore(null);
    } catch { alert('Draft generation failed'); }
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
    } catch { alert('Refine failed'); }
    finally { setRefineLoading(false); }
  }

  async function handleScore() {
    if (!draftContent) return;
    setScoring(true);
    try { setPostScore(await scoreLinkedInPost(draftContent)); }
    catch { alert('Scoring failed'); }
    finally { setScoring(false); }
  }

  async function handleBuildThread() {
    if (!draftContent) return;
    setBuildingThread(true);
    try { setThread(await buildLinkedInThread(draftContent)); }
    catch { alert('Thread build failed'); }
    finally { setBuildingThread(false); }
  }

  async function handleFirstComment() {
    if (!draftContent) return;
    setGeneratingComment(true);
    try { setFirstComment(await generateFirstComment(draftContent)); }
    catch { alert('First comment generation failed'); }
    finally { setGeneratingComment(false); }
  }

  async function handlePublish() {
    if (!selectedIdea || !draftContent) return;
    setPublishing(true);
    try {
      const { post_id } = await publishIdeaAsPost(selectedIdea.id);
      onPublished(post_id);
    } catch { alert('Publish failed'); }
    finally { setPublishing(false); }
  }

  const verdictColor = postScore ? (
    postScore.verdict === 'strong_post' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    postScore.verdict === 'ready_to_post' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' :
    'text-amber-700 bg-amber-50 border-amber-200'
  ) : '';

  const scoreColor = (n: number) => n >= 7 ? 'bg-emerald-500' : n >= 5 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: starting point */}
      <div className="space-y-4">
        {/* Idea card */}
        {selectedIdea ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Starting from idea</p>
              <button onClick={onClearIdea} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ANGLE_COLORS[selectedIdea.angle] ?? 'bg-slate-100 text-slate-600'}`}>{selectedIdea.angle}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">{selectedIdea.topic}</p>
            {selectedIdea.hook && <p className="text-xs text-indigo-600 italic border-l-2 border-indigo-200 pl-2 mb-2">"{selectedIdea.hook}"</p>}
            <p className="text-xs text-slate-500">{selectedIdea.rationale}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-center">
            <p className="text-slate-400 text-sm mb-2">No idea selected</p>
            <p className="text-xs text-slate-400">Pick an idea from the Intelligence tab, or start from scratch below.</p>
          </div>
        )}

        <button onClick={handleStartDraft} disabled={draftLoading || !selectedIdea}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {draftLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating draft...</> : '✨ Generate initial draft'}
        </button>

        {/* AI chat */}
        {draftContent && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Refine with AI</p>
            {draftHistory.length > 0 && (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {draftHistory.map((h, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-xs ${h.role === 'user' ? 'bg-slate-100 text-slate-700 ml-6' : 'bg-indigo-50 border border-indigo-100 text-slate-700 mr-6'}`}>
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
                placeholder="Make it shorter, add a stat, stronger hook..."
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

      {/* Right: draft preview + tools */}
      <div className="space-y-4">
        {/* Draft preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Draft</p>
            {draftContent && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${charColor(draftContent.length)}`}>{draftContent.length} chars</span>
            )}
          </div>
          <textarea value={draftContent} onChange={e => { setDraftContent(e.target.value); setPostScore(null); }}
            placeholder="Your draft will appear here. Generate one from an idea, or type freely..."
            rows={12}
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed placeholder:text-slate-300" />
        </div>

        {/* Action buttons */}
        {draftContent && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleScore} disabled={scoring}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
              {scoring ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '📊'} Score post
            </button>
            <button onClick={handleBuildThread} disabled={buildingThread}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
              {buildingThread ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '🧵'} Build thread
            </button>
            <button onClick={handleFirstComment} disabled={generatingComment}
              className="text-xs font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
              {generatingComment ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : '💬'} First comment
            </button>
            <button onClick={handlePublish} disabled={publishing || !selectedIdea}
              className="ml-auto text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
              {publishing ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '💾'} Save as post
            </button>
          </div>
        )}

        {/* Post score card */}
        {postScore && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Post Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">{postScore.overall}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${verdictColor}`}>
                  {postScore.verdict.replace(/_/g, ' ')}
                </span>
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
                    <div className={`h-full rounded-full transition-all ${scoreColor(val)}`} style={{ width: `${val * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {postScore.suggestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2">Improvements</p>
                <ul className="space-y-1">
                  {postScore.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
                <button onClick={() => {
                  const msg = `Improve based on this feedback: ${postScore.suggestions.join('. ')}`;
                  setDraftMessage(msg);
                }} className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900">
                  Apply suggestions in chat →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Thread builder */}
        {thread && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Thread ({thread.total_parts} parts)</p>
              <button onClick={() => {
                navigator.clipboard.writeText(thread.thread.map(p => p.content).join('\n\n---\n\n'));
                setCopiedThread(true); setTimeout(() => setCopiedThread(false), 2000);
              }} className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">
                {copiedThread ? '✓ Copied' : '📋 Copy full thread'}
              </button>
            </div>
            <div className="space-y-3">
              {thread.thread.map(part => (
                <div key={part.part} className="bg-slate-50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-400 flex-shrink-0 pt-0.5">{part.part}/{thread.total_parts}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800 leading-relaxed">{part.content}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${charColor(part.char_count)}`}>{part.char_count} chars</span>
                      <button onClick={() => navigator.clipboard.writeText(part.content)} className="text-[10px] text-slate-400 hover:text-slate-600">Copy</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* First comment */}
        {firstComment && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">First Comment (pin immediately after posting)</p>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed mb-2">{firstComment.comment}</p>
            <p className="text-xs text-slate-400 italic mb-3">{firstComment.rationale}</p>
            <button onClick={() => navigator.clipboard.writeText(firstComment.comment)} className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-1 rounded-lg transition-colors">📋 Copy comment</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInPage() {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'draft' | 'posts'>('intelligence');

  // Intelligence state
  const [companyProfile, setCompanyProfile] = useState<Partial<CompanyProfile> | null>(null);
  const [targets, setTargets] = useState<LinkedInTarget[]>([]);
  const [analysis, setAnalysis] = useState<LinkedInAnalysis | null>(null);
  const [fetching, setFetching] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null);

  // Posts state
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState('auto');
  const [postsError, setPostsError] = useState('');
  const [activeRefineId, setActiveRefineId] = useState<string | null>(null);
  const [refineHistories, setRefineHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [editContents, setEditContents] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      listLinkedInTargets().then(setTargets).catch(() => {}),
      getLinkedInAnalysis().then(a => { if (a) setAnalysis(a); }).catch(() => {}),
      getCompanyProfile().then(p => setCompanyProfile(p ?? null)).catch(() => {}),
      listLinkedInPosts().then(setPosts).catch(() => setPostsError('Failed to load posts')).finally(() => setPostsLoading(false)),
    ]);
  }, []);

  // Intelligence handlers
  async function handleAddTarget(name: string, url: string) {
    const { id } = await addLinkedInTarget({ company_name: name, website_url: url });
    setTargets(prev => [...prev, { id, company_name: name, website_url: url, created_at: new Date().toISOString() }]);
  }

  async function handleDeleteTarget(id: string) {
    await deleteLinkedInTarget(id);
    setTargets(prev => prev.filter(t => t.id !== id));
  }

  async function handleFetchAnalyze() {
    setFetching(true);
    try {
      const result = await fetchAndAnalyzeLinkedIn();
      setAnalysis({ ...result.analysis, fetched_posts: result.fetched_posts });
    } catch { alert('Fetch & Analyse failed — try again'); }
    finally { setFetching(false); }
  }

  function handleSelectIdea(idea: PostIdea) {
    setSelectedIdea(idea);
    setActiveTab('draft');
  }

  // Posts tab handlers
  async function handleGenerate() {
    setGenerating(true); setPostsError('');
    try {
      const newPosts = await generateLinkedInPosts(selectedPersona);
      setPosts(prev => [...newPosts, ...prev]);
    } catch (err) { setPostsError(err instanceof Error ? err.message : 'Failed to generate posts'); }
    finally { setGenerating(false); }
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
    } catch { setPostsError('Failed to update status'); }
  }

  async function handleDelete(postId: string) {
    try {
      await deleteLinkedInPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (activeRefineId === postId) setActiveRefineId(null);
    } catch { setPostsError('Failed to delete post'); }
  }

  function handleRefineUpdate(postId: string, content: string, history: HistoryEntry[]) {
    setEditContents(prev => ({ ...prev, [postId]: content }));
    setRefineHistories(prev => ({ ...prev, [postId]: history }));
  }

  function handleApplyRefine(postId: string, newContent: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent, char_count: newContent.length } : p));
    setEditContents(prev => { const n = { ...prev }; delete n[postId]; return n; });
    setRefineHistories(prev => ({ ...prev, [postId]: [] }));
    setActiveRefineId(null);
  }

  function handlePublished(postId: string) {
    // Reload posts tab and switch to it
    listLinkedInPosts().then(setPosts).catch(() => {});
    setActiveTab('posts');
  }

  const selectedCount = posts.filter(p => p.status === 'selected').length;
  const postedCount = posts.filter(p => p.status === 'posted').length;
  const clusters = Array.from(new Set(posts.map(p => p.trend_cluster).filter(Boolean)));

  const TABS = [
    { id: 'intelligence' as const, label: '📊 Intelligence' },
    { id: 'draft' as const, label: '✍️ Draft' },
    { id: 'posts' as const, label: `📝 Posts${posts.length > 0 ? ` (${posts.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">LinkedIn Intelligence Hub</h1>
              <p className="text-slate-500 text-sm mt-0.5">Analyse the content landscape, draft posts with AI, and build your publishing pipeline</p>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex items-center gap-1 mt-4 bg-slate-100 p-1 rounded-lg w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Intelligence tab */}
        {activeTab === 'intelligence' && (
          <IntelligenceTab
            companyProfile={companyProfile}
            targets={targets}
            analysis={analysis}
            onAddTarget={handleAddTarget}
            onDeleteTarget={handleDeleteTarget}
            onFetchAnalyze={handleFetchAnalyze}
            fetching={fetching}
            onSelectIdea={handleSelectIdea}
          />
        )}

        {/* Draft tab */}
        {activeTab === 'draft' && (
          <DraftTab
            selectedIdea={selectedIdea}
            onClearIdea={() => setSelectedIdea(null)}
            onPublished={handlePublished}
          />
        )}

        {/* Posts tab */}
        {activeTab === 'posts' && (
          <div>
            {/* Persona selector + generate button */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Writing persona</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PERSONAS.map(p => (
                      <button key={p.value} onClick={() => setSelectedPersona(p.value)} title={p.desc}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                          selectedPersona === p.value
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                        }`}>
                        <span>{p.icon}</span><span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {selectedPersona !== 'auto' && (
                    <p className="text-[11px] text-slate-400 mt-1.5">{PERSONAS.find(p => p.value === selectedPersona)?.desc}</p>
                  )}
                </div>
                <button onClick={handleGenerate} disabled={generating}
                  className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 text-white font-medium px-4 py-2.5 rounded-lg transition-all shadow-sm flex items-center gap-2 text-sm flex-shrink-0">
                  {generating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating...</> : 'Generate fresh posts'}
                </button>
              </div>
              {/* Context chips */}
              {posts.length > 0 && (
                <div className="flex items-center gap-3 mt-4 flex-wrap border-t border-slate-100 pt-4">
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{posts.length} posts total</span>
                  {clusters.length > 0 && <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{clusters.length} trend {clusters.length === 1 ? 'cluster' : 'clusters'}</span>}
                  {selectedCount > 0 && <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">{selectedCount} selected</span>}
                  {postedCount > 0 && <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{postedCount} posted</span>}
                </div>
              )}
            </div>

            {postsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
                <span>{postsError}</span>
                <button onClick={() => setPostsError('')} className="text-red-500 hover:text-red-700 ml-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            )}

            {postsLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading posts...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center max-w-lg mx-auto">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">No posts yet</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">Generate your first batch of LinkedIn posts based on your market intelligence and brand voice.</p>
                <button onClick={handleGenerate} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 mx-auto">
                  {generating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating...</> : 'Generate fresh posts'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <PostCard key={post.id} post={post}
                    isRefineOpen={activeRefineId === post.id}
                    refineHistory={refineHistories[post.id] ?? []}
                    editContent={editContents[post.id]}
                    onToggleRefine={() => setActiveRefineId(prev => prev === post.id ? null : post.id)}
                    onRefineUpdate={(content, history) => handleRefineUpdate(post.id, content, history)}
                    onApplyRefine={handleApplyRefine}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
