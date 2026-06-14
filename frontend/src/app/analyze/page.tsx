'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAnalysis } from '@/lib/api';

const AGENT_STAGES = [
  {
    icon: '🌐',
    label: 'Website + LinkedIn',
    desc: 'Parallel scrape of the company site and LinkedIn org schema — homepage, /about, /products, founders.',
    color: 'from-blue-500 to-cyan-500',
    timing: '~3 s',
  },
  {
    icon: '📣',
    label: 'Posts & Open Roles',
    desc: 'Recent announcements and job listings as live BD signals — what are they building, who are they hiring?',
    color: 'from-violet-500 to-purple-500',
    timing: '~4 s',
  },
  {
    icon: '🐝',
    label: 'People Swarm',
    desc: 'One enrichment agent per discovered person runs in parallel — seniority, role category, BD relevance.',
    color: 'from-amber-500 to-orange-500',
    timing: '~5 s',
  },
  {
    icon: '🔍',
    label: 'Keywords + Web Research',
    desc: 'LLM distils themes, then fires 4 targeted searches across news, competitive, financial and market angles.',
    color: 'from-indigo-500 to-violet-500',
    timing: '~6 s',
  },
  {
    icon: '🗂️',
    label: 'RAG Indexing',
    desc: 'Every gathered fact is embedded (fastembed, 384-dim ONNX) and stored in a per-pipeline Qdrant namespace.',
    color: 'from-teal-500 to-emerald-500',
    timing: '~4 s',
  },
  {
    icon: '✋',
    label: 'Your Review',
    desc: 'Pipeline pauses — you prune irrelevant people, add context, exclude noisy posts. Quality over speed.',
    color: 'from-slate-500 to-slate-600',
    timing: 'your call',
  },
  {
    icon: '🧠',
    label: 'RAG-Grounded Insights',
    desc: 'Synthesis queries retrieve top evidence chunks, then the LLM writes an evidence-first intelligence report.',
    color: 'from-rose-500 to-pink-500',
    timing: '~8 s',
  },
];

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const DEAL_OPTIONS = ['Small', 'Mid', 'Enterprise'];

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
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">New Company Analysis</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              7-agent pipeline · RAG-grounded synthesis · human-in-the-loop checkpoint
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse flex-shrink-0" />
            Ready to launch
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── LEFT: Form ──────────────────────────────────────── */}
          <div className="lg:col-span-3 animate-slide-up">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target + Offering</p>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                {/* Company name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Company Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="e.g. Stripe, Notion, Figma"
                    autoFocus
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Company Website
                    <span className="ml-2 text-xs font-normal text-slate-400">optional — improves scraping quality</span>
                  </label>
                  <input
                    type="url"
                    value={form.company_url}
                    onChange={e => set('company_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  />
                </div>

                {/* Your offering */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">
                      Your Offering <span className="text-red-400">*</span>
                    </label>
                    <span className={`text-xs tabular-nums ${descWarn ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      {descChars}/500
                    </span>
                  </div>
                  <textarea
                    value={form.user_description}
                    onChange={e => set('user_description', e.target.value.slice(0, 500))}
                    rows={4}
                    placeholder="Describe what you do and what you're pitching to this company. The more specific, the sharper the intelligence report."
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
                  />
                  {descWarn && (
                    <p className="text-xs text-amber-600 mt-1">Getting close to the limit — keep it focused for best results.</p>
                  )}
                </div>

                {/* Deal size + Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Deal Size</label>
                    <div className="flex gap-1.5">
                      {DEAL_OPTIONS.map(opt => (
                        <button
                          key={opt} type="button"
                          onClick={() => set('deal_size', form.deal_size === opt ? '' : opt)}
                          className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-all ${
                            form.deal_size === opt
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                    <div className="flex gap-1.5">
                      {PRIORITY_OPTIONS.map(opt => {
                        const colors = { High: 'border-red-400 bg-red-50 text-red-700', Medium: 'border-amber-400 bg-amber-50 text-amber-700', Low: 'border-slate-400 bg-slate-100 text-slate-600' };
                        return (
                          <button
                            key={opt} type="button"
                            onClick={() => set('priority', form.priority === opt ? '' : opt)}
                            className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-all ${
                              form.priority === opt
                                ? colors[opt as keyof typeof colors]
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Advanced toggle */}
                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setAdvanced(v => !v)}
                    className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${advanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Advanced settings
                    <span className="font-normal text-slate-400">— LinkedIn URL, notes, post lookback</span>
                  </button>

                  {advanced && (
                    <div className="mt-4 space-y-4 animate-slide-up">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Company LinkedIn</label>
                        <input
                          type="url"
                          value={form.linkedin_url}
                          onChange={e => set('linkedin_url', e.target.value)}
                          placeholder="https://linkedin.com/company/..."
                          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes on this Target</label>
                        <textarea
                          value={form.notes}
                          onChange={e => set('notes', e.target.value)}
                          rows={2}
                          placeholder="Known context — a warm intro, a specific pain point, recent news you want the agent to focus on..."
                          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Post lookback (months)</label>
                          <input
                            type="number" min={1} max={24}
                            value={form.post_lookback_months}
                            onChange={e => set('post_lookback_months', Math.max(1, Number(e.target.value) || 1))}
                            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Max posts</label>
                          <input
                            type="number" min={1} max={50}
                            value={form.post_limit}
                            onChange={e => set('post_limit', Math.max(1, Number(e.target.value) || 1))}
                            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sender info */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Your details <span className="font-normal normal-case">— pre-fills email sign-offs</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Name</label>
                      <input
                        type="text" value={form.sender_name}
                        onChange={e => set('sender_name', e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Company</label>
                      <input
                        type="text" value={form.sender_company}
                        onChange={e => set('sender_company', e.target.value)}
                        placeholder="Acme Inc"
                        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 animate-fade-in">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 text-white font-medium py-3 rounded-lg transition-all shadow-sm shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Launching pipeline…
                    </>
                  ) : (
                    'Start Analysis →'
                  )}
                </button>

                {!canSubmit && (
                  <p className="text-xs text-slate-400 text-center -mt-2">
                    Fill in Company Name and Your Offering to continue
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* ── RIGHT: Agent stages preview ──────────────────────── */}
          <div className="lg:col-span-2 space-y-3 animate-slide-up anim-delay-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              What happens next
            </p>
            {AGENT_STAGES.map((stage, i) => (
              <div
                key={i}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 flex items-start gap-3.5 animate-slide-up anim-delay-${Math.min(i + 1, 4) as 1 | 2 | 3 | 4}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stage.color} flex items-center justify-center flex-shrink-0 text-base shadow-sm`}>
                  {stage.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0 font-mono">
                      {stage.timing}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{stage.desc}</p>
                </div>
              </div>
            ))}

            {/* Pipeline total estimate */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-800">~20–35 s gathering · ~8 s synthesis</p>
                <p className="text-[11px] text-indigo-500 mt-0.5">After your review checkpoint</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
