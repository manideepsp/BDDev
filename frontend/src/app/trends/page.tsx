'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMarketTrends, listPipelines, TrendsResponse, TrendsCluster, Pipeline } from '@/lib/api';

const SECTOR_ICONS: Record<string, string> = {
  fintech: '💳', finance: '💳', banking: '🏦',
  saas: '☁️', software: '☁️', cloud: '☁️', platform: '☁️',
  ai: '🤖', 'machine learning': '🤖', 'artificial intelligence': '🤖',
  ecommerce: '🛍️', retail: '🛒', marketplace: '🏪',
  health: '🏥', healthcare: '🏥', medtech: '💊',
  security: '🔐', cybersecurity: '🔐',
  logistics: '🚚', supply: '🚚', shipping: '📦',
  hr: '👥', talent: '👥', recruiting: '👥',
  education: '🎓', edtech: '🎓',
  media: '📺', content: '📺',
  real: '🏠', property: '🏠',
  energy: '⚡', climate: '🌱', sustainability: '🌱',
  developer: '🛠️', devtools: '🛠️', infrastructure: '🛠️',
};

function getSectorIcon(theme: string): string {
  const lower = theme.toLowerCase();
  for (const [key, icon] of Object.entries(SECTOR_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📊';
}

function ClusterCard({ cluster, index, pipelineMap }: { cluster: TrendsCluster; index: number; pipelineMap: Record<string, string> }) {
  const icon = getSectorIcon(cluster.theme);
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up anim-delay-${Math.min(index + 1, 4) as 1|2|3|4}`}>
      {/* Card header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base leading-snug">{cluster.theme}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cluster.companies.map(c => {
              const pid = pipelineMap[c.toLowerCase()];
              return pid ? (
                <Link key={c} href={`/pipeline/${pid}`} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium hover:bg-indigo-100 transition-colors border border-indigo-100">
                  {c} →
                </Link>
              ) : (
                <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">{c}</span>
              );
            })}
          </div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 flex-shrink-0">
          {cluster.companies.length} {cluster.companies.length === 1 ? 'company' : 'companies'}
        </span>
      </div>

      {/* Market insight */}
      <div className="px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Market Signal</p>
        <p className="text-sm text-slate-700 leading-relaxed">{cluster.insight}</p>
      </div>

      {/* BD opportunity */}
      {cluster.opportunity && (
        <div className="mx-6 mb-5 bg-emerald-50 border border-emerald-100 rounded-lg p-4">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">BD Opportunity</p>
              <p className="text-sm text-emerald-800 leading-relaxed">{cluster.opportunity}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action footer */}
      <div className="px-6 pb-5 flex items-center gap-3">
        <Link
          href="/analyze"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-all"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Analyse a company in this cluster
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 bg-slate-100 rounded" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pipelineMap, setPipelineMap] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([getMarketTrends(), listPipelines()])
      .then(([trends, pipelines]) => {
        setData(trends);
        const map: Record<string, string> = {};
        for (const p of pipelines as Pipeline[]) {
          if (p.status === 'complete') map[p.company_name.toLowerCase()] = p.id;
        }
        setPipelineMap(map);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Market Intelligence</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              AI-clustered insights across every company you&apos;ve researched — powered by Qdrant vector similarity
            </p>
          </div>
          {!loading && !error && data && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-center">
                <p className="text-lg font-bold text-indigo-700 tabular-nums">{data.total_companies_analyzed}</p>
                <p className="text-[10px] text-indigo-500 font-medium uppercase tracking-wide">companies</p>
              </div>
              {data.clusters.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 text-center">
                  <p className="text-lg font-bold text-emerald-700 tabular-nums">{data.clusters.length}</p>
                  <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">clusters</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 animate-fade-in">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Empty state */}
            {(!data.clusters || data.clusters.length === 0) ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center animate-scale-in">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-5 text-3xl">
                  📊
                </div>
                <h3 className="text-slate-800 font-semibold text-lg mb-2">Building your intelligence base</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-2">
                  {data.overall_summary || 'Analyse at least 3 companies to unlock AI-clustered market trends and cross-portfolio BD opportunities.'}
                </p>
                <p className="text-slate-400 text-xs mb-8">
                  {data.total_companies_analyzed} of 3 companies needed
                </p>
                {/* Progress bar */}
                <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-1.5 mb-8">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (data.total_companies_analyzed / 3) * 100)}%` }}
                  />
                </div>
                <Link
                  href="/analyze"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-900/20"
                >
                  Start Analysis →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall summary callout */}
                {data.overall_summary && (
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-6 animate-fade-in">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Portfolio Overview</p>
                        <p className="text-sm text-indigo-900 leading-relaxed">{data.overall_summary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section label */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Trend Clusters — {data.clusters.length} identified
                  </p>
                  <Link
                    href="/analyze"
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    Add company
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </Link>
                </div>

                {/* Cluster cards */}
                <div className="space-y-4">
                  {data.clusters.map((cluster, i) => (
                    <ClusterCard key={i} cluster={cluster} index={i} pipelineMap={pipelineMap} />
                  ))}
                </div>

                {/* Footer CTA */}
                <div className="bg-slate-800 rounded-xl p-6 text-center">
                  <p className="text-slate-300 text-sm mb-1 font-medium">Keep building your intelligence base</p>
                  <p className="text-slate-500 text-xs mb-4">Every new pipeline refines the clusters and sharpens cross-portfolio opportunities.</p>
                  <Link
                    href="/analyze"
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Analyse another company
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
