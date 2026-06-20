'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getPipeline, getPipelineProspects, generatePOCPlan, generateEmailV2, generatePitchAssets,
  recordDealOutcome,
  Pipeline, PipelineProspect, POCPlan, OutreachEmail, PitchAssets,
} from '@/lib/api';
import Feedback from '@/components/Feedback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ── Utility ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

// ── Outreach result card — handles all 5 message types ────────────────────────

const TYPE_META: Record<string, { icon: string; label: string; channel: string }> = {
  cold_email:          { icon: '✉', label: 'Cold Email',          channel: 'Email' },
  follow_up_email:     { icon: '↩', label: 'Follow-up Email',     channel: 'Email' },
  linkedin_message:    { icon: '🔗', label: 'LinkedIn Message',    channel: 'LinkedIn' },
  linkedin_connection: { icon: '🔗', label: 'Connection Request',  channel: 'LinkedIn' },
  call_script:         { icon: '📞', label: 'Call Script',         channel: 'Phone' },
};

function OutreachResultCard({ email }: { email: OutreachEmail }) {
  const [fullCopied, setFullCopied] = useState(false);
  const mtype = email.message_type ?? 'cold_email';
  const meta = TYPE_META[mtype] ?? TYPE_META.cold_email;
  const isEmail = mtype === 'cold_email' || mtype === 'follow_up_email';
  const isLinkedin = mtype === 'linkedin_message' || mtype === 'linkedin_connection';
  const isCall = mtype === 'call_script';

  return (
    <Card className="overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className="text-sm font-semibold text-foreground">{meta.label}</span>
          <Badge variant="secondary" className="text-[10px]">{meta.channel}</Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">{new Date(email.created_at).toLocaleTimeString()}</span>
      </div>

      <CardContent className="p-5 space-y-3">
        {/* Context strip */}
        {(email.personalization_hook || email.persona_angle) && (
          <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-2.5 space-y-1">
            {email.personalization_hook && (
              <p className="text-xs text-primary/80">
                <span className="font-semibold">Anchored on:</span> {email.personalization_hook}
              </p>
            )}
            {email.persona_angle && (
              <p className="text-xs text-primary/60 italic">{email.persona_angle.split(':')[0]} persona</p>
            )}
          </div>
        )}

        {/* Subject (email only) */}
        {isEmail && email.subject && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject Line</p>
              <CopyBtn text={email.subject} />
            </div>
            <p className="text-sm font-medium text-foreground">{email.subject}</p>
          </div>
        )}

        {/* Body */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isCall ? 'Opening Script (30 sec)' : isLinkedin ? 'Message' : 'Body'}
              {isLinkedin && email.body && (
                <span className="ml-2 normal-case text-muted-foreground">({email.body.length} chars)</span>
              )}
            </p>
            <CopyBtn text={email.body} />
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{email.body}</p>
        </div>

        {/* Voicemail (call_script) */}
        {isCall && email.voicemail && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Voicemail (20 sec)</p>
              <CopyBtn text={email.voicemail} />
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{email.voicemail}</p>
          </div>
        )}

        {/* Copy full email button */}
        {isEmail && email.subject && email.body && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
              setFullCopied(true); setTimeout(() => setFullCopied(false), 2000);
            }}
            className="w-full text-sm border border-border text-primary hover:bg-primary/5 rounded-lg py-2 transition-colors"
          >
            {fullCopied ? '✓ Copied!' : '📋 Copy Full Email'}
          </button>
        )}

        {/* Rationale */}
        {email.rationale && (
          <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
            Why this approach: {email.rationale}
          </p>
        )}

        {/* Keywords used */}
        {(email.keywords_used ?? []).length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signals woven in:</span>
            {email.keywords_used!.map(k => (
              <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── DealOutcomeModal ──────────────────────────────────────────────────────────

function DealOutcomeModal({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | 'dead' | null>(null);
  const [dealSize, setDealSize] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!selectedOutcome) return;
    setSaving(true); setError('');
    try {
      await recordDealOutcome(pipelineId, {
        outcome: selectedOutcome,
        actual_deal_size: dealSize || undefined,
        loss_reason: selectedOutcome === 'won' ? undefined : (lossReason || undefined),
        notes: notes || undefined,
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg">Record Deal Outcome</CardTitle>
          <p className="text-xs text-muted-foreground">Calibrates ICP scores over time — after 20+ outcomes, the system shows win rates per score band.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(['won', 'lost', 'dead'] as const).map(o => (
              <button key={o} onClick={() => setSelectedOutcome(o)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  selectedOutcome === o
                    ? o === 'won' ? 'bg-emerald-600 text-white border-emerald-600'
                    : o === 'lost' ? 'bg-destructive text-destructive-foreground border-destructive'
                    : 'bg-muted text-foreground border-border'
                    : 'text-muted-foreground border-border hover:border-foreground/30'
                )}>
                {o === 'won' ? '🎉 Won' : o === 'lost' ? '❌ Lost' : '💀 Dead'}
              </button>
            ))}
          </div>
          {!selectedOutcome && <p className="text-xs text-muted-foreground mt-1">Select an outcome above</p>}
          {selectedOutcome === 'won' && (
            <Input value={dealSize} onChange={e => setDealSize(e.target.value)}
              placeholder="Actual deal size (e.g. $120K)" />
          )}
          {(selectedOutcome === 'lost' || selectedOutcome === 'dead') && (
            <Input value={lossReason} onChange={e => setLossReason(e.target.value)}
              placeholder="Loss reason (e.g. budget freeze, chose competitor)" />
          )}
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Notes (optional)" className="resize-none" />
          {error && <p className="text-xs text-destructive">⚠ {error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!selectedOutcome || saving || saved} className="flex-1">
              {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Outcome'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type MessageType = 'cold_email' | 'follow_up_email' | 'linkedin_message' | 'linkedin_connection' | 'call_script';
type Tone = 'professional' | 'conversational' | 'bold';

interface OutreachForm {
  sender_name: string;
  sender_company: string;
  sender_offering: string;
  tone: Tone;
  trigger_event: string;
  linkedin_quote: string;
  pain_focus: string;
}

const MESSAGE_TYPES: { value: MessageType; icon: string; label: string; desc: string }[] = [
  { value: 'cold_email',          icon: '✉',  label: 'Cold Email',         desc: '60-100 words, opening hook' },
  { value: 'follow_up_email',     icon: '↩',  label: 'Follow-up',          desc: 'New angle, 40-60 words' },
  { value: 'linkedin_message',    icon: '🔗', label: 'LinkedIn Message',    desc: '300-500 chars, no pitch dump' },
  { value: 'linkedin_connection', icon: '🔗', label: 'Connection Request',  desc: '≤280 chars, specific reason' },
  { value: 'call_script',         icon: '📞', label: 'Call Script',         desc: '30-sec script + voicemail' },
];

export default function ProspectPage() {
  const params = useParams();
  const pipelineId = params.id as string;
  const prospectId = params.pid as string;
  const router = useRouter();

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [prospect, setProspect] = useState<PipelineProspect | null>(null);
  const [pocPlan, setPocPlan] = useState<POCPlan | null>(null);
  const [emails, setEmails] = useState<OutreachEmail[]>([]);
  const [pitchAssets, setPitchAssets] = useState<PitchAssets | null>(null);

  const [messageType, setMessageType] = useState<MessageType>('cold_email');
  const [wordLimit, setWordLimit] = useState<number>(150);
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [loadingPOC, setLoadingPOC] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [pitchError, setPitchError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pocError, setPocError] = useState('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState<OutreachForm>({
    sender_name: '',
    sender_company: '',
    sender_offering: '',
    tone: 'professional',
    trigger_event: '',
    linkedin_quote: '',
    pain_focus: '',
  });

  function setField(key: keyof OutreachForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    Promise.all([
      getPipeline(pipelineId),
      getPipelineProspects(pipelineId),
    ]).then(([p, prospects]) => {
      setPipeline(p);
      const found = prospects.find(pr => pr.id === prospectId);
      if (!found) { router.push(`/pipeline/${pipelineId}`); return; }
      setProspect(found);
      if (found.poc_plan) setPocPlan(found.poc_plan);

      // Pre-fill form — urgency_trigger.angle > recent_developments[0]
      const urgencyAngle = (p.intelligence as { urgency_trigger?: { angle?: string } } | undefined)?.urgency_trigger?.angle ?? '';
      const recentDev = p.intelligence?.recent_developments?.[0] ?? '';
      setForm(f => ({
        ...f,
        sender_name: p.sender_name ?? f.sender_name,
        sender_company: p.sender_company ?? f.sender_company,
        sender_offering: p.user_description ?? f.sender_offering,
        trigger_event: urgencyAngle || recentDev,
      }));
    }).catch(() => router.push('/'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, prospectId]);

  useEffect(() => {
    if (prospect && !pocPlan && pipeline && !loadingPOC && !pocError) {
      const name = form.sender_name || pipeline.sender_name || '';
      const company = form.sender_company || pipeline.sender_company || '';
      if (name || company) handleGeneratePOC(name, company);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect, pipeline]);

  async function handleGeneratePOC(sName?: string, sCompany?: string) {
    if (!pipeline || !prospect) return;
    setLoadingPOC(true); setPocError('');
    try {
      const plan = await generatePOCPlan(pipelineId, {
        prospect_id: prospectId,
        sender_name: sName ?? form.sender_name,
        sender_company: sCompany ?? form.sender_company,
        user_description: pipeline.user_description,
      });
      setPocPlan(plan);
    } catch (err) {
      setPocError(err instanceof Error ? err.message : 'Failed to generate POC plan');
    } finally {
      setLoadingPOC(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sender_offering.trim()) return;
    setLoadingEmail(true); setEmailError('');
    try {
      const email = await generateEmailV2(pipelineId, {
        prospect_id: prospectId,
        sender_name: form.sender_name,
        sender_company: form.sender_company,
        sender_offering: form.sender_offering,
        tone: form.tone,
        message_type: messageType,
        trigger_event: form.trigger_event || undefined,
        linkedin_quote: form.linkedin_quote || undefined,
        pain_focus: form.pain_focus || undefined,
        word_limit: wordLimit,
      });
      setEmails(prev => [email, ...prev]);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleGeneratePitch() {
    if (!form.sender_offering.trim()) { setPitchError('Fill in "What You Offer" above first.'); return; }
    setLoadingPitch(true); setPitchError('');
    try {
      const assets = await generatePitchAssets(pipelineId, {
        prospect_id: prospectId,
        sender_name: form.sender_name,
        sender_company: form.sender_company,
        sender_offering: form.sender_offering,
      });
      setPitchAssets(assets);
    } catch (err) {
      setPitchError(err instanceof Error ? err.message : 'Failed to generate pitch assets');
    } finally {
      setLoadingPitch(false);
    }
  }

  if (!prospect || !pipeline) {
    return (
      <div className="p-8 flex items-center gap-3 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  const confidenceVariant: Record<string, 'high' | 'medium' | 'low'> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  const painPoints = pipeline.intelligence?.pain_points ?? [];
  const isEmailType = messageType === 'cold_email' || messageType === 'follow_up_email';
  const currentTypeMeta = TYPE_META[messageType];
  const urgencyTrigger = (pipeline.intelligence as { urgency_trigger?: { angle?: string } } | undefined)?.urgency_trigger;

  return (
    <div className="min-h-screen bg-background">
      {showOutcomeModal && (
        <DealOutcomeModal pipelineId={pipelineId} onClose={() => setShowOutcomeModal(false)} />
      )}

      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mb-3">
            <Link href="/" className="hover:text-primary transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href={`/pipeline/${pipelineId}`} className="hover:text-primary transition-colors">{pipeline.company_name}</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{prospect.name}</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-foreground">{prospect.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{prospect.title} · {pipeline.company_name}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={confidenceVariant[prospect.confidence] ?? 'secondary'}>
                {prospect.confidence} confidence
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOutcomeModal(true)}
              >
                📊 Record Outcome
              </Button>
            </div>
          </div>
          {prospect.contact_angle && (
            <div className="mt-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm text-primary/80 italic">{prospect.contact_angle}</p>
            </div>
          )}
          {prospect.relevance && (
            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border">{prospect.relevance}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">

        {/* ── 1. POC Plan ─────────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">POC Engagement Plan</p>
          {loadingPOC && (
            <Card>
              <CardContent className="p-8 flex items-center gap-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Generating POC plan…
              </CardContent>
            </Card>
          )}
          {pocError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm mb-3 flex items-center justify-between">
              <span>⚠️ {pocError}</span>
              <button onClick={() => handleGeneratePOC()} className="underline ml-3 flex-shrink-0">Retry</button>
            </div>
          )}
          {!pocPlan && !loadingPOC && !pocError && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Enter your sender details below to auto-generate a POC plan.
              </CardContent>
            </Card>
          )}
          {pocPlan && (
            <div className="space-y-4 animate-slide-up">
              {pocPlan.deal_type && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Detected deal type:</span>
                  <Badge variant="secondary">{pocPlan.deal_type.replace('_', ' ')}</Badge>
                </div>
              )}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1.5">Objective</p>
                  <p className="text-sm font-semibold text-foreground">{pocPlan.objective}</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Approach</p>
                    <p className="text-sm text-foreground leading-relaxed">{pocPlan.approach}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Value Proposition</p>
                    <p className="text-sm text-foreground leading-relaxed">{pocPlan.value_proposition}</p>
                    <p className="text-xs text-muted-foreground mt-2">⏱ {pocPlan.timeline}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Talking Points</p>
                    <ul className="space-y-1.5">
                      {pocPlan.talking_points.map((p, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span className="text-primary flex-shrink-0">▸</span>{p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Success Metrics</p>
                    <ul className="space-y-1.5">
                      {pocPlan.success_metrics.map((m, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span className="text-emerald-500">✓</span>{m}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risks &amp; Objections</p>
                    <ul className="space-y-1.5">
                      {pocPlan.risks.map((r, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span className="text-amber-400">⚠</span>{r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end">
                <Feedback outputType="poc_plan" pipelineId={pipelineId} prospectId={prospectId} outputId={prospectId} label="Rate this plan:" />
              </div>
            </div>
          )}
        </section>

        {/* ── 2. Outreach Generator ────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Outreach Generator</p>

          <Card className="overflow-hidden mb-5">
            {/* Step 1 — message type picker */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <p className="text-xs font-semibold text-foreground mb-3">What do you want to generate?</p>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    type="button"
                    onClick={() => setMessageType(mt.value)}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all',
                      messageType === mt.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                    )}
                  >
                    <span>{mt.icon}</span>
                    <span>{mt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{MESSAGE_TYPES.find(m => m.value === messageType)?.desc}</p>
            </div>

            {/* Step 2 — pain focus (if pain points exist) */}
            {painPoints.length > 0 && (
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Anchor on pain point <span className="font-normal text-muted-foreground">(optional — defaults to top pain)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setField('pain_focus', '')}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg border transition-all',
                      !form.pain_focus
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    Auto (top pain)
                  </button>
                  {painPoints.map((pp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setField('pain_focus', pp.title)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg border transition-all max-w-[240px] truncate',
                        form.pain_focus === pp.title
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'text-muted-foreground border-border hover:border-primary/30 hover:text-primary'
                      )}
                      title={pp.title}
                    >
                      <span className={cn(
                        'mr-1.5',
                        pp.severity === 'high' ? 'text-destructive' : pp.severity === 'medium' ? 'text-amber-400' : 'text-muted-foreground'
                      )}>●</span>
                      {pp.title.length > 40 ? pp.title.slice(0, 40) + '…' : pp.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — form fields */}
            <form onSubmit={handleGenerate} className="px-6 py-5 space-y-5">

              {/* Sender */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">From (sender)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Your Name</label>
                    <Input
                      type="text"
                      value={form.sender_name}
                      onChange={e => setField('sender_name', e.target.value)}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Your Company</label>
                    <Input
                      type="text"
                      value={form.sender_company}
                      onChange={e => setField('sender_company', e.target.value)}
                      placeholder="Acme Inc"
                    />
                  </div>
                </div>
              </div>

              {/* Value prop */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  What You Do — Value Proposition <span className="text-destructive">*</span>
                  <span className="font-normal text-muted-foreground ml-1">1-2 sentences on how you help clients</span>
                </label>
                <Textarea
                  value={form.sender_offering}
                  onChange={e => setField('sender_offering', e.target.value)}
                  rows={2}
                  placeholder="e.g. We help Series-B+ SaaS companies reduce time-to-close by building AI-powered deal rooms."
                  className="resize-none"
                />
              </div>

              {/* Opening Hook — pre-filled with urgency_trigger.angle */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Opening Hook / Trigger Event
                  {urgencyTrigger?.angle && (
                    <span className="ml-1.5 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded">from urgency signal</span>
                  )}
                </label>
                <Textarea
                  value={form.trigger_event}
                  onChange={e => setField('trigger_event', e.target.value)}
                  rows={2}
                  placeholder="The specific signal to anchor the opener on — funding round, layoff news, hiring surge, product launch..."
                  className="resize-none"
                />
              </div>

              {/* Advanced toggle */}
              <button type="button" onClick={() => setShowAdvanced(a => !a)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <svg className={cn('w-3.5 h-3.5 transition-transform', showAdvanced ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {showAdvanced ? 'Hide' : 'Show'} advanced options (LinkedIn quote)
              </button>

              {showAdvanced && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    LinkedIn Quote / Interview Snippet
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">overrides trigger event as the opener</span>
                  </label>
                  <Textarea
                    value={form.linkedin_quote}
                    onChange={e => setField('linkedin_quote', e.target.value)}
                    rows={2}
                    placeholder="Paste a specific quote from their LinkedIn post or a recent interview..."
                    className="resize-none"
                  />
                </div>
              )}

              {/* Tone — email types only */}
              {isEmailType && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">Tone</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['professional', 'conversational', 'bold'] as const).map(t => {
                      const desc: Record<string, string> = {
                        professional: 'Executive-to-executive, polished',
                        conversational: 'Warm, human, operator-to-operator',
                        bold: 'Provocative, leads with a sharp insight',
                      };
                      return (
                        <button key={t} type="button" onClick={() => setField('tone', t)}
                          className={cn(
                            'flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                            form.tone === t
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                          )} title={desc[t]}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {form.tone === 'professional' && 'Polished, executive-level. Reads like a respected peer.'}
                    {form.tone === 'conversational' && 'Warm and human. One operator writing to another.'}
                    {form.tone === 'bold' && 'Opens with a sharp insight or number. Earns attention fast.'}
                  </p>
                </div>
              )}

              {/* Word limit */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Word Count
                </label>
                <input
                  type="number"
                  min={50}
                  max={500}
                  step={10}
                  value={wordLimit}
                  onChange={e => setWordLimit(Math.min(500, Math.max(50, Number(e.target.value))))}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground mt-1">50 = punchy one-liner, 150 = standard cold email, 500 = long-form</p>
              </div>

              {emailError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                  ⚠️ {emailError}
                </div>
              )}

              <Button
                type="submit"
                disabled={!form.sender_offering.trim() || loadingEmail}
                className="w-full"
              >
                {loadingEmail ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Generating {currentTypeMeta.label}…
                  </span>
                ) : (
                  `${currentTypeMeta.icon} Generate ${currentTypeMeta.label}`
                )}
              </Button>
            </form>
          </Card>

          {/* Generated outputs */}
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id}>
                <OutreachResultCard email={email} />
                <div className="flex justify-end mt-2">
                  <Feedback outputType="email" pipelineId={pipelineId} prospectId={prospectId} outputId={email.id} label="Rate this:" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Full Pitch Bundle ─────────────────────────────────────────────── */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Full Pitch Bundle</p>
              <p className="text-xs text-muted-foreground mt-0.5">Exec summary · 2 cold emails · LinkedIn note · 5 discovery talking points</p>
            </div>
            <Button
              onClick={handleGeneratePitch}
              disabled={loadingPitch}
              size="sm"
            >
              {loadingPitch && <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin mr-2" />}
              {loadingPitch ? 'Generating…' : pitchAssets ? '↻ Regenerate Bundle' : '📦 Generate Pitch Bundle'}
            </Button>
          </div>

          {pitchError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4">⚠️ {pitchError}</div>
          )}

          {pitchAssets && (
            <div className="space-y-4 animate-slide-up">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Executive Summary</p>
                    <CopyBtn text={pitchAssets.executive_summary} />
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{pitchAssets.executive_summary}</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Cold Email — Short', body: pitchAssets.cold_email_short },
                  { title: 'Cold Email — Detailed', body: pitchAssets.cold_email_detailed },
                ].map(e => (
                  <Card key={e.title}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{e.title}</p>
                        <CopyBtn text={e.body} />
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{e.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn Connection Note</p>
                    <CopyBtn text={pitchAssets.linkedin_message} />
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{pitchAssets.linkedin_message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{pitchAssets.linkedin_message?.length ?? 0} chars</p>
                </CardContent>
              </Card>
              {(pitchAssets.talking_points ?? []).length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Discovery Call Talking Points</p>
                    <ul className="space-y-1.5">
                      {pitchAssets.talking_points.map((t, i) => (
                        <li key={i} className="text-sm text-foreground flex gap-2">
                          <span className="text-primary flex-shrink-0">▸</span>{t}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end">
                <Feedback outputType="pitch_assets" pipelineId={pipelineId} prospectId={prospectId} outputId={pitchAssets.id} label="Rate this bundle:" />
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
