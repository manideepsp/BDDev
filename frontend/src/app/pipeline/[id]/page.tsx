'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPipeline, continuePipeline, bulkGenerate, runDriftCheck, runCompetitiveAnalysis,
  Pipeline, PipelineProspect, PainPoint, ICPScore, TechStack,
  EnrichedPerson, GatheredPost, GatheredJob, DriftResult, CompetitiveAnalysis } from '@/lib/api';

const PIPELINE_STAGES = ['gathering', 'people', 'keywords', 'researching', 'indexing', 'awaiting_input', 'insights', 'embedding'] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: 'Starting...', gathering: 'Gathering Sources', people: 'People Swarm',
  keywords: 'Extracting Keywords', researching: 'Web Research', indexing: 'RAG Indexing',
  awaiting_input: 'Awaiting Review', insights: 'Generating Insights',
  embedding: 'Building Vector Index', complete: 'Complete',
  // legacy
  scraping: 'Scraping Website', linkedin: 'LinkedIn Intelligence',
};

function StageTracker({ status }: { status: string }) {
  const stages = PIPELINE_STAGES;
  const currentIdx = stages.indexOf(status as typeof PIPELINE_STAGES[number]);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-4">Pipeline Progress</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, i) => {
          const isDone = status === 'complete' || currentIdx > i;
          const isActive = status === stage;
          const isFailed = status === 'failed';
          return (
            <div key={stage} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                isFailed && isActive ? 'bg-red-100 text-red-700' :
                isDone ? 'bg-emerald-100 text-emerald-700' :
                isActive ? 'bg-amber-100 text-amber-700 animate-pulse' :
                'bg-slate-100 text-slate-400'
              }`}>
                {isDone ? '✓' : isActive ? '⟳' : '○'} {STAGE_LABELS[stage] ?? stage}
              </div>
              {i < stages.length - 1 && <div className={`w-4 h-px ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${fill} ${c - fill}`} strokeDashoffset={c / 4} strokeLinecap="round" />
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill={color}>{score}</text>
      <text x="44" y="57" textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
    </svg>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[confidence] ?? styles.medium}`}>
      {confidence}
    </span>
  );
}

const SEV_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
};

