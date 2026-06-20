'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlaybook, PlaybookData, BattleCard } from '@/lib/api';

const INDUSTRY_ICONS: Record<string, string> = {
  fintech: '💳', finance: '💳', banking: '🏦',
  saas: '☁️', software: '☁️', cloud: '☁️',
  ai: '🤖', 'machine learning': '🤖',
  ecommerce: '🛍️', retail: '🛒',
  health: '🏥', healthcare: '🏥', medtech: '💊',
  security: '🔐', cybersecurity: '🔐',
  logistics: '🚚', supply: '📦',
  hr: '👥', talent: '👥',
  education: '🎓', edtech: '🎓',
  energy: '⚡', climate: '🌱',
  developer: '🛠️', devtools: '🛠️',
  media: '📺', content: '📺',
  real: '🏠', property: '🏠',
};

function getIcon(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [key, icon] of Object.entries(INDUSTRY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '🏢';
}

function Skeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="px-6 py-5 border-b border-slate-100 flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-100 rounded w-40" />
          <div className="flex gap-1.5">
            {[60, 80, 50].map(w => (
              <div key={w} className={`h-5 bg-slate-100 rounded-full`} style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-4 bg-slate-100 rounded w-full" />)}
      </div>
    </div>
  );
}

function ObjectionAccordion({ objections }: { objections: BattleCard['objections'] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-1.5">
      {objections.map((obj, i) => (
        <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
            <span className="text-sm font-medium text-slate-800">{obj.objection}</span>
            <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${open === i ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <div className="px-4 pb-3 border-t border-slate-100">
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">{obj.response}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BattleCardView({ card, index }: { card: BattleCard; index: number }) {
  const [tab, setTab] = useState<'objections' | 'tracks'>('objections');
  const icon = getIcon(card.industry);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-2xl">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">{card.industry}</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                Card #{index + 1}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.companies.map(c => (
                <span key={c} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium border border-indigo-100">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Winning angle */}
        <div className="mt-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Winning Pitch Angle</p>
          <p className="text-sm font-medium text-indigo-900">{card.winning_angle}</p>
        </div>
      </div>

      <div className="px-6 py-4">
        {/* Pain points */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Key Pain Points</p>
          <div className="space-y-1.5">
            {card.key_pain_points.map((pp, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 leading-relaxed">{pp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4">
          <button onClick={() => setTab('objections')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'objections' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Objection Handles
          </button>
          <button onClick={() => setTab('tracks')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'tracks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Talk Tracks
          </button>
        </div>

        {tab === 'objections' ? (
          <ObjectionAccordion objections={card.objections} />
        ) : (
          <div className="space-y-3">
            {card.talk_tracks.map((track, i) => (
              <div key={i} className="border border-slate-200 rounded-lg px-4 py-3">
                <p className="text-sm text-slate-700 leading-relaxed">{track}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlaybookPage() {
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const result = await getPlaybook();
      setData(result);
      setError('');
    } catch (e) {
      setError((e as Error).message || 'Failed to load playbook');
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const cards = data?.battle_cards ?? [];
  const isEmpty = !loading && (cards.length === 0 || data?.message);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">BD Playbook</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              AI-generated battle cards — objection handles + talk tracks per industry
            </p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing || loading}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Generating…' : 'Refresh'}
          </button>
        </div>

        {data && !isEmpty && (
          <div className="flex items-center gap-6 mt-4 text-sm text-slate-500">
            <span><strong className="text-slate-900">{cards.length}</strong> industry cards</span>
            <span><strong className="text-slate-900">{data.total_companies}</strong> companies analysed</span>
            <span>Generated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-slate-700 font-semibold text-lg mb-2">No battle cards yet</div>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              {data?.message || 'Complete at least one company analysis to generate your first battle card.'}
            </p>
            <Link href="/analyze"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors inline-block">
              Start Analysis
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {cards.map((card, i) => (
              <BattleCardView key={i} card={card} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
