'use client';

import { useEffect, useState, useRef } from 'react';
import {
  LinkedInPost,
  RefineRequest,
  generateLinkedInPosts,
  listLinkedInPosts,
  updateLinkedInPostStatus,
  deleteLinkedInPost,
  refineLinkedInPost,
} from '@/lib/api';

// ── Strategy metadata ─────────────────────────────────────────────────────────

const STRATEGY_META: Record<string, { label: string; color: string }> = {
  trend_spotlight: { label: 'Trend Spotlight',  color: 'bg-violet-100 text-violet-700' },
  pain_narrative:  { label: 'Pain Narrative',   color: 'bg-red-100 text-red-700' },
  contrarian:      { label: 'Contrarian Take',  color: 'bg-amber-100 text-amber-700' },
  how_we_help:     { label: 'How We Help',      color: 'bg-blue-100 text-blue-700' },
  industry_take:   { label: 'Industry Take',    color: 'bg-indigo-100 text-indigo-700' },
  case_signal:     { label: 'Case Signal',      color: 'bg-emerald-100 text-emerald-700' },
};

// ── Refine panel ──────────────────────────────────────────────────────────────

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

interface RefinePanelProps {
  post: LinkedInPost;
  onApply: (newContent: string) => void;
  onClose: () => void;
  history: HistoryEntry[];
  editContent: string | undefined;
  onUpdate: (content: string, history: HistoryEntry[]) => void;
}

