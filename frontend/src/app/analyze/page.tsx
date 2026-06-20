'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Megaphone,
  Users,
  Search,
  Database,
  PauseCircle,
  Brain,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
  Zap,
  Building2,
} from 'lucide-react';
import { startAnalysis } from '@/lib/api';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ── Agent stages data ────────────────────────────────────────────────────────

const AGENT_STAGES = [
  {
    Icon: Globe,
    label: 'Website + LinkedIn',
    desc: 'Parallel scrape of the company site and LinkedIn org schema — homepage, /about, /products, founders.',
    gradientClass: 'from-blue-500 to-cyan-500',
    timing: '~3 s',
  },
  {
    Icon: Megaphone,
    label: 'Posts & Open Roles',
    desc: 'Recent announcements and job listings as live BD signals — what are they building, who are they hiring?',
    gradientClass: 'from-violet-500 to-purple-500',
    timing: '~4 s',
  },
  {
    Icon: Users,
    label: 'People Swarm',
    desc: 'One enrichment agent per discovered person runs in parallel — seniority, role category, BD relevance.',
    gradientClass: 'from-amber-500 to-orange-500',
    timing: '~5 s',
  },
  {
    Icon: Search,
    label: 'Keywords + Web Research',
    desc: 'LLM distils themes, then fires 4 targeted searches across news, competitive, financial and market angles.',
    gradientClass: 'from-indigo-500 to-violet-500',
    timing: '~6 s',
  },
  {
    Icon: Database,
    label: 'RAG Indexing',
    desc: 'Every gathered fact is embedded (fastembed, 384-dim ONNX) and stored in a per-pipeline Qdrant namespace.',
    gradientClass: 'from-teal-500 to-emerald-500',
    timing: '~4 s',
  },
  {
    Icon: PauseCircle,
    label: 'Your Review',
    desc: 'Pipeline pauses — you prune irrelevant people, add context, exclude noisy posts. Quality over speed.',
    gradientClass: 'from-slate-500 to-slate-600',
    timing: 'your call',
  },
  {
    Icon: Brain,
    label: 'RAG-Grounded Insights',
    desc: 'Synthesis queries retrieve top evidence chunks, then the LLM writes an evidence-first intelligence report.',
    gradientClass: 'from-rose-500 to-pink-500',
    timing: '~8 s',
  },
] as const;

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;
const DEAL_OPTIONS = ['Small', 'Mid', 'Enterprise'] as const;

type Priority = typeof PRIORITY_OPTIONS[number];

const PRIORITY_ACTIVE_CLASS: Record<Priority, string> = {
  High:   'border-danger bg-danger-subtle text-danger',
  Medium: 'border-warning bg-warning-subtle text-warning-foreground',
  Low:    'border-border bg-muted text-muted-foreground',
};

