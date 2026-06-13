'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMarketTrends, TrendsResponse } from '@/lib/api';

export default function TrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMarketTrends()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-slate-500">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading market trends...
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">⚠️ {error}</div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Market Trends</h1>
          <p className="text-slate-500 text-sm mt-1">
            Cumulative insights from {data?.total_companies_analyzed ?? 0} companies analyzed
          </p>
        </div>
        <span className="text-sm bg-indigo-100 text-indigo-700 font-medium px-3 py-1.5 rounded-full">
          {data?.total_companies_analyzed ?? 0} companies
        </span>
      </div>

      {(!data?.clusters || data.clusters.length === 0) ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-slate-700 font-medium mb-2">Not enough data yet</p>
          <p className="text-slate-500 text-sm mb-6">{data?.overall_summary}</p>
          <Link
            href="/analyze"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Start Analysis →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {data.overall_summary && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Overall Summary</p>
              <p className="text-sm text-indigo-800 leading-relaxed">{data.overall_summary}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {data.clusters.map((cluster, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-lg">{cluster.theme}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.companies.map(c => (
                      <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed mb-4">{cluster.insight}</p>
                {cluster.opportunity && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Opportunity</p>
                    <p className="text-sm text-emerald-800">{cluster.opportunity}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