function RefinePanel({ post, onApply, onClose, history, editContent, onUpdate }: RefinePanelProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentContent = editContent ?? post.content;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function handleSend() {
    if (!message.trim() || loading) return;
    const msg = message.trim();
    setMessage('');
    setLoading(true);
    setError('');
    try {
      const req: RefineRequest = {
        message: msg,
        current_content: currentContent,
        history,
      };
      const res = await refineLinkedInPost(post.id, req);
      onUpdate(res.content, res.history as HistoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refine failed');
    } finally {
      setLoading(false);
    }
  }

  function handleRevert() {
    onUpdate(post.content, []);
  }

  return (
    <div className="border-l-2 border-indigo-200 ml-4 pl-4 mt-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Edit with AI</p>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Current content preview */}
      {editContent && editContent !== post.content && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">
            Refined version
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{editContent}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onApply(editContent)}
              className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              Apply changes
            </button>
            <button
              onClick={handleRevert}
              className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
            >
              Revert
            </button>
          </div>
        </div>
      )}

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {history.map((h, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                h.role === 'user'
                  ? 'bg-slate-100 text-slate-700 ml-6'
                  : 'bg-white border border-slate-200 text-slate-600 mr-6'
              }`}
            >
              <span className="font-medium text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                {h.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="whitespace-pre-wrap">{h.content.length > 150 ? h.content.slice(0, 150) + '…' : h.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="e.g. Make it shorter, add a contrarian angle..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || loading}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: LinkedInPost;
  isRefineOpen: boolean;
  refineHistory: HistoryEntry[];
  editContent: string | undefined;
  onToggleRefine: () => void;
  onRefineUpdate: (content: string, history: HistoryEntry[]) => void;
  onApplyRefine: (postId: string, newContent: string) => void;
  onStatusChange: (postId: string, status: string) => void;
  onDelete: (postId: string) => void;
}

function PostCard({
  post,
  isRefineOpen,
  refineHistory,
  editContent,
  onToggleRefine,
  onRefineUpdate,
  onApplyRefine,
  onStatusChange,
  onDelete,
}: PostCardProps) {
  const [copied, setCopied] = useState(false);
  const meta = STRATEGY_META[post.strategy] ?? { label: post.strategy, color: 'bg-slate-100 text-slate-600' };
  const charCount = editContent ? editContent.length : post.char_count;
  const displayContent = editContent ?? post.content;

  const charColor =
    charCount <= 1300 ? 'bg-emerald-100 text-emerald-700' :
    charCount <= 1700 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';

  function handleCopy() {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-slide-up">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
          {meta.label}
        </span>
        {post.trend_cluster && (
          <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
            {post.trend_cluster}
          </span>
        )}
        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ml-auto ${charColor}`}>
          {charCount} chars
        </span>
      </div>

      {/* Strategy note */}
      {post.strategy_note && (
        <p className="text-[11px] text-slate-400 italic mb-3 leading-relaxed">
          {post.strategy_note}
        </p>
      )}

      {/* Post content */}
      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-4">
        {displayContent}
      </p>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        {/* Select / Selected */}
        {post.status === 'selected' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Selected
          </span>
        ) : (
          <button
            onClick={() => onStatusChange(post.id, 'selected')}
            className="text-xs font-medium text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Select
          </button>
        )}

        {/* Mark as posted */}
        {post.status === 'selected' && (
          <button
            onClick={() => onStatusChange(post.id, 'posted')}
            className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Mark as Posted
          </button>
        )}

        {post.status === 'posted' && (
          <span className="text-xs font-medium text-slate-400 px-3 py-1.5">
            Posted
          </span>
        )}

        {/* Edit with AI */}
        <button
          onClick={onToggleRefine}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            isRefineOpen
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
          }`}
        >
          Edit with AI
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="text-xs font-medium text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>

        {/* Discard */}
        <button
          onClick={() => onDelete(post.id)}
          className="ml-auto text-xs font-medium text-slate-400 hover:text-red-600 border border-transparent hover:border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Discard post"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Refine panel */}
      {isRefineOpen && (
        <RefinePanel
          post={post}
          history={refineHistory}
          editContent={editContent}
          onApply={(newContent) => onApplyRefine(post.id, newContent)}
          onClose={onToggleRefine}
          onUpdate={onRefineUpdate}
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center max-w-lg mx-auto">
      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No posts yet</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-2">
        Generate your first batch of LinkedIn posts based on your market intelligence.
      </p>
      <p className="text-xs text-slate-400 mb-6">
        The AI synthesises your researched companies, pain points, trends, and company profile
        into a strategic mix of 5 ready-to-use posts.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 mx-auto"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          'Generate fresh posts'
        )}
      </button>
    </div>
  );
}

// ── Persona metadata ──────────────────────────────────────────────────────────

const PERSONAS: { value: string; label: string; desc: string; icon: string }[] = [
  { value: 'auto',           label: 'Auto',          desc: 'Balanced, inferred from profile',     icon: '🤖' },
  { value: 'founder',        label: 'Founder Voice',  desc: 'Visionary, candid, big-picture',      icon: '🚀' },
  { value: 'technical',      label: 'Technical Expert', desc: 'Precise, credible, how-things-work', icon: '🛠️' },
  { value: 'business_leader', label: 'Business Leader', desc: 'ROI-focused, executive-level',        icon: '📈' },
  { value: 'bd_lead',        label: 'BD Lead',        desc: 'Client-centric, opportunity-aware',   icon: '🤝' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('auto');

  // Refine state
  const [activeRefineId, setActiveRefineId] = useState<string | null>(null);
  const [refineHistories, setRefineHistories] = useState<Record<string, { role: 'user' | 'assistant'; content: string }[]>>({});
  const [editContents, setEditContents] = useState<Record<string, string>>({});

  useEffect(() => {
    listLinkedInPosts()
      .then(setPosts)
      .catch(() => setError('Failed to load posts'))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate(persona?: string) {
    setGenerating(true);
    setError('');
    try {
      const newPosts = await generateLinkedInPosts(persona ?? selectedPersona);
      setPosts(prev => [...newPosts, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate posts');
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(postId: string, status: string) {
    try {
      await updateLinkedInPostStatus(postId, status);
      setPosts(prev => prev.map(p => {
        if (status === 'selected') {
          // Deselect others optimistically
          if (p.id === postId) return { ...p, status: 'selected' as const };
          if (p.status === 'selected') return { ...p, status: 'draft' as const };
          return p;
        }
        return p.id === postId ? { ...p, status: status as LinkedInPost['status'] } : p;
      }));
    } catch {
      setError('Failed to update post status');
    }
  }

  async function handleDelete(postId: string) {
    try {
      await deleteLinkedInPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (activeRefineId === postId) setActiveRefineId(null);
    } catch {
      setError('Failed to delete post');
    }
  }

  function handleRefineUpdate(postId: string, content: string, history: { role: 'user' | 'assistant'; content: string }[]) {
    setEditContents(prev => ({ ...prev, [postId]: content }));
    setRefineHistories(prev => ({ ...prev, [postId]: history }));
  }

  function handleApplyRefine(postId: string, newContent: string) {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, content: newContent, char_count: newContent.length } : p
    ));
    setEditContents(prev => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setRefineHistories(prev => ({ ...prev, [postId]: [] }));
    setActiveRefineId(null);
  }

  // Stats
  const selectedCount = posts.filter(p => p.status === 'selected').length;
  const postedCount = posts.filter(p => p.status === 'posted').length;
  const clusters = Array.from(new Set(posts.map(p => p.trend_cluster).filter(Boolean)));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">LinkedIn Posts</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                AI-generated content strategy based on your market intelligence
              </p>
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 text-white font-medium px-4 py-2.5 rounded-lg transition-all shadow-sm shadow-indigo-900/20 flex items-center gap-2 text-sm"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate fresh posts'
              )}
            </button>
          </div>

          {/* Persona selector */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Writing persona
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {PERSONAS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setSelectedPersona(p.value)}
                  title={p.desc}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    selectedPersona === p.value
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            {selectedPersona !== 'auto' && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                {PERSONAS.find(p => p.value === selectedPersona)?.desc}
              </p>
            )}
          </div>

          {/* Context chips */}
          {posts.length > 0 && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {posts.length} posts total
              </span>
              {clusters.length > 0 && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {clusters.length} trend {clusters.length === 1 ? 'cluster' : 'clusters'}
                </span>
              )}
              {selectedCount > 0 && (
                <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  {selectedCount} selected
                </span>
              )}
              {postedCount > 0 && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {postedCount} posted
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 flex items-center justify-between animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading posts...</span>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState onGenerate={() => handleGenerate(selectedPersona)} generating={generating} />
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
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
    </div>
  );
}
