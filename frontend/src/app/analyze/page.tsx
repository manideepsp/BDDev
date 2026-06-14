'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAnalysis } from '@/lib/api';

const AGENT_STAGES = [
  { icon: '🌐', label: 'Website Scraping', desc: 'Extracts content from the company website' },
  { icon: '💼', label: 'LinkedIn Intelligence', desc: 'Finds key people and company info' },
  { icon: '🔑', label: 'Keyword Extraction', desc: 'Identifies key themes and signals' },
  { icon: '🔍', label: 'Web Research', desc: 'Searches for news, competitors, financials' },
  { icon: '🧠', label: 'Insights & Prospects', desc: 'Synthesizes intelligence and identifies contacts' },
];

export default function AnalyzePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '', company_url: '', user_description: '',
    sender_name: '', sender_company: '',
    linkedin_url: '', deal_size: '', priority: '', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = form.company_name.trim() && form.user_description.trim();

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
      });
      router.push(`/pipeline/${pipeline_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Company Analysis</h1>
        <p className="text-slate-500 mt-1 text-sm">5 AI agents will research the company and identify the best prospects to pitch.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.company_name}
                onChange={e => setForm(f => ({...f, company_name: e.target.value}))}
                placeholder="e.g. Stripe, Notion, Figma"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Website</label>
              <input
                type="url"
                value={form.company_url}
                onChange={e => setForm(f => ({...f, company_url: e.target.value}))}
                placeholder="https://..."
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company LinkedIn</label>
              <input
                type="url"
                value={form.linkedin_url}
                onChange={e => setForm(f => ({...f, linkedin_url: e.target.value}))}
                placeholder="https://linkedin.com/company/... (optional)"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Deal Size Target</label>
                <select
                  value={form.deal_size}
                  onChange={e => setForm(f => ({...f, deal_size: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">—</option>
                  <option value="Small">Small</option>
                  <option value="Mid">Mid</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({...f, priority: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">—</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Offering <span className="text-red-500">*</span></label>
              <textarea
                value={form.user_description}
                onChange={e => setForm(f => ({...f, user_description: e.target.value}))}
                rows={4}
                placeholder="Briefly describe what you do and what you're offering this prospect..."
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes on this Target</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                rows={2}
                placeholder="Any known context about this company (optional)..."
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={form.sender_name}
                  onChange={e => setForm(f => ({...f, sender_name: e.target.value}))}
                  placeholder="Jane Smith"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Company</label>
                <input
                  type="text"
                  value={form.sender_company}
                  onChange={e => setForm(f => ({...f, sender_company: e.target.value}))}
                  placeholder="Acme Inc"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠️ {error}</div>
            )}
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? '🚀 Starting analysis...' : '🔍 Start Analysis →'}
            </button>
          </form>
        </div>
        {/* Agent stages preview */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">What happens next</p>
          {AGENT_STAGES.map((stage, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 flex items-start gap-3">
              <span className="text-xl">{stage.icon}</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{stage.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stage.desc}</p>
              </div>
              <span className="ml-auto text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Agent {i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
