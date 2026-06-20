'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMorningBrief, BriefData, HotProspect, PipelineHealthItem, RecommendedAction } from '@/lib/api';

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-slate-100 text-slate-600 border-slate-200',
};

const HEALTH_STYLES: Record<string, string> = {
  good:    'text-emerald-600',
  warning: 'text-amber-600',
  neutral: 'text-slate-700',
};

const HEALTH_BG: Record<string, string> = {
  good:    'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  neutral: 'border-slate-200 bg-white',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

function LoadingBrief() {
  return (
    <div className="space-y-5">
      {/* Summary skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HotProspectCard({ p, index }: { p: HotProspect; index: number }) {
  const score = p.score ?? 0;
  const r = 18, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-700 text-xs font-bold">#{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-900">{p.name}</span>
          <span className="text-slate-400 text-xs">·</span>
          <span className="text-slate-600 text-sm">{p.company}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{p.reason}</p>
      </div>
      <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 22 22)" />
        <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{score}</text>
      </svg>
    </div>
  );
}

function HealthCard({ item }: { item: PipelineHealthItem }) {
  return (
    <div className={`border rounded-xl px-4 py-3 ${HEALTH_BG[item.status] ?? HEALTH_BG.neutral}`}>
      <div className={`text-xl font-bold ${HEALTH_STYLES[item.status] ?? HEALTH_STYLES.neutral}`}>
        {item.value}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
      <div className={`mt-1.5 w-5 h-0.5 rounded-full ${item.status === 'good' ? 'bg-emerald-400' : item.status === 'warning' ? 'bg-amber-400' : 'bg-slate-300'}`} />
    </div>
  );
}

function ActionRow({ action, index }: { action: RecommendedAction; index: number }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.low}`}>
          {action.priority}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-800">{action.action}</p>
        {action.company && (
          <p className="text-xs text-indigo-600 font-medium mt-0.5">{action.company}</p>
        )}
      </div>
    </div>
  );
}

export default function BriefPage() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const result = await getMorningBrief();
      setData(result);
      setError('');
    } catch (e) {
      setError((e as Error).message || 'Failed to generate brief');
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setLoading(true);
    await load();
    setLoading(false);
    setRefreshing(false);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">☀️</span>
              <h1 className="text-xl font-bold text-slate-900">
                {greeting}, Manideep
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {data?.date ?? 'Loading your AI-generated morning brief…'}
            </p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing || loading}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh Brief'}
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            {error} —{' '}
            <Link href="/analyze" className="font-medium underline">Run your first analysis</Link> to unlock the brief.
          </div>
        )}

        {loading ? (
          <LoadingBrief />
        ) : data ? (
          <div className="space-y-5">
            {/* Executive summary */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Executive Summary</p>
              <p className="text-slate-800 leading-relaxed">{data.executive_summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Hot prospects */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Hot Prospects</p>
                    <p className="text-sm text-slate-700 font-medium">Follow up today</p>
                  </div>
                  <span className="text-2xl">🔥</span>
                </div>
                <div className="px-6">
                  {data.hot_prospects.length > 0 ? (
                    data.hot_prospects.map((p, i) => (
                      <HotProspectCard key={i} p={p} index={i} />
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-slate-400 text-sm">No hot prospects yet</p>
                      <Link href="/analyze" className="text-xs text-indigo-600 font-medium mt-1 block">
                        Analyse more companies →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline health */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Pipeline Health</p>
                    <p className="text-sm text-slate-700 font-medium">Key metrics snapshot</p>
                  </div>
                  <span className="text-2xl">📊</span>
                </div>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    {data.pipeline_health.map((h, i) => (
                      <HealthCard key={i} item={h} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recommended actions */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Recommended Actions</p>
                    <p className="text-sm text-slate-700 font-medium">Prioritised for today</p>
                  </div>
                  <span className="text-2xl">✅</span>
                </div>
                <div className="px-6">
                  {data.recommended_actions.map((a, i) => (
                    <ActionRow key={i} action={a} index={i} />
                  ))}
                </div>
              </div>

              {/* LinkedIn tip */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">LinkedIn Tip of the Day</p>
                    <p className="text-sm text-slate-700 font-medium">Content strategy insight</p>
                  </div>
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <div className="px-6 py-5">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <p className="text-sm text-indigo-900 leading-relaxed">{data.linkedin_tip}</p>
                  </div>
                  <Link href="/linkedin"
                    className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                    Open LinkedIn Hub
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>

                {/* Quick links */}
                <div className="px-6 pb-5 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">Quick Links</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/analyze', label: '+ New Analysis' },
                      { href: '/contacts', label: 'View Contacts' },
                      { href: '/outreach', label: 'Outreach Tracker' },
                      { href: '/playbook', label: 'BD Playbook' },
                    ].map(l => (
                      <Link key={l.href} href={l.href}
                        className="text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors text-center">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 text-center pb-2">
              Brief generated at {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · AI-synthesised from your pipeline data
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
