'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, RotateCcw, ArrowRight, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { getMorningBrief, BriefData, HotProspect, PipelineHealthItem, RecommendedAction } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const PRIORITY_BADGE: Record<string, 'danger' | 'warning' | 'muted'> = {
  high: 'danger',
  medium: 'warning',
  low: 'muted',
};

const HEALTH_VALUE_CLASS: Record<string, string> = {
  good: 'text-success',
  warning: 'text-warning',
  neutral: 'text-foreground',
};

const HEALTH_CARD_CLASS: Record<string, string> = {
  good: 'border-success/20 bg-success-subtle',
  warning: 'border-warning/30 bg-warning-subtle',
  neutral: 'border-border bg-card',
};

function LoadingBrief() {
  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-6 space-y-3">
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
        </Card>
        <Card className="p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HotProspectRow({ p, index }: { p: HotProspect; index: number }) {
  const score = p.score ?? 0;
  const r = 18, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-primary text-xs font-bold">#{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground">{p.name}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-sm">{p.company}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.reason}</p>
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
    <div className={cn('border rounded-xl px-4 py-3', HEALTH_CARD_CLASS[item.status] ?? HEALTH_CARD_CLASS.neutral)}>
      <div className={cn('text-xl font-bold', HEALTH_VALUE_CLASS[item.status] ?? HEALTH_VALUE_CLASS.neutral)}>
        {item.value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
      <div className={cn('mt-1.5 w-5 h-0.5 rounded-full',
        item.status === 'good' ? 'bg-success' : item.status === 'warning' ? 'bg-warning' : 'bg-border')} />
    </div>
  );
}

function ActionRow({ action }: { action: RecommendedAction }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Badge variant={PRIORITY_BADGE[action.priority] ?? 'muted'} size="sm" className="mt-0.5 flex-shrink-0">
        {action.priority}
      </Badge>
      <div className="flex-1">
        <p className="text-sm text-foreground">{action.action}</p>
        {action.company && (
          <p className="text-xs text-primary font-medium mt-0.5">{action.company}</p>
        )}
      </div>
    </div>
  );
}

export default function BriefPage() {
  const { user } = useAuth();
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sun className="w-6 h-6 text-warning" />
              <h1 className="text-xl font-bold text-foreground">{greeting}, {user?.full_name?.split(' ')[0] ?? 'there'}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.date ?? 'Loading your AI-generated morning brief…'}
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
            <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh Brief'}
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {error && (
          <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error} —{' '}
            <Link href="/analyze" className="font-medium underline">Run your first analysis</Link> to unlock the brief.
          </div>
        )}

        {loading ? (
          <LoadingBrief />
        ) : data ? (
          <div className="space-y-5 animate-fade-in">
            {/* Executive summary */}
            <div className="bg-gradient-to-br from-primary/5 to-violet-500/5 border border-primary/10 rounded-2xl px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">Executive Summary</p>
              <p className="text-foreground leading-relaxed">{data.executive_summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Hot prospects */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Hot Prospects</p>
                    <CardTitle className="text-sm">Follow up today</CardTitle>
                  </div>
                  <span className="text-2xl">🔥</span>
                </CardHeader>
                <div className="px-6">
                  {data.hot_prospects.length > 0 ? (
                    data.hot_prospects.map((p, i) => (
                      <HotProspectRow key={i} p={p} index={i} />
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground text-sm">No hot prospects yet</p>
                      <Link href="/analyze" className="text-xs text-primary font-medium mt-1 block">
                        Analyse more companies →
                      </Link>
                      <Link href="/analyze">
                        <Button size="sm" className="mt-3">Start New Analysis →</Button>
                      </Link>
                    </div>
                  )}
                </div>
              </Card>

              {/* Pipeline health */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Pipeline Health</p>
                    <CardTitle className="text-sm">Key metrics snapshot</CardTitle>
                  </div>
                  <TrendingUp className="w-5 h-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {data.pipeline_health.map((h, i) => (
                      <HealthCard key={i} item={h} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recommended actions */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Recommended Actions</p>
                    <CardTitle className="text-sm">Prioritised for today</CardTitle>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </CardHeader>
                <div className="px-6">
                  {data.recommended_actions.map((a, i) => (
                    <ActionRow key={i} action={a} />
                  ))}
                </div>
              </Card>

              {/* LinkedIn tip */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">LinkedIn Tip of the Day</p>
                    <CardTitle className="text-sm">Content strategy insight</CardTitle>
                  </div>
                  <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-cyan-500/5 to-teal-500/5 border border-cyan-500/20 rounded-xl p-4 mb-4">
                    <p className="text-sm text-foreground leading-relaxed">{data.linkedin_tip}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                    <Link href="/linkedin">
                      Open LinkedIn Hub
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>

                {/* Quick links */}
                <div className="px-6 pb-5 border-t border-border pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Quick Links</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/analyze', label: '+ New Analysis' },
                      { href: '/contacts', label: 'View Contacts' },
                      { href: '/outreach', label: 'Outreach Tracker' },
                      { href: '/playbook', label: 'BD Playbook' },
                    ].map(l => (
                      <Button key={l.href} variant="outline" size="sm" asChild>
                        <Link href={l.href}>{l.label}</Link>
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="text-xs text-muted-foreground text-center pb-2">
              Brief generated at {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · AI-synthesised from your pipeline data
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
