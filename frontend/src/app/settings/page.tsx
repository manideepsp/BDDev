'use client';
import { useEffect, useState } from 'react';
import { getCompanyProfile, saveCompanyProfile, CompanyProfile } from '@/lib/api';

const SERVICE_OPTIONS = [
  'Custom Software Development', 'Cloud Migration (AWS / Azure / GCP)', 'AI / ML Engineering',
  'Data Engineering & Analytics', 'Mobile App Development', 'DevOps & Platform Engineering',
  'QA & Test Automation', 'Digital Transformation Consulting', 'Cybersecurity', 'ERP / SAP',
];
const INDUSTRY_OPTIONS = [
  'BFSI', 'Healthcare & Life Sciences', 'Retail & E-commerce', 'Manufacturing',
  'EdTech', 'SaaS / Tech Companies', 'Logistics', 'Media & Entertainment',
];
const ENGAGEMENT_OPTIONS = ['Fixed Price', 'T&M', 'Dedicated Team', 'Staff Augmentation'];

const EMPTY: CompanyProfile = {
  company_name: '', company_type: '', team_size: '', headquarters: '',
  services: [], industries: [], technologies: '', case_studies: '', usps: '',
  engagement_models: [],
};

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'text-slate-600 border-slate-200 hover:border-indigo-300'
      }`}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCompanyProfile()
      .then(p => { if (p && Object.keys(p).length) setProfile({ ...EMPTY, ...p }); })
      .finally(() => setLoading(false));
  }, []);

  function toggle(field: 'services' | 'industries' | 'engagement_models', value: string) {
    setProfile(p => {
      const list = p[field];
      return { ...p, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveCompanyProfile(profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Loading profile...
      </div>
    );
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Your Company Profile</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Fill this once. Every analysis personalizes its pain points, ICP score, and pitch assets against what you actually offer.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
              <input className={inputCls} value={profile.company_name}
                onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} placeholder="Cognine Technologies" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
              <input className={inputCls} value={profile.company_type}
                onChange={e => setProfile(p => ({ ...p, company_type: e.target.value }))} placeholder="IT Services / Product Engineering" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Team Size</label>
              <input className={inputCls} value={profile.team_size}
                onChange={e => setProfile(p => ({ ...p, team_size: e.target.value }))} placeholder="50-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Headquarters</label>
              <input className={inputCls} value={profile.headquarters}
                onChange={e => setProfile(p => ({ ...p, headquarters: e.target.value }))} placeholder="Hyderabad, India" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Services</p>
          <div className="flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map(s => (
              <Chip key={s} label={s} active={profile.services.includes(s)} onClick={() => toggle('services', s)} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Industries Served</p>
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_OPTIONS.map(s => (
              <Chip key={s} label={s} active={profile.industries.includes(s)} onClick={() => toggle('industries', s)} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Engagement Models</p>
          <div className="flex flex-wrap gap-2">
            {ENGAGEMENT_OPTIONS.map(s => (
              <Chip key={s} label={s} active={profile.engagement_models.includes(s)} onClick={() => toggle('engagement_models', s)} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Technologies</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={profile.technologies}
              onChange={e => setProfile(p => ({ ...p, technologies: e.target.value }))}
              placeholder="Backend: .NET, Node.js, Python · Cloud: AWS, Azure · Data: Snowflake, dbt · AI/ML: LangChain, MLflow" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Case Studies</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={profile.case_studies}
              onChange={e => setProfile(p => ({ ...p, case_studies: e.target.value }))}
              placeholder="BFSI: real-time risk pipeline, 72h → 4h reports. Retail: AI recommendations, +22% conversion." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">USPs (what makes you different)</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={profile.usps}
              onChange={e => setProfile(p => ({ ...p, usps: e.target.value }))}
              placeholder="Dedicated teams not body-shopping · AI/ML in-house · first sprint in week 1" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {saved && <span className="text-emerald-600 text-sm">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}
