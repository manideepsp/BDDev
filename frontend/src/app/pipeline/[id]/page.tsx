'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPipeline, continuePipeline, Pipeline, PipelineProspect, PainPoint, ICPScore, TechStack,
  EnrichedPerson, GatheredPost, GatheredJob } from '@/lib/api';

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

function GatheredSummary({ gathered }: { gathered: NonNullable<Pipeline['gathered']> }) {
  const websitePages = gathered.website?.pages ?? [];
  const linkedinFields = gathered.linkedin?.company_fields ?? {};
  const linkedinInfo = gathered.linkedin?.company_info;
  const keywords = gathered.keywords?.keywords ?? [];
  const productAreas = gathered.keywords?.product_areas ?? [];
  const researchResults = gathered.research?.results ?? [];
  const ragChunks = gathered.rag_chunks ?? 0;

  const fieldEntries = Object.entries(linkedinFields).filter(([, v]) => v);

  return (
    <div className="space-y-3">
      {/* Website */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          🌐 Website <span className="text-slate-400 normal-case font-normal">
            {websitePages.length > 0 ? `— ${websitePages.length} page(s) scraped` : '— not scraped'}
            {gathered.website?.error ? ` (${gathered.website.error})` : ''}
          </span>
        </p>
        {websitePages.length > 0 ? (
          <div className="space-y-1">
            {websitePages.map((pg, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">page</span>
                <span className="text-xs text-slate-600 truncate">{pg.title || pg.url}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No pages scraped — synthesis will rely on other sources.</p>
        )}
      </div>

      {/* LinkedIn company fields */}
      {(fieldEntries.length > 0 || linkedinInfo) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            💼 LinkedIn Company Profile
            {gathered.linkedin?.error && <span className="text-amber-500 normal-case font-normal ml-1">(partial)</span>}
          </p>
          {fieldEntries.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
              {fieldEntries.map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k}</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{String(v)}</p>
                </div>
              ))}
            </div>
          )}
          {linkedinInfo && (
            <p className="text-xs text-slate-600 line-clamp-3">{linkedinInfo.slice(0, 300)}{linkedinInfo.length > 300 ? '…' : ''}</p>
          )}
        </div>
      )}

      {/* Keywords */}
      {(keywords.length > 0 || productAreas.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">🔑 Extracted Keywords</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {keywords.map((kw, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{kw}</span>
            ))}
          </div>
          {productAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {productAreas.map((pa, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{pa}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Web research results */}
      {researchResults.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            🔍 Web Research <span className="text-slate-400 normal-case font-normal">— {researchResults.length} results</span>
          </p>
          <div className="space-y-1">
            {researchResults.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">{r.angle}</span>
                <span className="text-xs text-slate-600 truncate">{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG index summary */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-xs text-indigo-700">
          <span className="font-semibold">{ragChunks} chunks indexed</span> into the vector database — synthesis will retrieve the most relevant evidence via RAG queries.
        </p>
      </div>
    </div>
  );
}

function ReviewPanel({ pipelineId, gathered, onContinued }: {
  pipelineId: string;
  gathered: NonNullable<Pipeline['gathered']>;
  onContinued: () => void;
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const people = gathered.people?.people ?? [];
  const posts = gathered.posts?.posts ?? [];
  const jobs = gathered.jobs?.jobs ?? [];

  function toggle(name: string) {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function handleContinue() {
    setSubmitting(true);
    setError('');
    try {
      await continuePipeline(pipelineId, {
        human_input: note.trim() || undefined,
        removed_people: Array.from(removed),
      });
      onContinued();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue — please try again');
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-8">
      {/* Header banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-amber-800">✋ Human checkpoint — review before synthesis</p>
        <p className="text-xs text-amber-700 mt-1">
          The swarm gathered and indexed everything below. Review what was found, remove irrelevant people,
          and optionally add context that will be injected with high priority into the RAG synthesis.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            ['🌐 + 💼', 'Website & LinkedIn', 'What the agents found about the company'],
            ['🐝 + 📣 + 💼', 'People, Posts & Jobs', 'Remove noise; keep relevant contacts'],
            ['✏️ Your context', 'Optional but impactful', 'Correct facts, add relationships, focus areas'],
          ].map(([icon, label, desc]) => (
            <div key={label} className="bg-white rounded-lg p-2.5 border border-amber-100">
              <p className="text-[10px] font-medium text-amber-700">{icon} {label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What was gathered */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">What the agents gathered</p>
        <GatheredSummary gathered={gathered} />
      </div>

      {/* People / posts / jobs (editable) */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Signals — review &amp; prune</p>
        <SignalSections people={people} posts={posts} jobs={jobs} removed={removed} onToggle={toggle} />
      </div>

      {/* Human context input + continue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Add context for synthesis <span className="text-slate-400 normal-case font-normal">(optional — highest priority in synthesis)</span>
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. 'We already spoke to their VP Eng — focus on the data platform gap', or correct anything the agents got wrong..."
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            ⚠️ {error}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3">
          <button onClick={handleContinue} disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
            {submitting ? '⏳ Starting synthesis...' : '🧠 Continue to Insights →'}
          </button>
          {removed.size > 0 && <span className="text-xs text-slate-500">{removed.size} person(s) excluded</span>}
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
        </div>
      )}

      {/* Prospects grid */}
      {prospects.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Identified Prospects ({prospects.length})
          </p>
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
                <p className="text-xs text-slate-600 mb-2">{prospect.relevance}</p>
                {prospect.contact_angle && (
                  <p className="text-xs text-indigo-600 italic mb-4">💡 {prospect.contact_angle}</p>
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
