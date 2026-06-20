'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Map, Building2, Users, ArrowUpRight, Filter } from 'lucide-react';
import { listPipelines, Pipeline } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PlottedCompany {
  id: string;
  name: string;
  industry: string;
  icp_score: number;
  engagement_score: number;
  status: string;
  prospect_count: number;
}

function getScoreColor(pct: number): string {
  if (pct >= 70) return 'bg-success';
  if (pct >= 40) return 'bg-warning';
  return 'bg-danger';
}

function getScoreVariant(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 70) return 'success';
  if (pct >= 40) return 'warning';
  return 'danger';
}

function ScoreCell({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="flex items-center gap-2.5 w-full">
      <Progress
        value={pct}
        className="w-20 h-1.5"
        indicatorClassName={getScoreColor(pct)}
      />
      <span className="text-xs font-semibold text-foreground tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-primary">{initials}</span>
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
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Market Map</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visual ranking of analysed companies by ICP fit and engagement</p>
          </div>
          <Button asChild>
            <Link href="/analyze">
              <ArrowUpRight className="w-4 h-4" />
              New Analysis
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center py-20 animate-fade-in">
            <Card className="max-w-sm w-full text-center">
              <CardContent className="py-12 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center mb-5">
                  <Map className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">No companies mapped yet</h2>
                <p className="text-muted-foreground text-sm mb-6">Run your first analysis to populate the market map.</p>
                <Button asChild>
                  <Link href="/analyze">Start Analysis</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in">
              {[
                { label: 'Companies Mapped', value: companies.length, icon: Building2 },
                { label: 'Avg ICP Score', value: `${avgICP}/100`, icon: Filter },
                { label: 'High Priority', value: highPri, icon: ArrowUpRight },
                { label: 'Total Prospects', value: topProspects, icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="p-5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
                </Card>
              ))}
            </div>

            {/* Filters + sort */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Select
                value={filterIndustry}
                onChange={e => setFilterIndustry(e.target.value)}
                className="w-52"
              >
                <option value="">All industries</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>

              <div className="flex rounded-lg border border-border overflow-hidden bg-card">
                {(['icp_score', 'engagement_score', 'name'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={cn(
                      'text-xs px-3 py-2 font-medium transition-colors',
                      sortBy === s
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    {s === 'icp_score' ? 'ICP Score' : s === 'engagement_score' ? 'Engagement' : 'Name'}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground ml-auto">{sorted.length} companies</p>
            </div>

            {/* Company table */}
            <Card className="overflow-hidden animate-slide-up">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Industry</th>
                    <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-36">ICP Fit</th>
                    <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-36 hidden md:table-cell">Engagement</th>
                    <th className="text-center px-4 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Prospects</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sorted.map((c, i) => (
                    <tr
                      key={c.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors animate-fade-in',
                        `anim-delay-${Math.min(i + 1, 4) as 1 | 2 | 3 | 4}`
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <CompanyAvatar name={c.name} />
                          <span className="font-semibold text-foreground">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <Badge variant={getScoreVariant(c.icp_score)} size="sm">{c.industry}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <ScoreCell score={c.icp_score} />
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <ScoreCell score={c.engagement_score} />
                      </td>
                      <td className="px-4 py-3.5 text-center hidden md:table-cell">
                        <Badge variant="muted" size="sm">{c.prospect_count}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/pipeline/${c.id}`}>
                            View
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* White-space suggestion */}
            {highPri < 3 && companies.length >= 5 && (
              <Card className="mt-6 p-5 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] animate-fade-in">
                <CardTitle className="text-sm mb-1">White-space opportunity</CardTitle>
                <CardDescription className="text-sm">
                  Only {highPri} of {companies.length} companies score ≥70 ICP fit. Consider analysing companies
                  in the same industries as your top performers — there may be better-fit targets in the same verticals.
                </CardDescription>
                <Button variant="link" size="sm" asChild className="mt-2 px-0">
                  <Link href="/analyze">Find more targets →</Link>
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
