'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getPipeline, continuePipeline, bulkGenerate, runDriftCheck, runCompetitiveAnalysis,
  getProfileSuggestions,
  Pipeline, PipelineProspect, PainPoint, ICPScore, TechStack,
  EnrichedPerson, GatheredPost, GatheredJob, DriftResult, CompetitiveAnalysis, ProfileSuggestions,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, CheckCircle2, Zap, RefreshCw, ExternalLink, Globe,
  Briefcase, Target, Brain, Shield, Lightbulb, TrendingUp,
  Building2, Users, ChevronRight, AlertCircle, Clock, Loader2,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ['gathering', 'people', 'keywords', 'researching', 'indexing', 'awaiting_input', 'insights', 'embedding'] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: 'Starting', gathering: 'Gathering Sources', people: 'People Swarm',
  keywords: 'Extracting Keywords', researching: 'Web Research', indexing: 'RAG Indexing',
  awaiting_input: 'Awaiting Review', insights: 'Generating Insights',
  embedding: 'Building Vector Index', complete: 'Complete',
  scraping: 'Scraping Website', linkedin: 'LinkedIn Intelligence',
};

// ── Stage Tracker ────────────────────────────────────────────────────────────

function StageTracker({ status }: { status: string }) {
  const stages = PIPELINE_STAGES;
  const currentIdx = stages.indexOf(status as typeof PIPELINE_STAGES[number]);
  return (
    <Card className="mb-6">
      <CardContent className="pt-5 pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Pipeline Progress</p>
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {stages.map((stage, i) => {
            const isDone = status === 'complete' || currentIdx > i;
            const isActive = status === stage;
            const isFailed = status === 'failed';
            return (
              <div key={stage} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    isFailed && isActive ? 'bg-danger-subtle text-danger' :
                    isDone ? 'bg-success-subtle text-success' :
                    isActive ? 'bg-primary text-primary-foreground animate-pulse' :
                    'bg-muted text-muted-foreground',
                  )}>
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4" />
                      : isActive
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <div className="w-2 h-2 rounded-full bg-current opacity-40" />
                    }
                  </div>
                  <span className={cn(
                    'text-[9px] font-medium text-center leading-tight max-w-[60px] whitespace-normal',
                    isDone ? 'text-success' :
                    isActive ? 'text-primary' :
                    'text-muted-foreground',
                  )}>
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className={cn(
                    'h-px w-6 mx-1 mb-4 flex-shrink-0 transition-colors',
                    isDone ? 'bg-success' : 'bg-border',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${fill} ${c - fill}`} strokeDashoffset={c / 4} strokeLinecap="round" />
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill={color}>{score}</text>
      <text x="44" y="57" textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">/100</text>
    </svg>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground">{v}%</span>
      </div>
      <Progress value={v} className="h-1.5" />
    </div>
  );
}

// ── Pain Point Card ──────────────────────────────────────────────────────────

function PainPointCard({ pain }: { pain: PainPoint }) {
  const [expanded, setExpanded] = useState(false);
  const evidenceList = pain.evidence ?? [];
  const visibleEvidence = expanded ? evidenceList : evidenceList.slice(0, 1);

  const sevVariant: Record<string, 'danger' | 'warning' | 'muted'> = {
    high: 'danger', medium: 'warning', low: 'muted',
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="font-semibold text-foreground text-sm">{pain.title}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant={sevVariant[pain.severity] ?? 'muted'}>{pain.severity}</Badge>
            <Badge variant="muted">{pain.confidence} conf.</Badge>
          </div>
        </div>

        {evidenceList.length > 0 && (
          <div className="mb-3 border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-muted/80 transition-colors text-left"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Evidence chain ({evidenceList.length})
              </span>
              <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
            </button>
            <div className="px-3 py-2 space-y-2">
              {visibleEvidence.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground flex-shrink-0 text-sm leading-tight mt-0.5">&ldquo;</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e}</p>
                </div>
              ))}
              {expanded && pain.inference && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Inference</p>
                  <p className="text-xs text-muted-foreground italic">{pain.inference}</p>
                </div>
              )}
              {!expanded && evidenceList.length > 1 && (
                <button onClick={() => setExpanded(true)} className="text-[10px] text-primary hover:underline font-medium">
                  +{evidenceList.length - 1} more signal{evidenceList.length - 1 > 1 ? 's' : ''} + inference &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {!expanded && pain.inference && evidenceList.length === 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Inference</p>
            <p className="text-xs text-muted-foreground">{pain.inference}</p>
          </div>
        )}
        {pain.opportunity && (
          <div className="bg-success-subtle border border-success/20 rounded-xl p-2.5 mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-success mb-0.5">Your Opportunity</p>
            <p className="text-xs text-foreground">{pain.opportunity}</p>
          </div>
        )}
        {pain.pitch_angle && (
          <p className="text-xs text-primary italic mt-2 flex items-start gap-1">
            <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" />{pain.pitch_angle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── ICP Factor Recommendations ───────────────────────────────────────────────

const ICP_FACTOR_RECS: Record<string, { low: string; mid: string }> = {
  'Industry Fit':        { low: 'Industry is a stretch — lead with a cross-vertical case study to build credibility.', mid: 'Moderate fit — reference a comparable vertical win early in the pitch.' },
  'Tech Alignment':      { low: 'Tech stack diverges — start with a discovery call to uncover integration requirements.', mid: 'Partial alignment — offer a lightweight tech audit as the opening move.' },
  'Company Size':        { low: 'Unusual size band — propose a scoped pilot at reduced investment to lower entry risk.', mid: 'Size is borderline — frame around ROI per headcount to justify deal size.' },
  'Pain–Service Fit':    { low: 'Pain match is weak — reframe the offering around their stated priorities from research.', mid: 'Moderate pain fit — identify the #1 pain and anchor the pitch solely on it.' },
  'Budget Probability':  { low: 'Budget signals are absent — start with a cost-saving or ROI framing; propose a $20–40K scoped audit.', mid: 'Budget uncertain — tie proposal to an existing initiative already in flight.' },
  'Decision Readiness':  { low: 'Decision maker is unclear — invest in multi-threading to map the buying committee.', mid: 'Early in buying cycle — focus on education and a low-commitment next step.' },
};

// ── ICP Card ─────────────────────────────────────────────────────────────────

function ICPCard({ icp }: { icp: ICPScore }) {
  const b = icp.breakdown ?? ({} as ICPScore['breakdown']);
  const rows: [string, number][] = [
    ['Industry Fit', b.industry_fit], ['Tech Alignment', b.tech_alignment],
    ['Company Size', b.company_size], ['Pain–Service Fit', b.pain_service_fit],
    ['Budget Probability', b.budget_probability], ['Decision Readiness', b.decision_readiness],
  ];
  const tactics = rows
    .filter(([, v]) => (v || 0) < 65)
    .map(([label, value]) => ({
      label, value,
      rec: value < 45 ? ICP_FACTOR_RECS[label]?.low : ICP_FACTOR_RECS[label]?.mid,
    }))
    .filter(t => t.rec);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ICP Match Score</p>
          <span className="text-2xl font-bold text-primary">{icp.overall}%</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 mb-4">
          {rows.map(([label, value]) => <ScoreBar key={label} label={label} value={value} />)}
        </div>
        {tactics.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-warning">Tactical flags &mdash; low sub-scores</p>
            {tactics.map(t => (
              <div key={t.label} className="flex items-start gap-2.5 bg-warning-subtle border border-warning/20 rounded-xl px-3 py-2">
                <Badge variant={t.value < 45 ? 'danger' : 'warning'} className="mt-0.5 flex-shrink-0">{t.value}%</Badge>
                <div>
                  <p className="text-[10px] font-semibold text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.rec}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3 border-t border-border">
          {icp.recommended_action && (
            <div className="bg-primary/5 rounded-xl p-2.5">
              <p className="text-[10px] text-primary uppercase tracking-widest">Action</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{icp.recommended_action}</p>
            </div>
          )}
          {icp.suggested_deal_size && (
            <div className="bg-muted rounded-xl p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Suggested Deal</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{icp.suggested_deal_size}</p>
            </div>
          )}
          {icp.best_entry_point && (
            <div className="bg-muted rounded-xl p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Best Entry Point</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{icp.best_entry_point}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Risk Detection ────────────────────────────────────────────────────────────

const RISK_PATTERNS: { pattern: RegExp; label: string; severity: 'high' | 'medium' }[] = [
  { pattern: /layoff|laid off|reduction in force|redundanc|retrench/i, label: 'Layoff signals detected', severity: 'high' },
  { pattern: /CEO|CTO|CFO|CPO|VP.*left|chief.*officer.*depart|exec.*resign|stepping down/i, label: 'Executive departure signal', severity: 'high' },
  { pattern: /down round|funding concern|runway|cash.{0,15}crunch|bankruptcy|restructur/i, label: 'Financial distress signal', severity: 'high' },
  { pattern: /pivot|rebranding|strategic shift|wind.{0,8}down|sunset|discontinu/i, label: 'Strategic pivot signal', severity: 'medium' },
  { pattern: /glassdoor|negative review|high turnover|employee.{0,15}concern/i, label: 'Culture risk indicator', severity: 'medium' },
  { pattern: /lawsuit|regulatory|investigation|SEC|FTC|DOJ|fine|penalty/i, label: 'Legal \/ regulatory risk', severity: 'medium' },
];

function detectRisks(intel: NonNullable<Pipeline['intelligence']>): { label: string; severity: 'high' | 'medium'; context: string }[] {
  const blobs = [
    ...(intel.recent_developments ?? []),
    intel.competitive_landscape?.differentiators ?? '',
    intel.company_overview?.description ?? '',
    ...(intel.pain_points ?? []).map(p => `${p.inference} ${(p.evidence ?? []).join(' ')}`),
    ...(intel.bd_opportunities ?? []),
  ].join(' ');

  const found: { label: string; severity: 'high' | 'medium'; context: string }[] = [];
  const seen = new Set<string>();
  for (const { pattern, label, severity } of RISK_PATTERNS) {
    if (seen.has(label)) continue;
    const match = blobs.match(pattern);
    if (match) {
      seen.add(label);
      const idx = blobs.toLowerCase().indexOf(match[0].toLowerCase());
      const snippet = blobs.slice(Math.max(0, idx - 30), idx + 80).replace(/\n/g, ' ').trim();
      found.push({ label, severity, context: snippet });
    }
  }
  return found;
}

function RiskBanner({ intel }: { intel: NonNullable<Pipeline['intelligence']> }) {
  const risks = detectRisks(intel);
  if (risks.length === 0) return null;
  const highCount = risks.filter(r => r.severity === 'high').length;
  return (
    <div className={cn(
      'rounded-2xl border p-4 mb-4',
      highCount > 0 ? 'bg-danger-subtle border-danger/30' : 'bg-warning-subtle border-warning/30',
    )}>
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('w-5 h-5 flex-shrink-0', highCount > 0 ? 'text-danger' : 'text-warning')} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-semibold mb-2', highCount > 0 ? 'text-danger' : 'text-warning')}>
            {highCount > 0 ? 'Risk signals detected — address before pitching' : 'Caution signals — consider in your approach'}
          </p>
          <div className="space-y-1.5">
            {risks.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge variant={r.severity === 'high' ? 'danger' : 'warning'} className="flex-shrink-0 mt-0.5">{r.severity}</Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">...{r.context}...</p>
                </div>
              </div>
            ))}
          </div>
          <p className={cn('text-[10px] mt-2', highCount > 0 ? 'text-danger' : 'text-warning')}>
            Run the Drift Check below to verify these signals before generating pitch assets.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tech Stack Card ───────────────────────────────────────────────────────────

function TechStackCard({ tech }: { tech: TechStack }) {
  const cols: [string, string[], string][] = [
    ['Current', tech.current ?? [], 'bg-muted text-muted-foreground'],
    ['Hiring For', tech.hiring ?? [], 'bg-primary/10 text-primary'],
    ['Gaps', tech.gaps ?? [], 'bg-danger-subtle text-danger'],
  ];
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Technology Signals</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cols.map(([label, items, cls]) => (
            <div key={label}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.length > 0
                  ? items.map((t, i) => <span key={i} className={cn('text-xs px-2 py-0.5 rounded-md font-medium', cls)}>{t}</span>)
                  : <span className="text-xs text-muted-foreground">&mdash;</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── People Grid ───────────────────────────────────────────────────────────────

function PeopleGrid({ people, removed, onToggle }: {
  people: EnrichedPerson[]; removed?: Set<string>; onToggle?: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {people.map((p, i) => {
        const isRemoved = removed?.has(p.name);
        const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return (
          <Card key={i} className={cn('transition-opacity', isRemoved && 'opacity-50')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.title}</p>
                  </div>
                </div>
                {onToggle && (
                  <Button
                    size="sm"
                    variant={isRemoved ? 'success' : 'outline'}
                    onClick={() => onToggle(p.name)}
                    className="flex-shrink-0"
                  >
                    {isRemoved ? 'Restore' : 'Remove'}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.role_category && <Badge variant="secondary">{p.role_category}</Badge>}
                {p.seniority && p.seniority !== 'Unknown' && <Badge variant="muted">{p.seniority}</Badge>}
                {p.location && p.location !== 'Unknown' && <Badge variant="muted">📍 {p.location}</Badge>}
                {p.confidence && <Badge variant="muted">{p.confidence} conf.</Badge>}
              </div>
              {p.relevance && <p className="text-xs text-muted-foreground mt-2">{p.relevance}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Signal Sections ───────────────────────────────────────────────────────────

function SignalSections({ people, posts, jobs, removed, onToggle }: {
  people?: EnrichedPerson[]; posts?: GatheredPost[]; jobs?: GatheredJob[];
  removed?: Set<string>; onToggle?: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      {(people ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            People <span className="normal-case font-normal">&mdash; swarm-enriched ({people!.length})</span>
          </p>
          <PeopleGrid people={people!} removed={removed} onToggle={onToggle} />
        </div>
      )}
      {(posts ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Recent Posts &amp; Activity</p>
          <div className="space-y-2">
            {posts!.slice(0, 8).map((post, i) => (
              <a key={i} href={post.url} target="_blank" rel="noopener noreferrer"
                 className="block bg-card rounded-2xl border border-border shadow-card p-3 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="muted">{post.source}</Badge>
                  {post.title && <span className="text-xs font-medium text-foreground truncate">{post.title}</span>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{post.text}</p>
              </a>
            ))}
          </div>
        </div>
      )}
      {(jobs ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Open Roles <span className="normal-case font-normal">&mdash; hiring signals</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {jobs!.slice(0, 10).map((job, i) => (
              <a key={i} href={job.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-3 bg-card rounded-2xl border border-border shadow-card p-3 hover:border-primary/30 transition-colors">
                <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{job.title}</p>
                  {job.location && <p className="text-[10px] text-muted-foreground mt-0.5">{job.location}</p>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Accept/Reject Item ────────────────────────────────────────────────────────

type ExcludedItems = Record<string, Set<number>>;

function AcceptRejectItem({ accepted, onToggle, children }: {
  accepted: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'relative flex items-start gap-2.5 rounded-xl border p-3 transition-colors',
      accepted ? 'bg-card border-border' : 'bg-muted border-border opacity-50',
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          accepted ? 'bg-success border-success text-white' : 'bg-card border-border text-muted-foreground',
        )}
        title={accepted ? 'Click to reject' : 'Click to accept'}
      >
        {accepted
          ? <CheckCircle2 className="w-3 h-3" />
          : <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
        }
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ── Cluster Card ──────────────────────────────────────────────────────────────

function ClusterCard({ icon, label, count, accepted, children, defaultOpen = true }: {
  icon: string; label: string; count: number; accepted: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const allAccepted = accepted === count;
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <Badge variant={allAccepted ? 'success' : 'warning'}>{accepted}/{count} kept</Badge>
        </div>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </Card>
  );
}

// ── Review Panel ──────────────────────────────────────────────────────────────

function ReviewPanel({ pipelineId, gathered, onContinued }: {
  pipelineId: string;
  gathered: NonNullable<Pipeline['gathered']>;
  onContinued: () => void;
}) {
  const [removedPeople, setRemovedPeople] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<ExcludedItems>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const people = gathered.people?.people ?? [];
  const posts = gathered.posts?.posts ?? [];
  const jobs = gathered.jobs?.jobs ?? [];
  const crawlFindings = gathered.crawl?.findings ?? [];
  const researchResults = gathered.research?.results ?? [];
  const linkedinFields = gathered.linkedin?.company_fields ?? {};
  const websitePages = gathered.website?.pages ?? [];
  const keywords = gathered.keywords?.keywords ?? [];
  const productAreas = gathered.keywords?.product_areas ?? [];
  const ragChunks = gathered.rag_chunks ?? 0;
  const asOf = gathered.posts?.as_of;

  function togglePerson(name: string) {
    setRemovedPeople(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  function toggleItem(source: string, idx: number) {
    setExcluded(prev => {
      const next = { ...prev };
      const s = new Set(next[source] ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      next[source] = s;
      return next;
    });
  }

  function isExcluded(source: string, idx: number) {
    return excluded[source]?.has(idx) ?? false;
  }

  const totalExcluded = removedPeople.size + Object.values(excluded).reduce((a, s) => a + s.size, 0);

  async function handleContinue() {
    setSubmitting(true);
    setError('');
    const excludedItems: Record<string, number[]> = {};
    for (const [k, s] of Object.entries(excluded)) {
      if (s.size > 0) excludedItems[k] = Array.from(s);
    }
    try {
      await continuePipeline(pipelineId, {
        human_input: note.trim() || undefined,
        removed_people: Array.from(removedPeople),
        excluded_items: excludedItems,
      });
      onContinued();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue — please try again');
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="bg-warning-subtle border border-warning/30 rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" />
          Human checkpoint &mdash; review before synthesis
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          The agents gathered everything below{asOf ? ` (as of ${asOf})` : ''} and indexed it for RAG.
          Accept or reject individual items in each cluster &mdash; only kept items feed into synthesis.
          Add context in the box at the bottom to inject your own knowledge with highest priority.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="muted">{ragChunks} chunks indexed</Badge>
          {totalExcluded > 0 && <Badge variant="danger">{totalExcluded} items excluded</Badge>}
        </div>
      </div>

      {(Object.keys(linkedinFields).length > 0 || websitePages.length > 0) && (
        <ClusterCard icon="🏢" label="Company Identity"
          count={Object.keys(linkedinFields).filter(k => k !== 'people').length + websitePages.length}
          accepted={Object.keys(linkedinFields).filter(k => k !== 'people').length + websitePages.length}>
          {Object.keys(linkedinFields).filter(k => k !== 'people').length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">LinkedIn</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(linkedinFields).filter(([k]) => k !== 'people' && linkedinFields[k as keyof typeof linkedinFields]).map(([k, v]) => (
                  <div key={k} className="bg-muted rounded-xl p-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{k}</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{String(v).slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {websitePages.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Website pages scraped</p>
              {websitePages.map((pg, i) => (
                <div key={pg.url ?? i} className="flex items-center gap-2 py-0.5">
                  <Badge variant="muted">page</Badge>
                  <span className="text-xs text-muted-foreground truncate">{pg.title || pg.url}</span>
                </div>
              ))}
            </div>
          )}
          {(keywords.length > 0 || productAreas.length > 0) && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Extracted keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw, i) => <Badge key={i} variant="secondary">{kw}</Badge>)}
                {productAreas.map((pa, i) => <Badge key={i} variant="muted">{pa}</Badge>)}
              </div>
            </div>
          )}
        </ClusterCard>
      )}

      {people.length > 0 && (
        <ClusterCard icon="🐝" label="Leadership &amp; People"
          count={people.length} accepted={people.length - removedPeople.size}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {people.map((p) => (
              <AcceptRejectItem key={p.name} accepted={!removedPeople.has(p.name)}
                onToggle={() => togglePerson(p.name)}>
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.role_category && <Badge variant="secondary">{p.role_category}</Badge>}
                  {p.seniority && p.seniority !== 'Unknown' && <Badge variant="muted">{p.seniority}</Badge>}
                  {p.location && p.location !== 'Unknown' && <Badge variant="muted">📍 {p.location}</Badge>}
                </div>
                {p.relevance && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.relevance}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {posts.length > 0 && (
        <ClusterCard icon="📣" label="Recent Announcements &amp; Posts"
          count={posts.length} accepted={posts.length - (excluded['posts']?.size ?? 0)}>
          {asOf && (
            <p className="text-[10px] text-muted-foreground mb-2">
              As of {asOf} &middot; {gathered.posts?.lookback_months}mo lookback &middot; sources: company website, LinkedIn, web
            </p>
          )}
          <div className="space-y-2">
            {posts.map((post, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('posts', i)} onToggle={() => toggleItem('posts', i)}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={post.source === 'company' ? 'success' : post.source === 'LinkedIn' ? 'secondary' : 'muted'}>{post.source}</Badge>
                  {post.date && <span className="text-[10px] text-muted-foreground">{post.date}</span>}
                </div>
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-primary line-clamp-1">{post.title}</a>
                {post.text && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{post.text}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {jobs.length > 0 && (
        <ClusterCard icon="💼" label="Open Roles &mdash; hiring signals"
          count={jobs.length} accepted={jobs.length - (excluded['jobs']?.size ?? 0)}
          defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {jobs.map((job, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('jobs', i)} onToggle={() => toggleItem('jobs', i)}>
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-primary line-clamp-1">{job.title}</a>
                {job.location && <p className="text-[10px] text-muted-foreground mt-0.5">{job.location}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      {crawlFindings.length > 0 && (() => {
        const byType: Record<string, { item: typeof crawlFindings[0]; idx: number }[]> = {};
        crawlFindings.forEach((f, idx) => {
          (byType[f.source_type] ??= []).push({ item: f, idx });
        });
        return (
          <ClusterCard icon="🕸️" label="Web Presence"
            count={crawlFindings.length} accepted={crawlFindings.length - (excluded['crawl']?.size ?? 0)}
            defaultOpen={false}>
            {Object.entries(byType).map(([type, items]) => (
              <div key={type}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">{type}</p>
                <div className="space-y-1.5">
                  {items.map(({ item, idx }) => (
                    <AcceptRejectItem key={idx} accepted={!isExcluded('crawl', idx)} onToggle={() => toggleItem('crawl', idx)}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-foreground hover:text-primary line-clamp-1">{item.title || item.url}</a>
                      {item.snippet && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>}
                    </AcceptRejectItem>
                  ))}
                </div>
              </div>
            ))}
          </ClusterCard>
        );
      })()}

      {researchResults.length > 0 && (
        <ClusterCard icon="🔍" label="Targeted Research"
          count={researchResults.length} accepted={researchResults.length - (excluded['research']?.size ?? 0)}
          defaultOpen={false}>
          <div className="space-y-1.5">
            {researchResults.map((r, i) => (
              <AcceptRejectItem key={i} accepted={!isExcluded('research', i)} onToggle={() => toggleItem('research', i)}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="secondary">{r.angle}</Badge>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-primary line-clamp-1">{r.title}</a>
                {r.snippet && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{r.snippet}</p>}
              </AcceptRejectItem>
            ))}
          </div>
        </ClusterCard>
      )}

      <Card>
        <CardContent className="pt-5">
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Add context for synthesis <span className="normal-case font-normal">(optional &mdash; highest priority)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. 'We already spoke to their VP Eng — focus on the data platform gap', or correct anything the agents got wrong..."
            className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground resize-none"
          />
          {error && (
            <div className="mt-2 bg-danger-subtle border border-danger/30 text-danger text-xs rounded-xl px-3 py-2">{error}</div>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Button onClick={handleContinue} disabled={submitting} className="gap-2">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting synthesis...</>
                : <><Brain className="w-4 h-4" />Continue to Insights</>
              }
            </Button>
            {totalExcluded > 0 && (
              <span className="text-xs text-warning font-medium">{totalExcluded} item(s) will be excluded</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">Nothing here blocks synthesis &mdash; continue when ready</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [continued, setContinued] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ generated: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState('');
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);
  const [driftError, setDriftError] = useState('');
  const [competitiveLoading, setCompetitiveLoading] = useState(false);
  const [competitiveResult, setCompetitiveResult] = useState<CompetitiveAnalysis | null>(null);
  const [compError, setCompError] = useState('');
  const [profileSuggestions, setProfileSuggestions] = useState<ProfileSuggestions | null>(null);

  const PAUSED = (s?: string) => s === 'complete' || s === 'failed' || s === 'awaiting_input';

  const fetchPipeline = useCallback(async () => {
    try {
      const p = await getPipeline(id);
      setPipeline(p);
      if (PAUSED(p.status)) {
        setLoading(false);
        if (p.status === 'complete' && !profileSuggestions) {
          getProfileSuggestions(id).then(setProfileSuggestions).catch(() => null);
        }
      }
    } catch {
      router.push('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(() => {
      if (!PAUSED(pipeline?.status)) fetchPipeline();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchPipeline, pipeline?.status]);

  const handleContinued = useCallback(() => {
    setContinued(true);
    setPipeline(prev => (prev ? { ...prev, status: 'insights' } : prev));
  }, []);

  // suppress unused lint warning
  void loading;

  if (!pipeline) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        Loading pipeline...
      </div>
    </div>
  );

  const intel = pipeline.intelligence;
  const overview = intel?.company_overview;
  const score = intel?.engagement_score?.score ?? 0;
  const prospects: PipelineProspect[] = pipeline.prospects ?? intel?.prospects ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Back navigation bar */}
      <div className="bg-card border-b border-border px-8 py-3">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <nav className="mb-4 text-sm text-muted-foreground flex items-center gap-1.5">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{pipeline.company_name}</span>
          </nav>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-3xl font-bold text-foreground">{pipeline.company_name}</h1>
                {pipeline.status === 'complete' && <Badge variant="success">Complete</Badge>}
                {pipeline.status === 'failed' && <Badge variant="danger">Failed</Badge>}
                {pipeline.status === 'awaiting_input' && <Badge variant="warning">Awaiting Review</Badge>}
                {!['complete', 'failed', 'awaiting_input'].includes(pipeline.status) && (
                  <Badge variant="pending" className="animate-pulse">{STAGE_LABELS[pipeline.status] ?? pipeline.status}</Badge>
                )}
              </div>
              {overview && (
                <div className="flex items-center gap-3 flex-wrap">
                  {overview.industry && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="w-4 h-4" />{overview.industry}
                    </span>
                  )}
                  {overview.headquarters && (
                    <span className="text-sm text-muted-foreground">📍 {overview.headquarters}</span>
                  )}
                  {overview.size && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />{overview.size}
                    </span>
                  )}
                  {intel?.grounded
                    ? <Badge variant="success">● Live web data</Badge>
                    : <Badge variant="warning">AI-estimated</Badge>}
                </div>
              )}
            </div>
            {score > 0 && (
              <Card className="flex flex-col items-center justify-center p-4 gap-2 min-w-[120px]">
                <ScoreRing score={score} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest text-center">Engagement Score</p>
              </Card>
            )}
          </div>
        </div>

        {/* Stage tracker */}
        {pipeline.status !== 'complete' && <StageTracker status={pipeline.status} />}

        {/* Failed banner */}
        {pipeline.status === 'failed' && (
          <div className="bg-danger-subtle border border-danger/30 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-danger">Pipeline failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pipeline.error_message ?? 'Unknown error'}</p>
            </div>
          </div>
        )}

        {/* Human-in-the-loop review checkpoint */}
        {pipeline.status === 'awaiting_input' && !continued && pipeline.gathered && (
          <ReviewPanel pipelineId={id} gathered={pipeline.gathered} onContinued={handleContinued} />
        )}

        {/* Intelligence sections */}
        {intel && pipeline.status === 'complete' && (
          <div className="space-y-5 mb-8">
            {/* Overview + Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardContent className="pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Company Overview</p>
                  <p className="text-sm text-foreground leading-relaxed mb-4">{overview?.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([['Industry', overview?.industry], ['Size', overview?.size], ['Founded', overview?.founded], ['HQ', overview?.headquarters]] as [string, string | undefined][]).map(([k, v]) => v ? (
                      <div key={k} className="bg-muted rounded-xl p-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{k}</p>
                        <p className="text-xs font-medium text-foreground mt-0.5">{v}</p>
                      </div>
                    ) : null)}
                  </div>
                </CardContent>
              </Card>
              <Card className="flex flex-col items-center justify-center p-5 gap-3">
                <ScoreRing score={score} />
                <p className="text-xs text-center text-muted-foreground leading-relaxed">{intel.engagement_score?.reasoning}</p>
              </Card>
            </div>

            {/* ICP match */}
            {intel.icp_score && <ICPCard icp={intel.icp_score} />}

            {/* Tech stack */}
            {intel.tech_stack && <TechStackCard tech={intel.tech_stack} />}

            {/* Risk banner */}
            <RiskBanner intel={intel} />

            {/* Pain Points */}
            {(intel.pain_points ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Pain Points <span className="normal-case font-normal">&mdash; evidence-anchored</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {intel.pain_points!.map((p, i) => <PainPointCard key={i} pain={p} />)}
                </div>
              </div>
            )}

            {/* BD Opportunities */}
            {(intel.bd_opportunities ?? []).length > 0 && (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">BD Opportunities</p>
                  <ul className="space-y-2">
                    {(intel.bd_opportunities ?? []).map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <TrendingUp className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />{o}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommended approach */}
            {intel.recommended_approach && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />AI Recommended Approach
                </p>
                <p className="text-sm text-foreground leading-relaxed">{intel.recommended_approach}</p>
              </div>
            )}

            {/* Profile learnings */}
            {profileSuggestions && (
              <div className="bg-warning-subtle border border-warning/30 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-warning mb-1">Learnings for your company profile</p>
                    <p className="text-xs text-muted-foreground mb-3">{profileSuggestions.reasoning}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {profileSuggestions.suggested_services.length > 0 && (
                        <div><span className="font-medium text-foreground">Services to mention: </span>
                          <span className="text-muted-foreground">{profileSuggestions.suggested_services.join(', ')}</span>
                        </div>
                      )}
                      {profileSuggestions.suggested_industries.length > 0 && (
                        <div><span className="font-medium text-foreground">Industry tags: </span>
                          <span className="text-muted-foreground">{profileSuggestions.suggested_industries.join(', ')}</span>
                        </div>
                      )}
                      {profileSuggestions.suggested_usps && (
                        <div className="md:col-span-2"><span className="font-medium text-foreground">USP angle: </span>
                          <span className="text-muted-foreground">{profileSuggestions.suggested_usps}</span>
                        </div>
                      )}
                    </div>
                    <Link href="/settings" className="mt-3 inline-block text-xs text-primary hover:underline font-medium transition-colors">
                      Update your profile &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* People swarm + posts + jobs */}
            <SignalSections people={intel.people} posts={intel.posts} jobs={intel.jobs} />

            {/* Sources */}
            {(intel.sources ?? []).length > 0 && (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Sources</p>
                  <div className="space-y-2">
                    {intel.sources!.map((s, i) => {
                      let hostname = s.url;
                      try { hostname = new URL(s.url).hostname; } catch { /* keep raw url */ }
                      return (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{hostname}</span>
                          <span className="truncate">{s.title}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitive Intelligence */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Competitive Intelligence</p>
                {pipeline?.status === 'complete' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setCompetitiveLoading(true);
                      setCompError('');
                      try { setCompetitiveResult(await runCompetitiveAnalysis(id)); }
                      catch (err) { setCompError(err instanceof Error ? err.message : 'Competitive analysis failed — please try again'); }
                      finally { setCompetitiveLoading(false); }
                    }}
                    disabled={competitiveLoading}
                    className="gap-1.5"
                  >
                    {competitiveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {competitiveLoading ? 'Analysing…' : 'Run Competitive Analysis'}
                  </Button>
                )}
              </div>
              {compError && <p className="text-sm text-danger mt-2">{compError}</p>}
              {competitiveResult && (
                <div className="space-y-3">
                  <Card className={cn(
                    competitiveResult.displacement_risk === 'high' ? 'border-danger/40' :
                    competitiveResult.displacement_risk === 'medium' ? 'border-warning/40' : '',
                  )}>
                    <CardContent className="pt-4">
                      <p className="text-xs font-semibold text-foreground mb-1">{competitiveResult.market_position}</p>
                      <p className="text-sm text-success font-medium">{competitiveResult.seller_wedge}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground">Displacement risk:</span>
                        <Badge variant={
                          competitiveResult.displacement_risk === 'high' ? 'danger' :
                          competitiveResult.displacement_risk === 'medium' ? 'warning' : 'success'
                        }>{competitiveResult.displacement_risk}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(competitiveResult.competitors ?? []).map((c, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4">
                          <p className="font-semibold text-foreground text-sm mb-2">{c.name}</p>
                          <p className="text-xs text-muted-foreground mb-1">{c.positioning}</p>
                          <p className="text-xs text-danger mb-2">Weakness: {c.weakness}</p>
                          <p className="text-xs text-primary italic">BD angle: {c.bd_angle}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {(competitiveResult.recommended_talking_points ?? []).length > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Competitive Talking Points</p>
                        <ul className="space-y-1">
                          {competitiveResult.recommended_talking_points.map((t, i) => (
                            <li key={i} className="text-xs text-foreground flex gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />{t}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drift Check */}
        {pipeline?.status === 'complete' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Company Signal Monitor</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setDriftLoading(true);
                  setDriftError('');
                  try { setDriftResult(await runDriftCheck(id)); }
                  catch (err) { setDriftError(err instanceof Error ? err.message : 'Drift check failed — please try again'); }
                  finally { setDriftLoading(false); }
                }}
                disabled={driftLoading}
                className="gap-2"
              >
                {driftLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {driftLoading ? 'Checking for changes…' : 'Check for New Signals'}
              </Button>
            </div>
            {driftError && <p className="text-sm text-danger mt-2">{driftError}</p>}
            {driftResult && (
              <Card className={cn(
                driftResult.alert_level === 'high' ? 'border-danger/40' :
                driftResult.alert_level === 'medium' ? 'border-warning/40' :
                driftResult.alert_level === 'low' ? 'border-primary/40' : '',
              )}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={
                      driftResult.alert_level === 'high' ? 'danger' :
                      driftResult.alert_level === 'medium' ? 'warning' :
                      driftResult.alert_level === 'low' ? 'secondary' : 'muted'
                    }>{driftResult.alert_level === 'none' ? 'No changes' : `${driftResult.alert_level} alert`}</Badge>
                    <span className="text-[10px] text-muted-foreground">checked {new Date(driftResult.checked_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground mb-3">{driftResult.summary}</p>
                  {driftResult.changes.length > 0 && (
                    <div className="space-y-2">
                      {driftResult.changes.map((c, i) => (
                        <div key={i} className="bg-muted rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">{c.type}</Badge>
                            <span className="text-xs font-semibold text-foreground">{c.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.detail}</p>
                          <p className="text-xs text-success mt-1">BD impact: {c.impact_on_bd}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Prospects grid */}
        {prospects.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Identified Prospects</p>
                <p className="text-sm font-semibold text-foreground">{prospects.length} contacts ready</p>
              </div>
              {pipeline?.status === 'complete' && (
                <Button
                  onClick={async () => {
                    setBulkLoading(true);
                    setBulkResult(null);
                    setBulkError('');
                    try {
                      const r = await bulkGenerate(id, { generate_poc: true, generate_email: true, tone: 'professional', word_limit: 150 });
                      setBulkResult({ generated: r.generated, total: r.total });
                      await fetchPipeline();
                    } catch (err) {
                      setBulkError(err instanceof Error ? err.message : 'Failed to generate — please try again');
                    }
                    finally { setBulkLoading(false); }
                  }}
                  disabled={bulkLoading}
                  className="gap-2"
                >
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {bulkLoading ? 'Generating for all…' : 'Generate All POC + Emails'}
                </Button>
              )}
            </div>

            {bulkResult && (
              <div className="mb-4 bg-success-subtle border border-success/30 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Generated for {bulkResult.generated} of {bulkResult.total} prospects &mdash; click any card to view.
              </div>
            )}
            {bulkError && <p className="text-sm text-danger mt-2 mb-4">{bulkError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prospects.map(prospect => {
                const initials = prospect.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <Card key={prospect.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="pt-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary-foreground">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">{prospect.name}</p>
                            <Badge variant={
                              prospect.confidence === 'high' ? 'high' :
                              prospect.confidence === 'medium' ? 'medium' : 'low'
                            }>{prospect.confidence}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{prospect.title}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {prospect.seniority && prospect.seniority !== 'Unknown' && (
                          <Badge variant="secondary">{prospect.seniority}</Badge>
                        )}
                        {prospect.role_category && prospect.role_category !== 'Other' && (
                          <Badge variant="muted">{prospect.role_category}</Badge>
                        )}
                        {prospect.location && prospect.location !== 'Unknown' && (
                          <Badge variant="muted">📍 {prospect.location}</Badge>
                        )}
                        {prospect.prospect_status && prospect.prospect_status !== 'new' && (
                          <Badge variant="active">{prospect.prospect_status.replace('_', ' ')}</Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">{prospect.relevance}</p>
                      {prospect.contact_angle && (
                        <p className="text-xs text-primary italic mb-3 flex items-start gap-1">
                          <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" />{prospect.contact_angle}
                        </p>
                      )}
                      {prospect.poc_plan && (
                        <div className="flex items-center gap-1 text-[10px] text-success font-medium mb-2">
                          <CheckCircle2 className="w-3 h-3" />POC plan ready
                        </div>
                      )}

                      <Separator className="mb-3" />
                      <Link href={`/pipeline/${id}/prospect/${prospect.id}`}>
                        <Button className="w-full gap-2" size="sm">
                          <Target className="w-4 h-4" />
                          View POC Plan + Generate Email
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Still processing indicator */}
        {pipeline.status !== 'complete' && pipeline.status !== 'failed' && pipeline.status !== 'awaiting_input' && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {STAGE_LABELS[pipeline.status] ?? 'Processing'}...
          </div>
        )}
      </div>
    </div>
  );
}
