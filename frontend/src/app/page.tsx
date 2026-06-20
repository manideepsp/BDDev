'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Zap,
  CheckCircle2,
  TrendingUp,
  Plus,
  Users,
  ArrowRight,
  Search,
  ExternalLink,
} from 'lucide-react';
import { listPipelines, getStats, Pipeline, Stats } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Status display maps ──────────────────────────────────────────────────────

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'
  | 'complete'
  | 'active'
  | 'failed'
  | 'pending';

const STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  pending:        'pending',
  gathering:      'active',
  people:         'active',
  keywords:       'active',
  researching:    'active',
  indexing:       'active',
  awaiting_input: 'warning',
  insights:       'active',
  embedding:      'active',
  complete:       'complete',
  failed:         'failed',
  scraping:       'active',
  linkedin:       'active',
};

const STATUS_LABELS: Record<string, string> = {
  pending:        'Pending',
  gathering:      'Gathering',
  people:         'People Swarm',
  keywords:       'Keywords',
  researching:    'Researching',
  indexing:       'Indexing',
  awaiting_input: 'Needs Review',
  insights:       'Synthesising',
  embedding:      'Embedding',
  complete:       'Complete',
  failed:         'Failed',
  scraping:       'Scraping',
  linkedin:       'LinkedIn',
};

const ACTIVE_STATUSES = new Set([
  'pending', 'gathering', 'people', 'keywords',
  'researching', 'indexing', 'insights', 'embedding',
]);

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accentClass,
  iconBgClass,
  delay,
  pulse,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accentClass: string;
  iconBgClass: string;
  delay?: string;
  pulse?: boolean;
}) {
  return (
    <Card className={cn('relative overflow-hidden animate-slide-up', delay)}>
      <div className={cn('absolute inset-x-0 top-0 h-1 rounded-t-2xl', accentClass)} />
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBgClass)}>
            {icon}
          </div>
          {pulse && (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-success uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-live-pulse" />
              live
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-foreground tracking-tight tabular-nums">{value}</div>
        <div className="text-muted-foreground text-xs mt-1 font-medium">{label}</div>
      </CardContent>
    </Card>
  );
}

// ── Company avatar with initials ─────────────────────────────────────────────

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-bold text-primary">{initials}</span>
    </div>
  );
}

// ── Mini engagement ring ─────────────────────────────────────────────────────

function MiniRing({ score }: { score: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const strokeColor = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const textColorClass =
    score >= 75 ? 'text-success' : score >= 50 ? 'text-warning-foreground' : 'text-danger';
  return (
    <div className="flex items-center gap-1.5">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="14" cy="14" r={r} fill="none"
          stroke={strokeColor} strokeWidth="3"
          strokeDasharray={`${fill} ${c - fill}`}
          strokeDashoffset={c / 4}
          strokeLinecap="round"
        />
        <text
          x="14" y="14" textAnchor="middle" dominantBaseline="central"
          fontSize="7" fontWeight="700" fill={strokeColor}
        >
          {score}
        </text>
      </svg>
      <span className={cn('text-xs font-semibold tabular-nums hidden lg:inline', textColorClass)}>
        {score}
      </span>
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

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-foreground">BD </span>
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-2">
              Your intelligence command centre
              {activePipelines > 0 && (
                <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-pulse" />
                  {activePipelines} running
                </span>
              )}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/analyze">
              <Plus className="w-4 h-4" />
              New Analysis
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Analyses"
            value={stats?.total_pipelines ?? '—'}
            accentClass="bg-muted-foreground/40"
            iconBgClass="bg-muted"
            icon={<BarChart3 className="w-5 h-5 text-muted-foreground" />}
          />
          <StatCard
            label="Active Pipelines"
            value={activePipelines}
            accentClass="bg-primary"
            iconBgClass="bg-primary/10"
            icon={<Zap className="w-5 h-5 text-primary" />}
            delay="anim-delay-1"
            pulse={activePipelines > 0}
          />
          <StatCard
            label="Completed"
            value={stats?.completed_pipelines ?? '—'}
            accentClass="bg-success"
            iconBgClass="bg-success-subtle"
            icon={<CheckCircle2 className="w-5 h-5 text-success" />}
            delay="anim-delay-2"
          />
          <StatCard
            label="Avg BD Score"
            value={avgScore > 0 ? avgScore : '—'}
            accentClass={avgScore >= 70 ? 'bg-warning' : 'bg-muted-foreground/40'}
            iconBgClass="bg-warning-subtle"
            icon={<TrendingUp className="w-5 h-5 text-warning-foreground" />}
            delay="anim-delay-3"
          />
        </div>

        {/* Prospects banner */}
        {(stats?.total_prospects_identified ?? 0) > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-3.5 flex items-center gap-3 animate-slide-up anim-delay-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground">
              <span className="font-bold text-primary">{stats!.total_prospects_identified}</span>
              <span className="text-muted-foreground ml-1">prospects identified across all analyses</span>
            </span>
            <Button asChild variant="link" size="sm" className="ml-auto text-primary whitespace-nowrap">
              <Link href="/trends">
                View market trends
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        )}

        {/* Pipeline table */}
        <Card className="overflow-hidden animate-slide-up anim-delay-1">
          <CardHeader className="flex-row items-center justify-between py-4">
            <CardTitle>Analysis Pipeline</CardTitle>
            <span className="text-muted-foreground text-sm font-normal">
              {pipelines.length} {pipelines.length === 1 ? 'company' : 'companies'}
            </span>
          </CardHeader>

          {loading ? (
            <div className="px-6 py-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : pipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
              <div className="w-16 h-16 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-center">
                <Search className="w-8 h-8 text-primary/40" />
              </div>
              <div>
                <p className="text-foreground font-semibold text-base">No analyses yet</p>
                <p className="text-muted-foreground text-sm mt-1.5 max-w-xs leading-relaxed">
                  Enter a company name and your offering — a multi-agent swarm handles the rest in ~30 seconds.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/analyze">
                  <Plus className="w-4 h-4" />
                  Start your first analysis
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Company</p>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
                    </th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Score</p>
                    </th>
                    <th className="px-6 py-3 text-left hidden sm:table-cell">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prospects</p>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Date</p>
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pipelines.map((p) => {
                    const isActive = ACTIVE_STATUSES.has(p.status);
                    const score = p.intelligence?.engagement_score?.score ?? 0;
                    const prospectCount = p.prospects?.length ?? p.intelligence?.prospects?.length;
                    const badgeVariant: BadgeVariant = STATUS_BADGE_VARIANT[p.status] ?? 'muted';

                    return (
                      <tr key={p.id} className="hover:bg-muted/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <CompanyAvatar name={p.company_name} />
                              {isActive && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-card animate-live-pulse" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground text-sm">{p.company_name}</div>
                              {p.company_url && (
                                <div className="text-muted-foreground text-xs mt-0.5 truncate max-w-[180px]">
                                  {p.company_url.replace(/^https?:\/\//, '')}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <Badge variant={badgeVariant}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </Badge>
                        </td>

                        <td className="px-4 py-4 hidden md:table-cell">
                          {score > 0 ? (
                            <MiniRing score={score} />
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-foreground text-sm font-medium tabular-nums">
                            {prospectCount != null ? prospectCount : '—'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-muted-foreground text-sm">
                            {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Link href={`/pipeline/${p.id}`}>
                              View
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
