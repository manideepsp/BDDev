'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getPipeline, getPipelineProspects, generatePOCPlan, generateEmailV2, generatePitchAssets,
  Pipeline, PipelineProspect, POCPlan, OutreachEmail, PitchAssets,
} from '@/lib/api';
import Feedback from '@/components/Feedback';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function EmailCard({ title, badge, subject, body }: { title: string; badge?: string; subject: string; body: string }) {
  const [fullCopied, setFullCopied] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        {badge && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject</p>
            <CopyBtn text={subject} />
          </div>
          <p className="text-sm text-slate-700">{subject}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Body</p>
            <CopyBtn text={body} />
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
            setFullCopied(true);
            setTimeout(() => setFullCopied(false), 2000);
          }}
          className="w-full text-sm border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg py-2 transition-colors"
        >
          {fullCopied ? '✓ Copied!' : '📋 Copy Full Email'}
        </button>
      </div>
    </div>
  );
}

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
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [pitchError, setPitchError] = useState('');
  const [loadingPOC, setLoadingPOC] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    sender_name: '',
    sender_company: '',
    sender_offering: '',
    tone: 'professional' as 'professional' | 'conversational' | 'bold',
  });
  const [emailError, setEmailError] = useState('');
  const [pocError, setPocError] = useState('');

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
      // Pre-fill sender info from pipeline
      if (p.sender_name || p.sender_company) {
        setEmailForm(f => ({ ...f, sender_name: p.sender_name ?? '', sender_company: p.sender_company ?? '' }));
      }
    }).catch(() => router.push('/'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, prospectId]);

  useEffect(() => {
    // Auto-generate POC plan if not already done
    if (prospect && !pocPlan && pipeline && !loadingPOC) {
      const senderName = emailForm.sender_name || pipeline.sender_name || '';
      const senderCompany = emailForm.sender_company || pipeline.sender_company || '';
      if (senderName || senderCompany) {
        handleGeneratePOC(senderName, senderCompany);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect, pipeline]);

  async function handleGeneratePOC(sName?: string, sCompany?: string) {
    if (!pipeline || !prospect) return;
    setLoadingPOC(true);
    setPocError('');
    try {
      const plan = await generatePOCPlan(pipelineId, {
        prospect_id: prospectId,
        sender_name: sName ?? emailForm.sender_name,
        sender_company: sCompany ?? emailForm.sender_company,
        user_description: pipeline.user_description,
      });
      setPocPlan(plan);
    } catch (err) {
      setPocError(err instanceof Error ? err.message : 'Failed to generate POC plan');
    } finally {
      setLoadingPOC(false);
    }
  }

  async function handleGenerateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailForm.sender_offering.trim()) return;
    setLoadingEmail(true);
    setEmailError('');
    try {
      const email = await generateEmailV2(pipelineId, {
        prospect_id: prospectId,
        ...emailForm,
      });
      setEmails(prev => [email, ...prev]);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleGeneratePitch() {
    if (!emailForm.sender_offering.trim()) {
      setPitchError('Add what you offer (below) first, then generate pitch assets.');
      return;
    }
    setLoadingPitch(true);
    setPitchError('');
    try {
      const assets = await generatePitchAssets(pipelineId, {
        prospect_id: prospectId,
        sender_name: emailForm.sender_name,
        sender_company: emailForm.sender_company,
        sender_offering: emailForm.sender_offering,
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
      <div className="p-8 flex items-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  const confidenceColors: Record<string, string> = {
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-slate-400 flex items-center gap-2 flex-wrap">
        <Link href="/" className="hover:text-indigo-600">Dashboard</Link>
        <span>/</span>
        <Link href={`/pipeline/${pipelineId}`} className="hover:text-indigo-600">{pipeline.company_name}</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{prospect.name}</span>
      </nav>

      {/* Prospect header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{prospect.name}</h1>
            <p className="text-slate-500 mt-0.5">{prospect.title} · {pipeline.company_name}</p>
            {prospect.contact_angle && (
              <p className="text-sm text-indigo-600 italic mt-2">💡 {prospect.contact_angle}</p>
            )}
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${confidenceColors[prospect.confidence] ?? confidenceColors.medium}`}>
            {prospect.confidence} confidence
          </span>
        </div>
        {prospect.relevance && (
          <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100">{prospect.relevance}</p>
        )}
      </div>

      {/* POC Plan section */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">POC Engagement Plan</p>
        {loadingPOC && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex items-center gap-3 text-slate-500">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ⚙️ Generating POC plan...
          </div>
        )}
        {pocError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-3">
            ⚠️ {pocError}
            <button onClick={() => handleGeneratePOC()} className="ml-3 underline">Retry</button>
          </div>
        )}
        {!pocPlan && !loadingPOC && !pocError && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500 mb-4">Enter your sender details below to generate a POC plan.</p>
          </div>
        )}
        {pocPlan && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Objective</p>
              <p className="text-sm font-medium text-indigo-900">{pocPlan.objective}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Approach</p>
                <p className="text-sm text-slate-700 leading-relaxed">{pocPlan.approach}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Value Proposition</p>
                <p className="text-sm text-slate-700 leading-relaxed">{pocPlan.value_proposition}</p>
                <p className="text-xs text-slate-400 mt-2">⏱ {pocPlan.timeline}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Talking Points</p>
                <ul className="space-y-1.5">
                  {pocPlan.talking_points.map((p, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                      <span className="text-indigo-400 flex-shrink-0">▸</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Success Metrics</p>
                <ul className="space-y-1.5">
                  {pocPlan.success_metrics.map((m, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                      <span className="text-emerald-400">✓</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Risks &amp; Objections</p>
                <ul className="space-y-1.5">
                  {pocPlan.risks.map((r, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                      <span className="text-red-400">⚠</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Generator */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Email Generator</p>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
          <form onSubmit={handleGenerateEmail} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={emailForm.sender_name}
                  onChange={e => setEmailForm(f => ({ ...f, sender_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Company</label>
                <input
                  type="text"
                  value={emailForm.sender_company}
                  onChange={e => setEmailForm(f => ({ ...f, sender_company: e.target.value }))}
                  placeholder="Acme Inc"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                What You Offer <span className="text-red-500">*</span>
              </label>
              <textarea
                value={emailForm.sender_offering}
                onChange={e => setEmailForm(f => ({ ...f, sender_offering: e.target.value }))}
                rows={2}
                placeholder="Describe your product/service..."
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tone</label>
              <div className="flex gap-2">
                {(['professional', 'conversational', 'bold'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEmailForm(f => ({ ...f, tone: t }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      emailForm.tone === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {emailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                ⚠️ {emailError}
              </div>
            )}
            <button
              type="submit"
              disabled={!emailForm.sender_offering.trim() || loadingEmail}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loadingEmail ? '⟳ Generating...' : '✨ Generate Personalized Email'}
            </button>
          </form>
        </div>

        {emails.map((email) => (
          <div key={email.id} className="space-y-4 mb-4">
            {email.personalization_hook && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  <span className="font-semibold">Anchored on:</span> {email.personalization_hook}
                </p>
              </div>
            )}
            <EmailCard title="Primary Email" subject={email.subject} body={email.body} />
            <EmailCard title="Follow-up Email" badge="Send 7 days later" subject={email.follow_up_subject} body={email.follow_up_body} />
            <div className="flex justify-end">
              <Feedback outputType="email" pipelineId={pipelineId} prospectId={prospectId} outputId={email.id} label="Rate this email:" />
            </div>
          </div>
        ))}
      </div>

      {/* Pitch Assets */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pitch Assets</p>
          <button
            onClick={handleGeneratePitch}
            disabled={loadingPitch}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loadingPitch ? '⟳ Generating...' : pitchAssets ? '↻ Regenerate Bundle' : '📦 Generate Full Pitch Bundle'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Uses the sender details &amp; offering you entered above. Produces an exec summary, two cold emails, a LinkedIn note, and discovery talking points.</p>

        {pitchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-3">⚠️ {pitchError}</div>
        )}

        {pitchAssets && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Executive Summary</p>
                <CopyBtn text={pitchAssets.executive_summary} />
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{pitchAssets.executive_summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmailCard title="Cold Email — Short" subject="(short version)" body={pitchAssets.cold_email_short} />
              <EmailCard title="Cold Email — Detailed" subject="(detailed version)" body={pitchAssets.cold_email_detailed} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">LinkedIn Connection Note</p>
                <CopyBtn text={pitchAssets.linkedin_message} />
              </div>
              <p className="text-sm text-slate-700">{pitchAssets.linkedin_message}</p>
              <p className="text-xs text-slate-400 mt-1">{pitchAssets.linkedin_message.length} chars</p>
            </div>

            {(pitchAssets.talking_points ?? []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Discovery Call Talking Points</p>
                <ul className="space-y-1.5">
                  {pitchAssets.talking_points.map((t, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-indigo-400 flex-shrink-0">▸</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Feedback outputType="pitch_assets" pipelineId={pipelineId} prospectId={prospectId} outputId={pitchAssets.id} label="Rate this bundle:" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
