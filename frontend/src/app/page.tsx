'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listProspects, Prospect } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  researched: 'bg-blue-100 text-blue-700',
  outreach_ready: 'bg-indigo-100 text-indigo-700',
  contacted: 'bg-amber-100 text-amber-700',
  responded: 'bg-green-100 text-green-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  researched: 'Researched',
  outreach_ready: 'Outreach Ready',
  contacted: 'Contacted',
  responded: 'Responded',
  qualified: 'Qualified',
  closed: 'Closed',
};

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-emerald-700 bg-emerald-50'
      : score >= 60
      ? 'text-amber-700 bg-amber-50'
      : 'text-red-600 bg-red-50';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${color}`}>
      {score}
    </span>
  );
}

export default function Dashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProspects()
      .then(setProspects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = prospects.length;
  const activeOutreach = prospects.filter((p) =>
    ['outreach_ready', 'contacted', 'responded'].includes(p.status)
  ).length;
  const qualified = prospects.filter((p) => p.status === 'qualified').length;
  const avgScore =
    total > 0
      ? Math.round(
          prospects.reduce(
            (s, p) => s + (p.research?.engagement_score?.score ?? 0),
            0
          ) / total
        )
      : null;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            AI-powered BD intelligence &amp; outreach
          </p>
        </div>
        <Link
          href="/research"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Research
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Prospects',
            value: total,
            icon: '📋',
            color: 'text-slate-900',
          },
          {
            label: 'Active Outreach',
            value: activeOutreach,
            icon: '📨',
            color: 'text-indigo-600',
          },
          {
            label: 'Qualified Leads',
            value: qualified,
            icon: '✅',
            color: 'text-emerald-600',
          },
          {
            label: 'Avg BD Score',
            value: avgScore ?? '—',
            icon: '📊',
            color:
              avgScore && avgScore >= 70
                ? 'text-emerald-600'
                : 'text-slate-900',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-sm mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Prospect Pipeline</h2>
          <span className="text-slate-400 text-sm">{total} companies</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading...</span>
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-slate-700 font-medium">No prospects yet</div>
              <div className="text-slate-400 text-sm mt-1">
                Research a company to generate your first intelligence report
              </div>
            </div>
            <Link
              href="/research"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Start Your First Research →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    BD Score
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{p.company_name}</div>
                      {p.company_url && (
                        <div className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">
                          {p.company_url}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {p.research?.company_overview?.industry ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      {p.research?.engagement_score ? (
                        <ScorePill score={p.research.engagement_score.score} />
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(p.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/prospects/${p.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
