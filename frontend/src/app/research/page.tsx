'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { researchCompany } from '@/lib/api';

const LOADING_STEPS = [
  'Analyzing company profile...',
  'Identifying key stakeholders...',
  'Mapping competitive landscape...',
  'Detecting business pain points...',
  'Scoring BD opportunities...',
  'Generating intelligence report...',
];

const CAPABILITIES = [
  {
    icon: '🏢',
    title: 'Company Overview',
    desc: 'Industry, size, HQ, business model',
  },
  {
    icon: '⚡',
    title: 'Pain Points',
    desc: 'Specific challenges they face today',
  },
  {
    icon: '🎯',
    title: 'BD Opportunities',
    desc: 'Actionable entry points for your pitch',
  },
  {
    icon: '👥',
    title: 'Key Stakeholders',
    desc: 'Who to reach and why',
  },
  {
    icon: '🔄',
    title: 'Competitive Intel',
    desc: 'Market position and differentiators',
  },
  {
    icon: '✉️',
    title: 'Outreach Drafts',
    desc: 'Personalized email with follow-up',
  },
];

export default function ResearchPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '',
    company_url: '',
    additional_context: '',
  });
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;

    setLoading(true);
    setError('');
    setStepIdx(0);

    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 1800);

    try {
      const result = await researchCompany({
        company_name: form.company_name.trim(),
        company_url: form.company_url || undefined,
        additional_context: form.additional_context || undefined,
      });
      clearInterval(interval);
      router.push(`/prospects/${result.prospect_id}`);
    } catch (err) {
      clearInterval(interval);
      setError(
        err instanceof Error ? err.message : 'Research failed. Please try again.'
      );
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="max-w-sm w-full text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1">
            Researching {form.company_name}
          </h2>
          <p className="text-indigo-600 text-sm font-medium h-5 transition-all duration-300">
            {LOADING_STEPS[stepIdx]}
          </p>

          <div className="mt-5 flex gap-1.5 justify-center">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < stepIdx
                    ? 'w-5 bg-indigo-600'
                    : i === stepIdx
                    ? 'w-8 bg-indigo-500 animate-pulse'
                    : 'w-3 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <p className="text-slate-400 text-xs mt-5">
            AI generating your intelligence report — typically 15–30 seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900">Research a Company</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter a company name and our AI generates a full BD intelligence report —
            including pain points, opportunities, and a personalized outreach draft.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, company_name: e.target.value }))
              }
              placeholder="e.g. Stripe, Notion, Linear..."
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Company Website{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.company_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, company_url: e.target.value }))
              }
              placeholder="https://company.com"
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Additional Context{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.additional_context}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  additional_context: e.target.value,
                }))
              }
              placeholder="What you're selling, specific focus areas, or any context that helps tailor the research..."
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!form.company_name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors text-sm"
          >
            Generate Intelligence Report →
          </button>
        </form>

        {/* What you get */}
        <div className="mt-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
            What&apos;s included in your report
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                className="bg-white rounded-lg border border-slate-200 px-3.5 py-3 flex gap-2.5 items-start"
              >
                <span className="text-lg flex-shrink-0">{cap.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-slate-700">
                    {cap.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{cap.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
