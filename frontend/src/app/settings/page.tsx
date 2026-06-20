'use client';
import { useEffect, useState } from 'react';
import { Save, CheckCircle2, Loader2, X, Plus } from 'lucide-react';
import { getCompanyProfile, saveCompanyProfile, CompanyProfile } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

const BRAND_VOICE_TONES = [
  { value: 'professional', label: 'Professional', desc: 'Polished, executive-to-executive' },
  { value: 'conversational', label: 'Conversational', desc: 'Warm, human, peer-to-peer' },
  { value: 'bold', label: 'Bold', desc: 'Provocative, insight-led, earns attention' },
  { value: 'thought-leader', label: 'Thought Leader', desc: 'Educational, opinionated, big-picture' },
];

const EMPTY: CompanyProfile = {
  company_name: '', company_type: '', team_size: '', headquarters: '',
  services: [], industries: [], technologies: '', case_studies: '', usps: '',
  engagement_models: [],
  brand_voice_tone: 'professional',
  brand_voice_rules: '',
  brand_voice_example: '',
  brand_voice_forbidden: '',
};

// Tag input component
function TagPills({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [customInput, setCustomInput] = useState('');

  function addCustom() {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onToggle(trimmed);
    }
    setCustomInput('');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              )}
            >
              {active && <CheckCircle2 className="w-3 h-3" />}
              {opt}
            </button>
          );
        })}
      </div>
      {/* Selected custom items not in options */}
      {selected.filter(s => !options.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.filter(s => !options.includes(s)).map(s => (
            <Badge key={s} variant="secondary" className="gap-1.5 pr-1">
              {s}
              <button type="button" onClick={() => onToggle(s)} className="hover:text-danger ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="Add custom..."
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

const textareaCls = 'w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none';
const labelCls = 'block text-sm font-medium text-foreground mb-1.5';
const sublabelCls = 'ml-1.5 text-xs font-normal text-muted-foreground';

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
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border px-8 py-5">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Fill this once. Every analysis personalizes its pain points, ICP score, and pitch assets against what you actually offer.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">

          {/* ── Company Info ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Company Info</CardTitle>
              <CardDescription>Basic details about your organisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Company Name</label>
                  <Input
                    value={profile.company_name}
                    onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))}
                    placeholder="Cognine Technologies"
                  />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <Input
                    value={profile.company_type}
                    onChange={e => setProfile(p => ({ ...p, company_type: e.target.value }))}
                    placeholder="IT Services / Product Engineering"
                  />
                </div>
                <div>
                  <label className={labelCls}>Team Size</label>
                  <Input
                    value={profile.team_size}
                    onChange={e => setProfile(p => ({ ...p, team_size: e.target.value }))}
                    placeholder="50-200"
                  />
                </div>
                <div>
                  <label className={labelCls}>Headquarters</label>
                  <Input
                    value={profile.headquarters}
                    onChange={e => setProfile(p => ({ ...p, headquarters: e.target.value }))}
                    placeholder="Hyderabad, India"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Services ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>Select all services your company offers</CardDescription>
            </CardHeader>
            <CardContent>
              <TagPills
                options={SERVICE_OPTIONS}
                selected={profile.services}
                onToggle={v => toggle('services', v)}
              />
            </CardContent>
          </Card>

          {/* ── Industries Served ────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Industries Served</CardTitle>
              <CardDescription>Which verticals do you target?</CardDescription>
            </CardHeader>
            <CardContent>
              <TagPills
                options={INDUSTRY_OPTIONS}
                selected={profile.industries}
                onToggle={v => toggle('industries', v)}
              />
            </CardContent>
          </Card>

          {/* ── Engagement Models ────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Models</CardTitle>
              <CardDescription>How do you typically work with clients?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ENGAGEMENT_OPTIONS.map(opt => {
                  const active = profile.engagement_models.includes(opt);
                  return (
                    <Button
                      key={opt}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggle('engagement_models', opt)}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {opt}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Technical Details ─────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
              <CardDescription>Technologies, case studies, and what makes you different</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className={labelCls}>Technologies</label>
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={profile.technologies}
                  onChange={e => setProfile(p => ({ ...p, technologies: e.target.value }))}
                  placeholder="Backend: .NET, Node.js, Python · Cloud: AWS, Azure · Data: Snowflake, dbt · AI/ML: LangChain, MLflow"
                />
              </div>
              <div>
                <label className={labelCls}>Case Studies</label>
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={profile.case_studies}
                  onChange={e => setProfile(p => ({ ...p, case_studies: e.target.value }))}
                  placeholder="BFSI: real-time risk pipeline, 72h → 4h reports. Retail: AI recommendations, +22% conversion."
                />
              </div>
              <div>
                <label className={labelCls}>USPs <span className={sublabelCls}>what makes you different</span></label>
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={profile.usps}
                  onChange={e => setProfile(p => ({ ...p, usps: e.target.value }))}
                  placeholder="Dedicated teams not body-shopping · AI/ML in-house · first sprint in week 1"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Brand Voice ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice</CardTitle>
              <CardDescription>Controls how LinkedIn posts and outreach emails sound. Injected into every generation prompt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Tone selector */}
              <div>
                <label className={labelCls}>Default Tone</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {BRAND_VOICE_TONES.map(t => {
                    const active = profile.brand_voice_tone === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, brand_voice_tone: t.value }))}
                        className={cn(
                          'text-left px-3 py-2.5 rounded-xl border transition-all',
                          active
                            ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                            : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/50'
                        )}
                      >
                        <p className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Writing rules */}
              <div>
                <label className={labelCls}>
                  Writing Rules
                  <span className={sublabelCls}>Dos and don&apos;ts injected into every prompt</span>
                </label>
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={profile.brand_voice_rules ?? ''}
                  onChange={e => setProfile(p => ({ ...p, brand_voice_rules: e.target.value }))}
                  placeholder="e.g. Never use buzzwords like 'synergy', 'holistic', 'leverage'. Always lead with a specific number or outcome. Keep sentences short. Never use exclamation points."
                />
              </div>

              {/* Forbidden words */}
              <div>
                <label className={labelCls}>
                  Forbidden Words / Phrases
                  <span className={sublabelCls}>Comma-separated</span>
                </label>
                <Input
                  value={profile.brand_voice_forbidden ?? ''}
                  onChange={e => setProfile(p => ({ ...p, brand_voice_forbidden: e.target.value }))}
                  placeholder="synergy, solutions, touch base, circle back, best-in-class, cutting-edge, leverage"
                />
              </div>

              {/* Example writing */}
              <div>
                <label className={labelCls}>
                  Example Writing
                  <span className={sublabelCls}>A post or email your team loved — the model will match this style</span>
                </label>
                <textarea
                  className={textareaCls}
                  rows={5}
                  value={profile.brand_voice_example ?? ''}
                  onChange={e => setProfile(p => ({ ...p, brand_voice_example: e.target.value }))}
                  placeholder="Paste a LinkedIn post or cold email that represents your ideal voice. The AI will use it as a style reference."
                />
              </div>
            </CardContent>
          </Card>

          {/* Save footer */}
          <div className="flex items-center gap-3 pb-6">
            <Button type="submit" disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Profile
                </>
              )}
            </Button>
            {saved && (
              <p className="text-success text-sm font-medium animate-fade-in">
                Profile saved successfully
              </p>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}
