'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getPipeline, getPipelineProspects, generatePOCPlan, generateEmailV2, generatePitchAssets,
  refineEmail, updateProspectStatusV2,
  Pipeline, PipelineProspect, POCPlan, OutreachEmail, PitchAssets,
} from '@/lib/api';
import Feedback from '@/components/Feedback';

// ── Email Refine Panel ────────────────────────────────────────────────────────

interface EmailHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

function RefinePanel({ emailId, initialContent, onApply }: {
  emailId: string;
  initialContent: string;
  field: 'body' | 'follow_up_body';
  onApply: (newContent: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [current, setCurrent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function handleSend() {
    if (!message.trim() || loading) return;
    const msg = message.trim();
    setMessage('');
    setLoading(true);
    setError('');
    try {
      const res = await refineEmail(emailId, { message: msg, current_content: current, history });
      setCurrent(res.content);
      setHistory(res.history as EmailHistoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refine failed');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors mt-2 flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Refine with AI
      </button>
    );
  }

  return (
    <div className="border-l-2 border-indigo-200 ml-4 pl-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Refine with AI</p>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Close</button>
      </div>
      {current !== initialContent && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Refined version</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{current}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => onApply(current)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors font-medium">Apply changes</button>
            <button onClick={() => { setCurrent(initialContent); setHistory([]); }} className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">Revert</button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${h.role === 'user' ? 'bg-slate-100 text-slate-700 ml-6' : 'bg-white border border-slate-200 text-slate-600 mr-6'}`}>
              <span className="font-medium text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">{h.role === 'user' ? 'You' : 'AI'}</span>
              {h.content.length > 120 ? h.content.slice(0, 120) + '…' : h.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input
          type="text" value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="e.g. Make it shorter, add more urgency..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={!message.trim() || loading} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors">
          {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function SubjectLinesCard({ lines, selected, onSelect }: {
  lines: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const labels = ['Provocative / insight-led', 'Relevance / trigger-based', 'Curiosity / question-driven'];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        3 Subject Line Variants — click to select
      </p>
      <div className="space-y-2">
        {lines.map((line, i) => line ? (
          <div
            key={i}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all ${
              selected === i
                ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              selected === i ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
            }`}>
              {selected === i && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 font-medium truncate">{line}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{labels[i]}</p>
            </div>
            <CopyBtn text={line} />
          </div>
        ) : null)}
      </div>
    </div>
  );
}

function EmailBodyCard({ title, badge, subject, body }: {
  title: string; badge?: string; subject: string; body: string;
}) {
  const [fullCopied, setFullCopied] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        {badge && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <div className="space-y-3">
        {subject && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject</p>
              <CopyBtn text={subject} />
            </div>
            <p className="text-sm text-slate-700">{subject}</p>
          </div>
        )}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Body</p>
            <CopyBtn text={body} />
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
            setFullCopied(true); setTimeout(() => setFullCopied(false), 2000);
          }}
          className="w-full text-sm border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg py-2 transition-colors"
        >
          {fullCopied ? '✓ Copied!' : '📋 Copy Full Email'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tone = 'professional' | 'conversational' | 'bold';

interface EmailForm {
  sender_name: string;
  sender_company: string;
  sender_offering: string;
  tone: Tone;
  trigger_event: string;
  linkedin_quote: string;
  word_limit: number;
}

export default function ProspectPage() {
  const params = useParams();
  const pipelineId = params.id as string;
  const prospectId = params.pid as string;
  const router = useRouter();

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [prospect, setProspect] = useState<PipelineProspect | null>(null);
  const [prospectStatus, setProspectStatus] = useState<string>('new');
  const [pocPlan, setPocPlan] = useState<POCPlan | null>(null);
  const [emails, setEmails] = useState<OutreachEmail[]>([]);
  const [emailBodies, setEmailBodies] = useState<Record<string, string>>({});
  const [selectedSubject, setSelectedSubject] = useState<number[]>([]);  // per email index
  const [pitchAssets, setPitchAssets] = useState<PitchAssets | null>(null);
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [loadingPOC, setLoadingPOC] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [pitchError, setPitchError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pocError, setPocError] = useState('');

  const [emailForm, setEmailForm] = useState<EmailForm>({
    sender_name: '',
    sender_company: '',
    sender_offering: '',
    tone: 'professional',
    trigger_event: '',
    linkedin_quote: '',
    word_limit: 150,
  });

  function setField(key: keyof EmailForm, value: string | number) {
    setEmailForm(f => ({ ...f, [key]: value }));
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
      setProspectStatus(found.prospect_status ?? 'new');
      if (found.poc_plan) setPocPlan(found.poc_plan);

      // Pre-fill form from pipeline data
      const recentDev = p.intelligence?.recent_developments?.[0] ?? '';
      setEmailForm(f => ({
        ...f,
        sender_name: p.sender_name ?? f.sender_name,
        sender_company: p.sender_company ?? f.sender_company,
        sender_offering: p.user_description ?? f.sender_offering,
        trigger_event: recentDev,
      }));
    }).catch(() => router.push('/'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, prospectId]);

  useEffect(() => {
    // Auto-generate POC plan when we have enough context and it isn't done yet
    if (prospect && !pocPlan && pipeline && !loadingPOC && !pocError) {
      const name = emailForm.sender_name || pipeline.sender_name || '';
      const company = emailForm.sender_company || pipeline.sender_company || '';
      if (name || company) handleGeneratePOC(name, company);
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
        sender_name: emailForm.sender_name,
        sender_company: emailForm.sender_company,
        sender_offering: emailForm.sender_offering,
        tone: emailForm.tone,
        trigger_event: emailForm.trigger_event || undefined,
        linkedin_quote: emailForm.linkedin_quote || undefined,
        word_limit: emailForm.word_limit,
      });
      setEmails(prev => [email, ...prev]);
      setSelectedSubject(prev => [0, ...prev]);  // default to first subject line for new email
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleGeneratePitch() {
    if (!emailForm.sender_offering.trim()) {
      setPitchError('Fill in "What You Offer" above first.');
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
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm text-slate-400 flex items-center gap-2 flex-wrap mb-3">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href={`/pipeline/${pipelineId}`} className="hover:text-indigo-600 transition-colors">{pipeline.company_name}</Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">{prospect.name}</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{prospect.name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{prospect.title} · {pipeline.company_name}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {prospect.seniority && prospect.seniority !== 'Unknown' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">{prospect.seniority}</span>
                )}
                {prospect.role_category && prospect.role_category !== 'Other' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{prospect.role_category}</span>
                )}
                {prospect.location && prospect.location !== 'Unknown' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">📍 {prospect.location}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={prospectStatus}
                onChange={async e => {
                  const s = e.target.value;
                  setProspectStatus(s);
                  await updateProspectStatusV2(prospect.id, s).catch(() => null);
                }}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="in_conversation">In Conversation</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="deprioritized">Deprioritized</option>
              </select>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${confidenceColors[prospect.confidence] ?? confidenceColors.medium}`}>
                {prospect.confidence} confidence
              </span>
            </div>
          </div>
          {prospect.contact_angle && (
            <div className="mt-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm text-indigo-700 italic">{prospect.contact_angle}</p>
            </div>
          )}
          {prospect.relevance && (
            <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-100">{prospect.relevance}</p>
          )}
          <div className="mt-3 flex items-center justify-end">
            <CopyBtn
              text={[
                `Name,Title,Company,Contact Angle,Confidence,Status`,
                `"${prospect.name}","${prospect.title}","${pipeline.company_name}","${prospect.contact_angle}","${prospect.confidence}","${prospectStatus}"`,
              ].join('\n')}
              label="Copy as CSV"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">

        {/* ── 1. POC Plan ─────────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">POC Engagement Plan</p>
          {loadingPOC && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex items-center gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Generating POC plan…
            </div>
          )}
          {pocError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-3 flex items-center justify-between">
              <span>⚠️ {pocError}</span>
              <button onClick={() => handleGeneratePOC()} className="underline ml-3 flex-shrink-0">Retry</button>
            </div>
          )}
          {!pocPlan && !loadingPOC && !pocError && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-sm text-slate-400">
              Enter your sender details below to auto-generate a POC plan.
            </div>
          )}
          {pocPlan && (
            <div className="space-y-4 animate-slide-up">
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Objective</p>
                <p className="text-sm font-semibold text-indigo-900">{pocPlan.objective}</p>
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
                        <span className="text-emerald-500">✓</span>{m}
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
        </section>

        {/* ── 2. Email Generator ───────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Personalised Cold Email</p>

          {/* Configuration form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
            {/* Form header */}
            <div className="px-6 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-medium text-slate-600">Configure the email — all fields feed directly into the generation prompt.</p>
            </div>

            <form onSubmit={handleGenerateEmail} className="px-6 py-5 space-y-5">

              {/* Sender */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">From (sender)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={emailForm.sender_name}
                      onChange={e => setField('sender_name', e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Your Company</label>
                    <input
                      type="text"
                      value={emailForm.sender_company}
                      onChange={e => setField('sender_company', e.target.value)}
                      placeholder="Acme Inc"
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Value proposition */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  What You Do — Value Proposition <span className="text-red-400">*</span>
                  <span className="font-normal text-slate-400 ml-1">1-2 sentences on how you help clients</span>
                </label>
                <textarea
                  value={emailForm.sender_offering}
                  onChange={e => setField('sender_offering', e.target.value)}
                  rows={2}
                  placeholder="e.g. We help Series-B+ SaaS companies reduce time-to-close by building AI-powered deal rooms that keep every stakeholder aligned."
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Trigger event */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Trigger Event / Opening Hook
                  <span className="ml-1.5 text-[10px] font-normal text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">pre-filled from research</span>
                </label>
                <textarea
                  value={emailForm.trigger_event}
                  onChange={e => setField('trigger_event', e.target.value)}
                  rows={2}
                  placeholder="Recent company news to anchor the opener on — funding round, product launch, expansion, hiring signal, a job opening that reveals a strategic shift..."
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  The prompt uses this as the email opener. Edit or clear it to use the top pain point instead.
                </p>
              </div>

              {/* LinkedIn quote */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  LinkedIn Quote / Interview Snippet
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">optional — overrides trigger event as the opener</span>
                </label>
                <textarea
                  value={emailForm.linkedin_quote}
                  onChange={e => setField('linkedin_quote', e.target.value)}
                  rows={2}
                  placeholder={`Paste a specific quote from the prospect's LinkedIn post or a recent interview — e.g. "We're doubling down on enterprise this year but our onboarding is still built for SMBs."`}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  When provided, this takes priority as the email opener — highest personalization signal.
                </p>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Tone</label>
                <div className="flex gap-2 flex-wrap">
                  {(['professional', 'conversational', 'bold'] as const).map(t => {
                    const desc: Record<string, string> = {
                      professional: 'Executive-to-executive, polished',
                      conversational: 'Warm, human, operator-to-operator',
                      bold: 'Provocative, leads with a sharp insight',
                    };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setField('tone', t)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                          emailForm.tone === t
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-900/20'
                            : 'text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                        title={desc[t]}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    );
                  })}
                  <p className="w-full text-[10px] text-slate-400 mt-0.5">
                    {emailForm.tone === 'professional' && 'Polished, executive-level. Reads like a respected peer.'}
                    {emailForm.tone === 'conversational' && 'Warm and human. One operator writing to another.'}
                    {emailForm.tone === 'bold' && 'Opens with a sharp insight or number. Earns attention fast.'}
                  </p>
                </div>
              </div>

              {/* Word limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600">Body Word Limit</label>
                  <span className="text-sm font-bold text-indigo-600 tabular-nums">{emailForm.word_limit} words</span>
                </div>
                <input
                  type="range"
                  min={75}
                  max={500}
                  step={25}
                  value={emailForm.word_limit}
                  onChange={e => setField('word_limit', String(Number(e.target.value)))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>75 — ultra-short</span>
                  <span>150 — recommended</span>
                  <span>500 — detailed</span>
                </div>
              </div>

              {emailError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 animate-fade-in">
                  ⚠️ {emailError}
                </div>
              )}

              <button
                type="submit"
                disabled={!emailForm.sender_offering.trim() || loadingEmail}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 text-white font-medium py-3 rounded-lg transition-all shadow-sm shadow-indigo-900/20 flex items-center justify-center gap-2"
              >
                {loadingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Writing your email…
                  </>
                ) : (
                  '✨ Generate Personalised Email'
                )}
              </button>
            </form>
          </div>

          {/* Generated emails */}
          {emails.map((email, emailIdx) => (
            <div key={email.id} className="space-y-4 mb-8 animate-slide-up">
              {/* Personalization transparency note */}
              {email.personalization_hook && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    <span className="font-semibold">Opener anchored on:</span> {email.personalization_hook}
                  </p>
                </div>
              )}

              {/* 3 subject line variants */}
              {email.subject_lines && email.subject_lines.filter(Boolean).length > 0 && (
                <SubjectLinesCard
                  lines={email.subject_lines}
                  selected={selectedSubject[emailIdx] ?? 0}
                  onSelect={i => setSelectedSubject(prev => {
                    const next = [...prev]; next[emailIdx] = i; return next;
                  })}
                />
              )}

              {/* Primary email body (uses selected subject line) */}
              <EmailBodyCard
                title="Primary Email"
                subject={
                  email.subject_lines && email.subject_lines.filter(Boolean).length > 0
                    ? (email.subject_lines[selectedSubject[emailIdx] ?? 0] ?? email.subject)
                    : email.subject
                }
                body={emailBodies[email.id ?? ''] ?? email.body}
              />
              {email.id && (
                <RefinePanel
                  emailId={email.id}
                  initialContent={email.body}
                  field="body"
                  onApply={content => setEmailBodies(prev => ({ ...prev, [email.id!]: content }))}
                />
              )}

              {/* Follow-up */}
              <EmailBodyCard
                title="Follow-up"
                badge="Send 5–7 days later"
                subject={email.follow_up_subject}
                body={email.follow_up_body}
              />

              {/* Keywords used */}
              {email.keywords_used && email.keywords_used.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signals woven in:</span>
                  {email.keywords_used.map(k => (
                    <span key={k} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{k}</span>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Feedback outputType="email" pipelineId={pipelineId} prospectId={prospectId} outputId={email.id} label="Rate this email:" />
              </div>
            </div>
          ))}
        </section>

        {/* ── 3. Pitch Assets (bundle) ─────────────────────────────────────────── */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Pitch Bundle</p>
            <button
              onClick={handleGeneratePitch}
              disabled={loadingPitch}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loadingPitch && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loadingPitch ? 'Generating…' : pitchAssets ? '↻ Regenerate Bundle' : '📦 Generate Full Pitch Bundle'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">Exec summary · 2 cold emails · LinkedIn note · 5 discovery talking points — all in one call.</p>

          {pitchError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 animate-fade-in">⚠️ {pitchError}</div>
          )}

          {pitchAssets && (
            <div className="space-y-4 animate-slide-up">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Executive Summary</p>
                  <CopyBtn text={pitchAssets.executive_summary} />
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{pitchAssets.executive_summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EmailBodyCard title="Cold Email — Short" subject="" body={pitchAssets.cold_email_short} />
                <EmailBodyCard title="Cold Email — Detailed" subject="" body={pitchAssets.cold_email_detailed} />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">LinkedIn Connection Note</p>
                  <CopyBtn text={pitchAssets.linkedin_message} />
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{pitchAssets.linkedin_message}</p>
                <p className="text-xs text-slate-400 mt-2">{pitchAssets.linkedin_message?.length ?? 0} chars</p>
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
        </section>
      </div>
    </div>
  );
}
