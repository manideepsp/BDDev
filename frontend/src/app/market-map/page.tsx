'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPipelines, Pipeline } from '@/lib/api';

interface PlottedCompany {
  id: string;
  name: string;
  industry: string;
  icp_score: number;
  engagement_score: number;
  status: string;
  prospect_count: number;
}

const ALERT_COLORS: Record<string, string> = {
  high: 'bg-emerald-500', medium: 'bg-amber-400', low: 'bg-red-400', none: 'bg-slate-300',
};

function ScoreCell({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

export default function MarketMapPage() {
  const [companies, setCompanies] = useState<PlottedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'icp_score' | 'engagement_score' | 'name'>('icp_score');
  const [filterIndustry, setFilterIndustry] = useState('');

  useEffect(() => {
    listPipelines()
      .then((pipelines: Pipeline[]) => {
        const mapped: PlottedCompany[] = pipelines
          .filter(p => p.status === 'complete' && p.intelligence)
          .map(p => {
            const intel = p.intelligence!;
            const icp = (intel.icp_score as { overall?: number } | undefined)?.overall ?? 0;
            const eng = (intel.engagement_score as { score?: number } | undefined)?.score ?? 0;
            const prospects = (p.prospects ?? []).length;
            return {
              id: p.id,
              name: p.company_name,
              industry: (intel.company_overview as { industry?: string } | undefined)?.industry ?? 'Unknown',
              icp_score: typeof icp === 'number' ? icp : parseInt(String(icp)) || 0,
              engagement_score: typeof eng === 'number' ? eng : parseInt(String(eng)) || 0,
              status: p.status,
              prospect_count: prospects,
            };
          });
        setCompanies(mapped);
      })
      .finally(() => setLoading(false));
  }, []);

  const industries = Array.from(new Set(companies.map(c => c.industry))).filter(Boolean).sort();

  const sorted = [...companies]
    .filter(c => !filterIndustry || c.industry === filterIndustry)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b[sortBy] - a[sortBy];
    });

  const avgICP = companies.length ? Math.round(companies.reduce((s, c) => s + c.icp_score, 0) / companies.length) : 0;
  const highPri = companies.filter(c => c.icp_score >= 70).length;
  const topProspects = companies.reduce((s, c) => s + c.prospect_count, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Market Map</h1>
            <p className="text-sm text-slate-500 mt-0.5">Your portfolio of researched companies — ranked by ICP fit and engagement potential</p>
          </div>
          <Link href="/analyze" className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
            + New Analysis
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center animate-fade-in">
            <div className="text-4xl mb-4">🗺️</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No companies mapped yet</h2>
            <p className="text-slate-500 text-sm mb-6">Run your first analysis to populate the market map.</p>
            <Link href="/analyze" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors text-sm">
              Start Analysis →
            </Link>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
              {[
                { label: 'Companies Mapped', value: companies.length, icon: '🏢' },
                { label: 'Avg ICP Score', value: `${avgICP}/100`, icon: '🎯' },
                { label: 'High Priority', value: highPri, icon: '🔥' },
                { label: 'Total Prospects', value: topProspects, icon: '👤' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Filters + sort */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select
                value={filterIndustry}
                onChange={e => setFilterIndustry(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
              >
                <option value="">All industries</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['icp_score', 'engagement_score', 'name'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`text-xs px-3 py-2 font-medium transition-colors ${sortBy === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {s === 'icp_score' ? 'ICP Score' : s === 'engagement_score' ? 'Engagement' : 'Name'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 ml-auto">{sorted.length} companies</p>
            </div>

            {/* Company table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Company</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Industry</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 w-36">ICP Fit</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 w-36 hidden md:table-cell">Engagement</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Prospects</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sorted.map((c, i) => (
                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors animate-fade-in anim-delay-${Math.min(i + 1, 4) as 1 | 2 | 3 | 4}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.icp_score >= 70 ? 'bg-emerald-500' : c.icp_score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} />
                          <span className="font-semibold text-slate-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">{c.industry}</td>
                      <td className="px-4 py-3.5">
                        <ScoreCell score={c.icp_score} />
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <ScoreCell score={c.engagement_score} />
                      </td>
                      <td className="px-4 py-3.5 text-center hidden md:table-cell">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{c.prospect_count}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/pipeline/${c.id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* White-space suggestion */}
            {highPri < 3 && companies.length >= 5 && (
              <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5 animate-fade-in">
                <p className="text-sm font-semibold text-indigo-900 mb-1">White-space opportunity</p>
                <p className="text-sm text-indigo-700">
                  Only {highPri} of {companies.length} companies score ≥70 ICP fit. Consider analysing companies
                  in the same industries as your top performers — there may be better-fit targets in the same verticals.
                </p>
                <Link href="/analyze" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                  Find more targets →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