function PainPointCard({ pain }: { pain: PainPoint }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-semibold text-slate-900 text-sm">{pain.title}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SEV_STYLES[pain.severity] ?? SEV_STYLES.low}`}>
            {pain.severity}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {pain.confidence} conf.
          </span>
        </div>
      </div>
      {(pain.evidence ?? []).length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Evidence</p>
          <ul className="space-y-1">
            {pain.evidence.map((e, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2">
                <span className="text-slate-300 flex-shrink-0">“</span>{e}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pain.inference && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Inference</p>
          <p className="text-xs text-slate-600">{pain.inference}</p>
        </div>
      )}
      {pain.opportunity && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-0.5">Your Opportunity</p>
          <p className="text-xs text-emerald-800">{pain.opportunity}</p>
        </div>
      )}
      {pain.pitch_angle && (
        <p className="text-xs text-indigo-600 italic mt-2">💡 {pain.pitch_angle}</p>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-medium text-slate-700">{v}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function ICPCard({ icp }: { icp: ICPScore }) {
  const b = icp.breakdown ?? ({} as ICPScore['breakdown']);
  const rows: [string, number][] = [
    ['Industry Fit', b.industry_fit], ['Tech Alignment', b.tech_alignment],
    ['Company Size', b.company_size], ['Pain–Service Fit', b.pain_service_fit],
    ['Budget Probability', b.budget_probability], ['Decision Readiness', b.decision_readiness],
  ];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ICP Match Score</p>
        <span className="text-2xl font-bold text-indigo-600">{icp.overall}%</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 mb-4">
        {rows.map(([label, value]) => <ScoreBar key={label} label={label} value={value} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
        {icp.recommended_action && (
          <div className="bg-indigo-50 rounded-lg p-2.5">
            <p className="text-[10px] text-indigo-400 uppercase tracking-wider">Action</p>
            <p className="text-xs font-medium text-indigo-800 mt-0.5">{icp.recommended_action}</p>
          </div>
        )}
        {icp.suggested_deal_size && (
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Suggested Deal</p>
            <p className="text-xs font-medium text-slate-700 mt-0.5">{icp.suggested_deal_size}</p>
          </div>
        )}
        {icp.best_entry_point && (
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Best Entry Point</p>
            <p className="text-xs font-medium text-slate-700 mt-0.5">{icp.best_entry_point}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TechStackCard({ tech }: { tech: TechStack }) {
  const cols: [string, string[], string][] = [
    ['Current', tech.current ?? [], 'bg-slate-100 text-slate-600'],
    ['Hiring For', tech.hiring ?? [], 'bg-blue-100 text-blue-700'],
    ['Gaps', tech.gaps ?? [], 'bg-red-100 text-red-700'],
  ];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Technology Signals</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cols.map(([label, items, cls]) => (
          <div key={label}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.length > 0
                ? items.map((t, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-md ${cls}`}>{t}</span>)
                : <span className="text-xs text-slate-300">—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleGrid({ people, removed, onToggle }: {
  people: EnrichedPerson[]; removed?: Set<string>; onToggle?: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {people.map((p, i) => {
        const isRemoved = removed?.has(p.name);
        return (
          <div key={i} className={`bg-white rounded-xl border shadow-sm p-4 transition-colors ${
            isRemoved ? 'border-slate-200 opacity-50' : 'border-slate-200'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{p.name}</p>
                <p className="text-xs text-slate-500 truncate">{p.title}</p>
              </div>
              {onToggle && (
                <button onClick={() => onToggle(p.name)}
                  className={`text-xs px-2 py-1 rounded-md border flex-shrink-0 transition-colors ${
                    isRemoved ? 'border-emerald-300 text-emerald-600' : 'border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500'
                  }`}>
                  {isRemoved ? 'Restore' : 'Remove'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.role_category && <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{p.role_category}</span>}
              {p.seniority && p.seniority !== 'Unknown' && <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{p.seniority}</span>}
              {p.location && p.location !== 'Unknown' && <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">📍 {p.location}</span>}
              {p.confidence && <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">{p.confidence} conf.</span>}
            </div>
            {p.relevance && <p className="text-xs text-slate-600 mt-2">{p.relevance}</p>}
          </div>
        );
      })}
    </div>
  );
}

function SignalSections({ people, posts, jobs, removed, onToggle }: {
  people?: EnrichedPerson[]; posts?: GatheredPost[]; jobs?: GatheredJob[];
  removed?: Set<string>; onToggle?: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      {(people ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            🐝 People <span className="text-slate-400 normal-case font-normal">— swarm-enriched ({people!.length})</span>
          </p>
          <PeopleGrid people={people!} removed={removed} onToggle={onToggle} />
        </div>
      )}
      {(posts ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">📣 Recent Posts & Activity</p>
          <div className="space-y-2">
            {posts!.slice(0, 8).map((post, i) => (
              <a key={i} href={post.url} target="_blank" rel="noopener noreferrer"
                 className="block bg-white rounded-lg border border-slate-200 shadow-sm p-3 hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{post.source}</span>
                  {post.title && <span className="text-xs font-medium text-slate-700 truncate">{post.title}</span>}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{post.text}</p>
              </a>
            ))}
          </div>
        </div>
      )}
      {(jobs ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">💼 Open Roles <span className="text-slate-400 normal-case font-normal">— hiring signals</span></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {jobs!.slice(0, 10).map((job, i) => (
              <a key={i} href={job.url} target="_blank" rel="noopener noreferrer"
                 className="block bg-white rounded-lg border border-slate-200 shadow-sm p-3 hover:border-indigo-200 transition-colors">
                <p className="text-xs font-medium text-slate-700 truncate">{job.title}</p>
                {job.location && <p className="text-[10px] text-slate-400 mt-0.5">📍 {job.location}</p>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Cluster-based accept/reject review panel --------------------------------

type ExcludedItems = Record<string, Set<number>>;

function AcceptRejectItem({ accepted, onToggle, children }: {
  accepted: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`relative flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${
      accepted ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-50'
    }`}>
      <button
        onClick={onToggle}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          accepted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-400'
        }`}
        title={accepted ? 'Click to reject' : 'Click to accept'}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {accepted
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          }
        </svg>
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ClusterCard({ icon, label, count, accepted, children, defaultOpen = true }: {
  icon: string; label: string; count: number; accepted: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const allAccepted = accepted === count;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            allAccepted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {accepted}/{count} kept
          </span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

function ReviewPanel({ pipelineId, gathered, onContinued }: {
  pipelineId: string;
  gathered: NonNullable<Pipeline['gathered']>;
  onContinued: () => void;
}) {
  // People: Set<name> of removed
  const [removedPeople, setRemovedPeople] = useState<Set<string>>(new Set());
  // Other sources: Set<index> per source key
  const [excluded, setExcluded] = useState<ExcludedItems>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const people = gathered.people?.people ?? [];
  const posts = gathered.posts?.posts ?? [];
  const jobs = gathered.jobs?.jobs ?? [];
  const crawlFindings = gathered.crawl?.findings ?? [];
  const researchResults = gathered.research?.results ?? [];

  // LinkedIn & website are read-only (accept-only, shown as info)
  const linkedinFields = gathered.linkedin?.company_fields ?? {};
  const websitePages = gathered.website?.pages ?? [];
  const keywords = gathered.keywords?.keywords ?? [];
  const productAreas = gathered.keywords?.product_areas ?? [];
  const ragChunks = gathered.rag_chunks ?? 0;
  const asOf = gathered.posts?.as_of;

  function togglePerson(name: string) {
    setRemovedPeople(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  function toggleItem(source: string, idx: number) {
    setExcluded(prev => {
      const next = { ...prev };
      const s = new Set(next[source] ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      next[source] = s;
      return next;
    });
  }

  function isExcluded(source: string, idx: number) {
    return excluded[source]?.has(idx) ?? false;
  }

  const totalExcluded = removedPeople.size + Object.values(excluded).reduce((a, s) => a + s.size, 0);

  async function handleContinue() {
    setSubmitting(true);
    setError('');
    const excludedItems: Record<string, number[]> = {};
    for (const [k, s] of Object.entries(excluded)) {
      if (s.size > 0) excludedItems[k] = Array.from(s);
    }
    try {
      await continuePipeline(pipelineId, {
        human_input: note.trim() || undefined,
        removed_people: Array.from(removedPeople),
        excluded_items: excludedItems,
      });
      onContinued();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue — please try again');
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-8 space-y-4">
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-amber-800">✋ Human checkpoint — review before synthesis</p>
        <p className="text-xs text-amber-700 mt-1">
          The agents gathered everything below{asOf ? ` (as of ${asOf})` : ''} and indexed it for RAG.
          Accept or reject individual items in each cluster — only kept items feed into synthesis.
          Add context in the box at the bottom to inject your own knowledge with highest priority.
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-amber-600">
          <span className="bg-white border border-amber-200 px-2 py-1 rounded-md">
            <span className="font-semibold">{ragChunks}</span> chunks indexed
          </span>
          {totalExcluded > 0 && (
            <span className="bg-red-50 border border-red-200 text-red-600 px-2 py-1 rounded-md">
              <span className="font-semibold">{totalExcluded}</span> items excluded
            </span>
          )}
        </div>
      </div>

      {/* Cluster 1: Company Identity (read-only — agents own this) */}
      {(Object.keys(linkedinFields).length > 0 || websitePages.length > 0) && (
        <ClusterCard icon="🏢" label="Company Identity"
          count={Object.keys(linkedinFields).filter(k => k !== 'people').length + websitePages.length}
          accepted={Object.keys(linkedinFields).filter(k => k !== 'people').length + websitePages.length}>
          {Object.keys(linkedinFields).filter(k => k !== 'people').length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">LinkedIn</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(linkedinFields).filter(([k]) => k !== 'people' && linkedinFields[k as keyof typeof linkedinFields]).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k}</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{String(v).slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {websitePages.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Website pages scraped</p>
              {websitePages.map((pg, i) => (
                <div key={pg.url ?? i} className="flex items-center gap-2 py-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">page</span>
                  <span className="text-xs text-slate-600 truncate">{pg.title || pg.url}</span>
                </div>
              ))}
            </div>
          )}
          {(keywords.length > 0 || productAreas.length > 0) && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Extracted keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{kw}</span>)}
                {productAreas.map((pa, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{pa}</span>)}
              </div>
            </div>
          )}
        </ClusterCard>
      )}

      {/* Cluster 2: Leadership & People */}
      {people.length > 0 && (
        <ClusterCard icon="🐝" label="Leadership & People"
          count={people.length} accepted={people.length - removedPeople.size}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {people.map((p) => (
              <AcceptRejectItem key={p.name} accepted={!removedPeople.has(p.name)}
                onToggle={() => togglePerson(p.name)}>
                <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-500 truncate">{p.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.role_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{p.role_category}</span>}
                  {p.seniority && p.seniority !== 'Unknown' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{p.seniority}</span>}
                  {p.location && p.location !== 'Unknown' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">📍 {p.location}</span>}
                </div>
                {p.relevance && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{p.relevance}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {/* Cluster 3: Recent Announcements & Posts */}
      {posts.length > 0 && (
        <ClusterCard icon="📣" label="Recent Announcements & Posts"
          count={posts.length} accepted={posts.length - (excluded['posts']?.size ?? 0)}>
          {asOf && (
            <p className="text-[10px] text-slate-400 mb-2">
              As of {asOf} · {gathered.posts?.lookback_months}mo lookback
              · sources: company website, LinkedIn, web
            </p>
          )}
          <div className="space-y-2">
            {posts.map((post, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('posts', i)} onToggle={() => toggleItem('posts', i)}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    post.source === 'company' ? 'bg-emerald-100 text-emerald-700' :
                    post.source === 'LinkedIn' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>{post.source}</span>
                  {post.date && <span className="text-[10px] text-slate-400">{post.date}</span>}
                </div>
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-slate-700 hover:text-indigo-600 line-clamp-1">{post.title}</a>
                {post.text && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{post.text}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {/* Cluster 4: Open Roles */}
      {jobs.length > 0 && (
        <ClusterCard icon="💼" label="Open Roles — hiring signals"
          count={jobs.length} accepted={jobs.length - (excluded['jobs']?.size ?? 0)}
          defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {jobs.map((job, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('jobs', i)} onToggle={() => toggleItem('jobs', i)}>
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-slate-700 hover:text-indigo-600 line-clamp-1">{job.title}</a>
                {job.location && <p className="text-[10px] text-slate-400 mt-0.5">📍 {job.location}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {/* Cluster 5: Web Presence (crawl findings grouped by type) */}
      {crawlFindings.length > 0 && (() => {
        const byType: Record<string, { item: typeof crawlFindings[0]; idx: number }[]> = {};
        crawlFindings.forEach((f, idx) => {
          (byType[f.source_type] ??= []).push({ item: f, idx });
        });
        return (
          <ClusterCard icon="🕸️" label="Web Presence"
            count={crawlFindings.length} accepted={crawlFindings.length - (excluded['crawl']?.size ?? 0)}
            defaultOpen={false}>
            {Object.entries(byType).map(([type, items]) => (
              <div key={type}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">{type}</p>
                <div className="space-y-1.5">
                  {items.map(({ item, idx }) => (
                    <AcceptRejectItem key={idx} accepted={!isExcluded('crawl', idx)} onToggle={() => toggleItem('crawl', idx)}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-slate-700 hover:text-indigo-600 line-clamp-1">{item.title || item.url}</a>
                      {item.snippet && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{item.snippet}</p>}
                    </AcceptRejectItem>
                  ))}
                </div>
              </div>
            ))}
          </ClusterCard>
        );
      })()}

      {/* Cluster 6: Research */}
      {researchResults.length > 0 && (
        <ClusterCard icon="🔍" label="Targeted Research"
          count={researchResults.length} accepted={researchResults.length - (excluded['research']?.size ?? 0)}
          defaultOpen={false}>
          <div className="space-y-1.5">
            {researchResults.map((r, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('research', i)} onToggle={() => toggleItem('research', i)}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{r.angle}</span>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-slate-700 hover:text-indigo-600 line-clamp-1">{r.title}</a>
                {r.snippet && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{r.snippet}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {/* Human context + continue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Add context for synthesis <span className="text-slate-400 normal-case font-normal">(optional — highest priority)</span>
        </label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder="e.g. 'We already spoke to their VP Eng — focus on the data platform gap', or correct anything the agents got wrong..."
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">⚠️ {error}</div>
        )}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button onClick={handleContinue} disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
            {submitting ? '⏳ Starting synthesis...' : '🧠 Continue to Insights →'}
          </button>
          {totalExcluded > 0 && (
            <span className="text-xs text-amber-600 font-medium">{totalExcluded} item(s) will be excluded</span>
          )}
          <span className="text-xs text-slate-400 ml-auto">Nothing here blocks synthesis — continue when ready</span>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [continued, setContinued] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ generated: number; total: number } | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);
  const [competitiveLoading, setCompetitiveLoading] = useState(false);
  const [competitiveResult, setCompetitiveResult] = useState<CompetitiveAnalysis | null>(null);

  const PAUSED = (s?: string) => s === 'complete' || s === 'failed' || s === 'awaiting_input';

  const fetchPipeline = useCallback(async () => {
    try {
      const p = await getPipeline(id);
      setPipeline(p);
      if (PAUSED(p.status)) setLoading(false);
    } catch {
      router.push('/');
    }
  }, [id, router]);

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(() => {
      if (!PAUSED(pipeline?.status)) fetchPipeline();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchPipeline, pipeline?.status]);

  // Optimistically resume after the human checkpoint so polling restarts.
  // `continued` guard prevents the ReviewPanel from re-appearing due to the
  // race between the background task starting and the next poll.
  const handleContinued = useCallback(() => {
    setContinued(true);
    setPipeline(prev => (prev ? { ...prev, status: 'insights' } : prev));
  }, []);

  if (!pipeline) return (
    <div className="p-8 flex items-center gap-3 text-slate-500">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading pipeline...
    </div>
  );

  const intel = pipeline.intelligence;
  const overview = intel?.company_overview;
  const score = intel?.engagement_score?.score ?? 0;
  const prospects: PipelineProspect[] = pipeline.prospects ?? intel?.prospects ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-slate-400 flex items-center gap-2">
        <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{pipeline.company_name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pipeline.company_name}</h1>
          {overview && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {overview.industry && <span className="text-sm text-slate-500">{overview.industry}</span>}
              {overview.headquarters && <span className="text-xs text-slate-400">📍 {overview.headquarters}</span>}
              {intel?.grounded
                ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">● Live web data</span>
                : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">AI-estimated</span>}
            </div>
          )}
        </div>
        {score > 0 && <ScoreRing score={score} />}
      </div>

      {/* Stage tracker */}
      {pipeline.status !== 'complete' && <StageTracker status={pipeline.status} />}

      {pipeline.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 text-red-700">
          ⚠️ Pipeline failed: {pipeline.error_message ?? 'Unknown error'}
        </div>
      )}

      {/* Human-in-the-loop review checkpoint */}
      {pipeline.status === 'awaiting_input' && !continued && pipeline.gathered && (
        <ReviewPanel pipelineId={id} gathered={pipeline.gathered} onContinued={handleContinued} />
      )}

      {/* Intelligence sections */}
      {intel && pipeline.status === 'complete' && (
        <div className="space-y-4 mb-8">
          {/* Overview + Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Company Overview</p>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">{overview?.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([['Industry', overview?.industry], ['Size', overview?.size], ['Founded', overview?.founded], ['HQ', overview?.headquarters]] as [string, string | undefined][]).map(([k, v]) => v ? (
                  <div key={k} className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k}</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{v}</p>
                  </div>
                ) : null)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center gap-2">
              <ScoreRing score={score} />
              <p className="text-xs text-center text-slate-500 leading-relaxed">{intel.engagement_score?.reasoning}</p>
            </div>
          </div>

          {/* ICP match score */}
          {intel.icp_score && <ICPCard icp={intel.icp_score} />}

          {/* Tech stack signals */}
          {intel.tech_stack && <TechStackCard tech={intel.tech_stack} />}

          {/* Evidence-based pain points */}
          {(intel.pain_points ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Pain Points <span className="text-slate-400 normal-case font-normal">— evidence-anchored</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {intel.pain_points!.map((p, i) => <PainPointCard key={i} pain={p} />)}
              </div>
            </div>
          )}

          {/* BD Opportunities */}
          {(intel.bd_opportunities ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">BD Opportunities</p>
              <ul className="space-y-2">
                {(intel.bd_opportunities ?? []).map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />{o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended approach */}
          {intel.recommended_approach && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">AI Recommended Approach</p>
              <p className="text-sm text-indigo-800 leading-relaxed">{intel.recommended_approach}</p>
            </div>
          )}

          {/* People swarm + posts + jobs signals */}
          <SignalSections people={intel.people} posts={intel.posts} jobs={intel.jobs} />

          {/* Sources */}
          {(intel.sources ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Sources</p>
              <div className="space-y-2">
                {intel.sources!.map((s, i) => {
                  let hostname = s.url;
                  try { hostname = new URL(s.url).hostname; } catch { /* keep raw url */ }
                  return (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                      <span className="text-xs text-slate-400">{hostname}</span>
                      <span className="truncate">{s.title}</span>
                      <span className="text-slate-300 text-xs">↗</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {/* Competitive Intelligence */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Competitive Intelligence</p>
              {pipeline?.status === 'complete' && (
                <button
                  onClick={async () => {
                    setCompetitiveLoading(true);
                    try { setCompetitiveResult(await runCompetitiveAnalysis(id)); }
                    catch { /* silent */ }
                    finally { setCompetitiveLoading(false); }
                  }}
                  disabled={competitiveLoading}
                  className="text-sm border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 text-xs"
                >
                  {competitiveLoading && <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                  {competitiveLoading ? 'Analysing…' : '⚔️ Run Competitive Analysis'}
                </button>
              )}
            </div>
            {competitiveResult && (
              <div className="space-y-3 animate-fade-in">
                <div className={`bg-white rounded-xl border shadow-sm p-4 ${
                  competitiveResult.displacement_risk === 'high' ? 'border-red-200' :
                  competitiveResult.displacement_risk === 'medium' ? 'border-amber-200' : 'border-slate-200'
                }`}>
                  <p className="text-xs font-semibold text-slate-700 mb-1">{competitiveResult.market_position}</p>
                  <p className="text-sm text-emerald-700 font-medium">{competitiveResult.seller_wedge}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-400">Displacement risk:</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      competitiveResult.displacement_risk === 'high' ? 'bg-red-100 text-red-700' :
                      competitiveResult.displacement_risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>{competitiveResult.displacement_risk}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(competitiveResult.competitors ?? []).map((c, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <p className="font-semibold text-slate-900 text-sm mb-2">{c.name}</p>
                      <p className="text-xs text-slate-500 mb-1">{c.positioning}</p>
                      <p className="text-xs text-red-600 mb-2">Weakness: {c.weakness}</p>
                      <p className="text-xs text-indigo-700 italic">BD angle: {c.bd_angle}</p>
                    </div>
                  ))}
                </div>
                {(competitiveResult.recommended_talking_points ?? []).length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Competitive Talking Points</p>
                    <ul className="space-y-1">
                      {competitiveResult.recommended_talking_points.map((t, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-2">
                          <span className="text-indigo-400 flex-shrink-0">▸</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drift Check */}
      {pipeline?.status === 'complete' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Company Signal Monitor</p>
            <button
              onClick={async () => {
                setDriftLoading(true);
                try { setDriftResult(await runDriftCheck(id)); }
                catch { /* silent — result stays null */ }
                finally { setDriftLoading(false); }
              }}
              disabled={driftLoading}
              className="text-sm border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {driftLoading && <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
              {driftLoading ? 'Checking for changes…' : '🔄 Check for New Signals'}
            </button>
          </div>
          {driftResult && (
            <div className={`bg-white rounded-xl border shadow-sm p-5 animate-fade-in ${
              driftResult.alert_level === 'high' ? 'border-red-200' :
              driftResult.alert_level === 'medium' ? 'border-amber-200' :
              driftResult.alert_level === 'low' ? 'border-blue-200' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  driftResult.alert_level === 'high' ? 'bg-red-100 text-red-700' :
                  driftResult.alert_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                  driftResult.alert_level === 'low' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>{driftResult.alert_level === 'none' ? 'No changes' : `${driftResult.alert_level} alert`}</span>
                <span className="text-[10px] text-slate-400">checked {new Date(driftResult.checked_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700 mb-3">{driftResult.summary}</p>
              {driftResult.changes.length > 0 && (
                <div className="space-y-2">
                  {driftResult.changes.map((c, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">{c.type}</span>
                        <span className="text-xs font-semibold text-slate-800">{c.title}</span>
                      </div>
                      <p className="text-xs text-slate-600">{c.detail}</p>
                      <p className="text-xs text-emerald-700 mt-1">BD impact: {c.impact_on_bd}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prospects grid */}
      {prospects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Identified Prospects ({prospects.length})
            </p>
            {pipeline?.status === 'complete' && (
              <button
                onClick={async () => {
                  setBulkLoading(true);
                  setBulkResult(null);
                  try {
                    const r = await bulkGenerate(id, { generate_poc: true, generate_email: true, tone: 'professional', word_limit: 150 });
                    setBulkResult({ generated: r.generated, total: r.total });
                    await fetchPipeline();
                  } catch { /* silently surface via toast-less indicator */ }
                  finally { setBulkLoading(false); }
                }}
                disabled={bulkLoading}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {bulkLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {bulkLoading ? 'Generating for all…' : '⚡ Generate All POC + Emails'}
              </button>
            )}
          </div>
          {bulkResult && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800">
              ✓ Generated for {bulkResult.generated} of {bulkResult.total} prospects — click any card to view.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prospects.map(prospect => (
              <div key={prospect.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-indigo-200 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{prospect.name}</p>
                    <p className="text-sm text-slate-500">{prospect.title}</p>
                  </div>
                  <ConfidenceBadge confidence={prospect.confidence} />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {prospect.seniority && prospect.seniority !== 'Unknown' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{prospect.seniority}</span>
                  )}
                  {prospect.role_category && prospect.role_category !== 'Other' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{prospect.role_category}</span>
                  )}
                  {prospect.location && prospect.location !== 'Unknown' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">📍 {prospect.location}</span>
                  )}
                  {prospect.prospect_status && prospect.prospect_status !== 'new' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium capitalize">{prospect.prospect_status.replace('_', ' ')}</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-2">{prospect.relevance}</p>
                {prospect.contact_angle && (
                  <p className="text-xs text-indigo-600 italic mb-4">💡 {prospect.contact_angle}</p>
                )}
                {prospect.poc_plan && (
                  <p className="text-[10px] text-emerald-600 font-medium mb-2">✓ POC plan ready</p>
                )}
                <Link
                  href={`/pipeline/${id}/prospect/${prospect.id}`}
                  className="block text-center text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  📋 View POC Plan + Generate Email →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Still processing */}
      {pipeline.status !== 'complete' && pipeline.status !== 'failed' && (
        <div className="flex items-center gap-3 text-slate-500 text-sm mt-4">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          {STAGE_LABELS[pipeline.status] ?? 'Processing'}...
        </div>
      )}
    </div>
  );
}
