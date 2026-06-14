'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPipelines, getStats, Pipeline, Stats } from '@/lib/api';

// ── Status display maps ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:       'bg-slate-100 text-slate-500',
  gathering:     'bg-sky-100 text-sky-700',
  people:        'bg-indigo-100 text-indigo-700',
  keywords:      'bg-purple-100 text-purple-700',
  researching:   'bg-amber-100 text-amber-700',
  indexing:      'bg-violet-100 text-violet-700',
  awaiting_input:'bg-amber-100 text-amber-800 font-semibold',
  insights:      'bg-orange-100 text-orange-700',
  embedding:     'bg-violet-100 text-violet-700',
  complete:      'bg-emerald-100 text-emerald-700',
  failed:        'bg-red-100 text-red-700',
  scraping:      'bg-sky-100 text-sky-700',
  linkedin:      'bg-indigo-100 text-indigo-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending:       'Pending',
  gathering:     'Gathering',
  people:        'People Swarm',
  keywords:      'Keywords',
  researching:   'Researching',
  indexing:      'Indexing',
  awaiting_input:'Needs Review ✋',
  insights:      'Synthesising',
  embedding:     'Embedding',
  complete:      'Complete',
  failed:        'Failed',
  scraping:      'Scraping',
  linkedin:      'LinkedIn',
};

const ACTIVE_STATUSES = new Set([
  'pending', 'gathering', 'people', 'keywords', 'researching', 'indexing', 'insights', 'embedding',
]);

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent, delay, pulse,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  accent: string; delay: string; pulse?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-slide-up ${delay} relative overflow-hidden`}>
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent.replace('bg-gradient-to-r', 'bg').split(' ')[0]}/10`}>
          {icon}
        </div>
        {pulse && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-live-pulse" />
            live
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
      <div className="text-slate-500 text-xs mt-0.5 font-medium">{label}</div>
    </div>
  );
}

// ── Mini engagement ring for table ──────────────────────────────────────────

function MiniRing({ score }: { score: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="14" cy="14" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${fill} ${c - fill}`} strokeDashoffset={c / 4} strokeLinecap="round" />
        <text x="14" y="14" textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listPipelines(), getStats()])
      .then(([pipes, s]) => { setPipelines(pipes); setStats(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activePipelines = stats?.active_pipelines ?? 0;
  const avgScore = stats?.avg_engagement_score ?? 0;

  const STATS = [
    {
      label: 'Total Analyses',
      value: stats?.total_pipelines ?? '—',
      accent: 'bg-gradient-to-r from-slate-400 to-slate-500',
      delay: '',
      icon: (
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Active Pipelines',
      value: activePipelines,
      accent: 'bg-gradient-to-r from-indigo-400 to-violet-500',
      delay: 'anim-delay-1',
      pulse: activePipelines > 0,
      icon: (
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      value: stats?.completed_pipelines ?? '—',
      accent: 'bg-gradient-to-r from-emerald-400 to-teal-500',
      delay: 'anim-delay-2',
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Avg BD Score',
      value: avgScore > 0 ? avgScore : '—',
      accent: avgScore >= 70
        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
        : 'bg-gradient-to-r from-slate-300 to-slate-400',
      delay: 'anim-delay-3',
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Your BD intelligence command centre
            {activePipelines > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-indigo-600 font-medium">
                · <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-live-pulse inline-block" />
                {activePipelines} running
              </span>
            )}
          </p>
        </div>
        <Link href="/analyze"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Analysis
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Prospects identified — secondary stat */}
      {(stats?.total_prospects_identified ?? 0) > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3.5 flex items-center gap-3 animate-slide-up anim-delay-4">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
          <span className="text-sm text-indigo-800">
            <span className="font-bold">{stats!.total_prospects_identified}</span> prospects identified across all analyses
          </span>
          <Link href="/trends" className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
            View market trends →
          </Link>
        </div>
      )}

      {/* Pipeline table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Analysis Pipeline</h2>
          <span className="text-slate-400 text-sm">{pipelines.length} {pipelines.length === 1 ? 'company' : 'companies'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            Loading pipelines...
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-700 font-semibold">No analyses yet</p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs">
                Enter a company name and your offering — a multi-agent swarm handles the rest in ~30 seconds.
              </p>
            </div>
            <Link href="/analyze"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
              Start your first analysis →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Prospects</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pipelines.map((p) => {
                  const isActive = ACTIVE_STATUSES.has(p.status);
                  const score = p.intelligence?.engagement_score?.score ?? 0;
                  const prospectCount = p.prospects?.length ?? p.intelligence?.prospects?.length;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-live-pulse flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{p.company_name}</div>
                            {p.company_url && (
                              <div className="text-slate-400 text-xs mt-0.5 truncate max-w-[180px]">
                                {p.company_url.replace(/^https?:\/\//, '')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-500'
                        }`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 hidden md:table-cell">
                        {score > 0 ? <MiniRing score={score} /> : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-slate-600 text-sm font-medium">
                          {prospectCount != null ? prospectCount : '—'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-slate-400 text-sm">
                          {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link href={`/pipeline/${p.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
