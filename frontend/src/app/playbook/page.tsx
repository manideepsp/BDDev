'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { getPlaybook, PlaybookData, BattleCard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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

function CardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="px-6 py-5 border-b border-border flex gap-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-1.5">
            {[60, 80, 50].map(w => (
              <Skeleton key={w} className="h-5 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </Card>
  );
}

function ObjectionAccordion({ objections }: { objections: BattleCard['objections'] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-1.5">
      {objections.map((obj, i) => (
        <div key={i} className="border border-border rounded-xl overflow-hidden">
          <Button
            variant="ghost"
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 h-auto text-left rounded-none hover:bg-muted/50">
            <span className="text-sm font-medium text-foreground">{obj.objection}</span>
            {open === i
              ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />}
          </Button>
          {open === i && (
            <div className="px-4 pb-3 border-t border-border animate-fade-in">
              <p className="text-sm text-foreground mt-2 leading-relaxed">{obj.response}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BattleCardView({ card, index }: { card: BattleCard; index: number }) {
  const icon = getIcon(card.industry);

  return (
    <Card className="overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 border border-primary/10 flex items-center justify-center flex-shrink-0 text-2xl">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground text-base">{card.industry}</h3>
              <Badge variant="muted" size="sm">Card #{index + 1}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.companies.map(c => (
                <Badge key={c} variant="secondary">{c}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Winning angle callout */}
        <div className="mt-4 bg-gradient-to-r from-primary/5 to-violet-500/5 border-l-4 border-primary rounded-r-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Winning Pitch Angle</p>
          <p className="text-sm font-medium text-foreground">{card.winning_angle}</p>
        </div>
      </div>

      <CardContent className="pt-5">
        {/* Pain points */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Key Pain Points</p>
          <div className="space-y-1.5">
            {card.key_pain_points.map((pp, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-danger-subtle text-danger flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground leading-relaxed">{pp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs: Objections / Talk Tracks */}
        <Tabs defaultValue="objections">
          <TabsList className="w-full">
            <TabsTrigger value="objections" className="flex-1">Objection Handles</TabsTrigger>
            <TabsTrigger value="tracks" className="flex-1">Talk Tracks</TabsTrigger>
          </TabsList>
          <TabsContent value="objections">
            <ObjectionAccordion objections={card.objections} />
          </TabsContent>
          <TabsContent value="tracks">
            <div className="space-y-3">
              {card.talk_tracks.map((track, i) => (
                <div key={i} className="border border-border rounded-xl px-4 py-3">
                  <p className="text-sm text-foreground leading-relaxed">{track}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">BD Playbook</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-generated objection handlers &amp; talk tracks per industry
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
            <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Generating…' : 'Refresh'}
          </Button>
        </div>

        {data && !isEmpty && (
          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{cards.length}</strong> industry cards</span>
            <span><strong className="text-foreground">{data.total_companies}</strong> companies analysed</span>
            <span>Generated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : isEmpty ? (
          <Card className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <div className="text-foreground font-semibold text-lg mb-2">No battle cards yet</div>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {data?.message || 'Complete at least one company analysis to generate your first battle card.'}
            </p>
            <Button asChild>
              <Link href="/analyze">Start Analysis</Link>
            </Button>
          </Card>
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
