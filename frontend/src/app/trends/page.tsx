'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, CheckCircle2, Search, BarChart } from 'lucide-react';
import { getMarketTrends, listPipelines, TrendsResponse, TrendsCluster, Pipeline } from '@/lib/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
    <Card className={cn('overflow-hidden', `anim-delay-${Math.min(index + 1, 4) as 1 | 2 | 3 | 4} animate-slide-up`)}>
      <CardHeader className="flex-row items-start gap-4 py-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0 text-xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">{cluster.theme}</CardTitle>
            <Badge variant="muted" size="sm" className="flex-shrink-0 mt-0.5">
              {cluster.companies.length} {cluster.companies.length === 1 ? 'company' : 'companies'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {cluster.companies.map(c => {
              const pid = pipelineMap[c.toLowerCase()];
              return pid ? (
                <Link key={c} href={`/pipeline/${pid}`}>
                  <Badge variant="default" className="cursor-pointer hover:opacity-80 transition-opacity">
                    {c} →
                  </Badge>
                </Link>
              ) : (
                <Badge key={c} variant="secondary">{c}</Badge>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Market Signal</p>
          <p className="text-sm text-foreground leading-relaxed">{cluster.insight}</p>
        </div>

        {cluster.opportunity && (
          <div className="bg-success-subtle border border-success/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-success" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-success mb-1">BD Opportunity</p>
                <p className="text-sm text-success/90 leading-relaxed">{cluster.opportunity}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/analyze" className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Analyse a company in this cluster
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-11 h-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Content Intelligence Brief ─────────────────────────────────────────────

const FORMAT_MAP: Record<string, string> = {
  trend_spotlight: 'Trend Spotlight',
  pain_narrative: 'Pain Narrative',
  contrarian: 'Contrarian Take',
  how_we_help: 'Case / How We Help',
  industry_take: 'Industry Take',
};

function inferPostFormat(cluster: TrendsCluster): string {
  const t = (cluster.theme + ' ' + cluster.insight).toLowerCase();
  if (/pain|challenge|struggle|problem|block/i.test(t)) return 'pain_narrative';
  if (/growth|expansion|adopt|surge|trend|shift/i.test(t)) return 'trend_spotlight';
  if (/opport|deliver|help|partner|solution/i.test(t)) return 'how_we_help';
  if (/despite|however|contrary|but most|wrong/i.test(t)) return 'contrarian';
  return 'industry_take';
}

function ContentBrief({ clusters }: { clusters: TrendsCluster[] }) {
  const [copied, setCopied] = useState(false);

  const brief = clusters.map((c) => {
    const format = inferPostFormat(c);
    const hook = c.insight.split('.')[0] + '.';
    const audience = c.companies.length > 0
      ? `Companies like ${c.companies.slice(0, 2).join(', ')}`
      : 'Target accounts in this cluster';
    return { theme: c.theme, format, hook, audience, opportunity: c.opportunity };
  });

  function copyBrief() {
    const lines = [
      `CONTENT INTELLIGENCE BRIEF — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      `Generated from ${clusters.length} market clusters across your pipeline.`,
      '',
      ...brief.map((b, i) => [
        `${i + 1}. ${b.theme.toUpperCase()} — ${FORMAT_MAP[b.format] ?? b.format}`,
        `   Hook: ${b.hook}`,
        `   Audience: ${b.audience}`,
        `   BD link: ${b.opportunity}`,
        '',
      ].join('\n')),
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Editorial Brief</p>
          <p className="text-xs text-muted-foreground mt-0.5">Content angles derived from your market intelligence clusters</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyBrief}>
          {copied ? '✓ Copied!' : '📋 Copy full brief'}
        </Button>
      </div>
      <div className="space-y-3">
        {brief.map((b, i) => (
          <Card key={i}>
            <CardContent className="py-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0 text-base">
                {getSectorIcon(b.theme)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">{b.theme}</p>
                  <Badge variant="default" size="sm">{FORMAT_MAP[b.format] ?? b.format}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">{b.hook}</p>
                {b.opportunity && (
                  <p className="text-[10px] text-success bg-success-subtle border border-success/20 rounded-md px-2 py-1">
                    BD angle: {b.opportunity.slice(0, 120)}{b.opportunity.length > 120 ? '…' : ''}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Audience: {b.audience}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/linkedin">Generate post →</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
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
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Market Intelligence</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Powered by vector similarity clustering
            </p>
          </div>
          {!loading && !error && data && (
            <div className="flex items-center gap-2 animate-fade-in">
              <Badge variant="default" size="lg" className="tabular-nums gap-1.5">
                <BarChart className="w-3.5 h-3.5" />
                {data.total_companies_analyzed} companies analysed
              </Badge>
              {data.clusters.length > 0 && (
                <Badge variant="success" size="lg">
                  {data.clusters.length} clusters
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {loading && <LoadingSkeleton />}

        {error && (
          <Card className="p-5 border-danger/30 bg-danger-subtle animate-fade-in">
            <p className="text-danger text-sm">Something went wrong: {error}</p>
          </Card>
        )}

        {!loading && !error && data && (
          <>
            {/* Empty state */}
            {(!data.clusters || data.clusters.length === 0) ? (
              <div className="flex items-center justify-center py-20 animate-fade-in">
                <Card className="max-w-md w-full text-center">
                  <CardContent className="py-12 flex flex-col items-center">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 rounded-2xl flex items-center justify-center mb-5">
                      <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-foreground font-semibold text-lg mb-2">Building your intelligence base</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-2">
                      {data.overall_summary || 'Analyse at least 3 companies to unlock AI-clustered market trends and cross-portfolio BD opportunities.'}
                    </p>
                    <p className="text-muted-foreground text-xs mb-6">
                      {data.total_companies_analyzed} of 3 companies needed
                    </p>
                    <Button asChild>
                      <Link href="/analyze">Start Analysis</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall summary callout */}
                {data.overall_summary && (
                  <Card className="p-5 animate-fade-in border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1.5">Portfolio Overview</p>
                        <p className="text-sm text-foreground leading-relaxed">{data.overall_summary}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Tab switcher */}
                <Tabs defaultValue="intelligence">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <TabsList>
                      <TabsTrigger value="intelligence">
                        <BarChart className="w-3.5 h-3.5" />
                        Market Clusters
                      </TabsTrigger>
                      <TabsTrigger value="editorial">
                        ✍️ Content Brief
                      </TabsTrigger>
                    </TabsList>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/analyze">
                        <Search className="w-3.5 h-3.5" />
                        Add company
                      </Link>
                    </Button>
                  </div>

                  {/* Market intelligence tab */}
                  <TabsContent value="intelligence">
                    <div className="space-y-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Trend Clusters — {data.clusters.length} identified
                      </p>
                      {data.clusters.map((cluster, i) => (
                        <ClusterCard key={i} cluster={cluster} index={i} pipelineMap={pipelineMap} />
                      ))}
                    </div>
                  </TabsContent>

                  {/* Content Brief tab */}
                  <TabsContent value="editorial">
                    <ContentBrief clusters={data.clusters} />
                  </TabsContent>
                </Tabs>

                {/* Footer CTA */}
                <div className="bg-foreground rounded-2xl p-6 text-center">
                  <p className="text-card text-sm mb-1 font-medium">Keep building your intelligence base</p>
                  <p className="text-card/60 text-xs mb-4">Every new pipeline refines the clusters and sharpens cross-portfolio opportunities.</p>
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link href="/analyze">
                      <Search className="w-4 h-4" />
                      Analyse another company
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