// ── Analyze page ─────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '', company_url: '', user_description: '',
    sender_name: '', sender_company: '',
    linkedin_url: '', deal_size: '', priority: '', notes: '',
    post_lookback_months: 3, post_limit: 10,
  });
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = form.company_name.trim() && form.user_description.trim();
  const descChars = form.user_description.length;
  const descWarn = descChars > 400;

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const { pipeline_id } = await startAnalysis({
        company_name: form.company_name,
        company_url: form.company_url || undefined,
        user_description: form.user_description,
        sender_name: form.sender_name || undefined,
        sender_company: form.sender_company || undefined,
        linkedin_url: form.linkedin_url || undefined,
        deal_size: form.deal_size || undefined,
        priority: form.priority || undefined,
        notes: form.notes || undefined,
        post_lookback_months: form.post_lookback_months,
        post_limit: form.post_limit,
      });
      router.push(`/pipeline/${pipeline_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-foreground">New </span>
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                Company Analysis
              </span>
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              7-agent pipeline · RAG-grounded synthesis · human-in-the-loop checkpoint
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-success font-medium bg-success-subtle border border-success/20 rounded-xl px-3 py-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-live-pulse flex-shrink-0" />
            Ready to launch
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── LEFT: Form ──────────────────────────────────────── */}
          <div className="lg:col-span-3 animate-slide-up">
            <Card>
              <CardHeader>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Target + Offering
                </p>
              </CardHeader>

              <CardContent className="space-y-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Company name */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Company Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      type="text"
                      value={form.company_name}
                      onChange={e => set('company_name', e.target.value)}
                      placeholder="e.g. Stripe, Notion, Figma"
                      autoFocus
                      icon={<Building2 className="w-4 h-4" />}
                    />
                  </div>

                  {/* URL */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Company Website
                      <span className="ml-2 text-xs font-normal text-muted-foreground">optional — improves scraping quality</span>
                    </label>
                    <Input
                      type="url"
                      value={form.company_url}
                      onChange={e => set('company_url', e.target.value)}
                      placeholder="https://..."
                      icon={<Globe className="w-4 h-4" />}
                    />
                  </div>

                  {/* Your offering */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-foreground">
                        Your Offering <span className="text-danger">*</span>
                      </label>
                      <span className={cn(
                        'text-xs tabular-nums',
                        descWarn ? 'text-warning-foreground font-semibold' : 'text-muted-foreground'
                      )}>
                        {descChars}/500
                      </span>
                    </div>
                    <Textarea
                      value={form.user_description}
                      onChange={e => set('user_description', e.target.value.slice(0, 500))}
                      rows={4}
                      placeholder="Describe what you do and what you're pitching to this company. The more specific, the sharper the intelligence report."
                    />
                    {descWarn && (
                      <p className="text-xs text-warning-foreground mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Getting close to the limit — keep it focused for best results.
                      </p>
                    )}
                  </div>

                  {/* Deal size + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Deal Size</label>
                      <div className="flex gap-1.5">
                        {DEAL_OPTIONS.map(opt => (
                          <button
                            key={opt} type="button"
                            onClick={() => set('deal_size', form.deal_size === opt ? '' : opt)}
                            className={cn(
                              'flex-1 text-xs py-2 rounded-lg border font-medium transition-all',
                              form.deal_size === opt
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
                      <div className="flex gap-1.5">
                        {PRIORITY_OPTIONS.map(opt => (
                          <button
                            key={opt} type="button"
                            onClick={() => set('priority', form.priority === opt ? '' : opt)}
                            className={cn(
                              'flex-1 text-xs py-2 rounded-lg border font-medium transition-all',
                              form.priority === opt
                                ? PRIORITY_ACTIVE_CLASS[opt]
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced toggle */}
                  <div className="border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => setAdvanced(v => !v)}
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', advanced && 'rotate-90')} />
                      Advanced settings
                      <span className="font-normal text-muted-foreground/70">— LinkedIn URL, notes, post lookback</span>
                    </button>

                    {advanced && (
                      <div className="mt-4 space-y-4 animate-slide-up">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Company LinkedIn</label>
                          <Input
                            type="url"
                            value={form.linkedin_url}
                            onChange={e => set('linkedin_url', e.target.value)}
                            placeholder="https://linkedin.com/company/..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Notes on this Target</label>
                          <Textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={2}
                            placeholder="Known context — a warm intro, a specific pain point, recent news you want the agent to focus on..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Post lookback (months)</label>
                            <Input
                              type="number" min={1} max={24}
                              value={form.post_lookback_months}
                              onChange={e => set('post_lookback_months', Math.max(1, Number(e.target.value) || 1))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Max posts</label>
                            <Input
                              type="number" min={1} max={50}
                              value={form.post_limit}
                              onChange={e => set('post_limit', Math.max(1, Number(e.target.value) || 1))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sender info */}
                  <div className="border-t border-border pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      Your details
                      <span className="font-normal normal-case ml-1">— pre-fills email sign-offs</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
                        <Input
                          type="text"
                          value={form.sender_name}
                          onChange={e => set('sender_name', e.target.value)}
                          placeholder="Jane Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Your Company</label>
                        <Input
                          type="text"
                          value={form.sender_company}
                          onChange={e => set('sender_company', e.target.value)}
                          placeholder="Acme Inc"
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 flex items-center gap-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit || loading}
                    className={cn(
                      'w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm',
                      'bg-gradient-to-r from-primary to-violet-500 text-white',
                      'hover:from-primary/90 hover:to-violet-500/90',
                      'shadow-sm shadow-primary/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Launching pipeline…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Start Analysis
                      </>
                    )}
                  </button>

                  {!canSubmit && (
                    <p className="text-xs text-muted-foreground text-center -mt-2">
                      Fill in Company Name and Your Offering to continue
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Agent stages panel ─────────────────────── */}
          <div className="lg:col-span-2 space-y-2.5 animate-slide-up anim-delay-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              What happens next
            </p>

            {AGENT_STAGES.map((stage, i) => {
              const delayClass = `anim-delay-${Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}`;
              return (
                <div
                  key={i}
                  className={cn(
                    'bg-card rounded-2xl border border-border shadow-card px-4 py-3.5 flex items-start gap-3.5 animate-slide-up',
                    delayClass
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm',
                      stage.gradientClass
                    )}
                  >
                    <stage.Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                      <span className="text-[10px] text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5 flex-shrink-0 font-mono">
                        {stage.timing}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{stage.desc}</p>
                  </div>
                </div>
              );
            })}

            {/* Pipeline total estimate */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">~20–35 s gathering · ~8 s synthesis</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">After your review checkpoint</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
