'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPipeline, Pipeline, PipelineProspect } from '@/lib/api';

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

          {/* Pain points + Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Pain Points</p>
              <ul className="space-y-2">
                {(intel.pain_points ?? []).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />{p}
                  </li>
                ))}
              </ul>
            </div>
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
          </div>

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
