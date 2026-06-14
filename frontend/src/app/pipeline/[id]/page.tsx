'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPipeline, Pipeline, PipelineProspect, PainPoint, ICPScore, TechStack } from '@/lib/api';

const PIPELINE_STAGES = ['scraping', 'linkedin', 'keywords', 'researching', 'insights', 'embedding'] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: 'Starting...', scraping: 'Scraping Website', linkedin: 'LinkedIn Intelligence',
  keywords: 'Extracting Keywords', researching: 'Web Research',
  insights: 'Generating Insights', embedding: 'Building Vector Index', complete: 'Complete',
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

export default function PipelinePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    try {
      const p = await getPipeline(id);
      setPipeline(p);
      if (p.status === 'complete' || p.status === 'failed') setLoading(false);
    } catch {
      router.push('/');
    }
  }, [id, router]);

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(() => {
      if (pipeline?.status !== 'complete' && pipeline?.status !== 'failed') {
        fetchPipeline();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchPipeline, pipeline?.status]);

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
