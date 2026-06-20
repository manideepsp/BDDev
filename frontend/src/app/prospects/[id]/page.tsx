'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getProspect,
  generateOutreach,
  updateProspectStatus,
  Prospect,
  OutreachEmail,
  Research,
} from '@/lib/api';

type Tab = 'research' | 'outreach';

const STATUS_OPTIONS = [
  'researched',
  'outreach_ready',
  'contacted',
  'responded',
  'qualified',
  'closed',
];

// ── Engagement Score Ring ──────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

// ── Research Report ────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ResearchView({ research }: { research: Research }) {
  const ov = research.company_overview;
  const score = research.engagement_score;

  return (
    <div className="space-y-4">
      {/* Overview + Score */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Company Overview
          </h3>
          <p className="text-slate-700 text-sm leading-relaxed mb-4">{ov.description}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Industry', value: ov.industry },
              { label: 'Size', value: ov.size },
              { label: 'Founded', value: ov.founded },
              { label: 'Headquarters', value: ov.headquarters },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
                <div className="text-sm font-medium text-slate-800 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            BD Score
          </div>
          <ScoreRing score={score.score} />
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {score.reasoning}
          </p>
        </div>
      </div>

      {/* Business Model */}
      <Card title="Business Model">
        <p className="text-slate-700 text-sm leading-relaxed">{research.business_model}</p>
      </Card>

      {/* Pain Points + Opportunities */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Pain Points">
          <ul className="space-y-2">
            {research.pain_points.map((pt, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-snug">
                <span className="text-red-400 mt-0.5 flex-shrink-0">●</span>
                {pt}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="BD Opportunities">
          <ul className="space-y-2">
            {research.bd_opportunities.map((opp, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-snug">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">●</span>
                {opp}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recent Developments */}
      <Card title="Recent Developments">
        <ul className="space-y-2">
          {research.recent_developments.map((dev, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-snug">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">◆</span>
              {dev}
            </li>
          ))}
        </ul>
      </Card>

      {/* Key People */}
      <Card title="Key People">
        <div className="grid grid-cols-2 gap-3">
          {research.key_people.map((person, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold text-slate-900 text-sm">{person.name}</div>
              <div className="text-slate-500 text-xs mt-0.5">{person.title}</div>
              <div className="text-slate-600 text-xs mt-2 leading-snug">{person.relevance}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Competitive Landscape */}
      <Card title="Competitive Landscape">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">
              Main Competitors
            </div>
            <div className="flex flex-wrap gap-2">
              {research.competitive_landscape.main_competitors.map((c, i) => (
                <span key={i} className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Market Position
            </div>
            <p className="text-sm text-slate-700">
              {research.competitive_landscape.market_position}
            </p>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Differentiators
            </div>
            <p className="text-sm text-slate-700">
              {research.competitive_landscape.differentiators}
            </p>
          </div>
        </div>
      </Card>

      {/* Recommended Approach */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">
          AI Recommended Approach
        </h3>
        <p className="text-indigo-900 text-sm leading-relaxed">
          {research.recommended_approach}
        </p>
      </div>
    </div>
  );
}

// ── Outreach Generator ────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function EmailCard({
  title,
  badge,
  subject,
  body,
  subjectKey,
  bodyKey,
}: {
  title: string;
  badge?: string;
  subject: string;
  body: string;
  subjectKey: string;
  bodyKey: string;
}) {
  const [fullCopied, setFullCopied] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {badge && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Subject</span>
            <CopyButton text={subject} label="Copy" />
          </div>
          <p className="text-slate-800 text-sm font-medium">{subject}</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-3.5">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Body</span>
            <CopyButton text={body} label="Copy" />
          </div>
          <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
      </div>

      <button
        onClick={() => {
          navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
          setFullCopied(true);
          setTimeout(() => setFullCopied(false), 2000);
        }}
        className="mt-3 w-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {fullCopied ? '✓ Copied!' : 'Copy Full Email'}
      </button>
    </div>
  );
}

function OutreachView({
  prospectId,
}: {
  prospectId: string;
}) {
  const [form, setForm] = useState({
    sender_name: '',
    sender_company: '',
    sender_offering: '',
    tone: 'professional' as 'professional' | 'conversational' | 'bold',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OutreachEmail | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const email = await generateOutreach({ prospect_id: prospectId, ...form });
      setResult(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4">Generate Personalized Outreach</h3>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={form.sender_name}
                onChange={(e) => setForm((p) => ({ ...p, sender_name: e.target.value }))}
                placeholder="Manideep S"
                required
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Company
              </label>
              <input
                type="text"
                value={form.sender_company}
                onChange={(e) => setForm((p) => ({ ...p, sender_company: e.target.value }))}
                placeholder="KS Business"
                required
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              What You Offer
            </label>
            <textarea
              value={form.sender_offering}
              onChange={(e) => setForm((p) => ({ ...p, sender_offering: e.target.value }))}
              placeholder="Describe your product/service and the core value it delivers to customers..."
              rows={2}
              required
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Tone
            </label>
            <div className="flex gap-2">
              {(['professional', 'conversational', 'bold'] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tone }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    form.tone === tone
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !form.sender_name ||
              !form.sender_company ||
              !form.sender_offering
            }
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              '✨ Generate Personalized Email'
            )}
          </button>
        </form>
      </div>

      {/* Result */}
      {result && (
        <>
          {result.to_name && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-2">
              <span className="text-indigo-500 text-sm">👤</span>
              <span className="text-indigo-800 text-sm">
                <strong>Recommended contact:</strong> {result.to_name}
                {result.to_title ? ` · ${result.to_title}` : ''}
              </span>
            </div>
          )}

          <EmailCard
            title="Primary Email"
            subject={result.subject}
            body={result.body}
            subjectKey="subject"
            bodyKey="body"
          />

          <EmailCard
            title="Follow-up Email"
            badge="Send 7 days later"
            subject={result.follow_up_subject}
            body={result.follow_up_body}
            subjectKey="fu_subject"
            bodyKey="fu_body"
          />
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProspectDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('research');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    getProspect(id)
      .then(setProspect)
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleStatusChange = async (newStatus: string) => {
    if (!prospect) return;

    setStatusError(null);
    setStatusUpdating(true);

    try {
      const updated = await updateProspectStatus(id, newStatus);
      setProspect(updated);
    } catch (err) {
      console.error(err);
      setStatusError('Failed to update status. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[80vh] gap-3">
        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Loading prospect...</span>
      </div>
    );
  }

  if (!prospect) return null;

  const score = prospect.research?.engagement_score?.score;

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/" className="hover:text-slate-600 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{prospect.company_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0 mr-6">
          <h1 className="text-2xl font-bold text-slate-900">{prospect.company_name}</h1>
          {prospect.company_url && (
            <a
              href={prospect.company_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 text-sm mt-0.5 inline-block"
            >
              {prospect.company_url} ↗
            </a>
          )}
          {prospect.research?.company_overview && (
            <p className="text-slate-500 text-sm mt-1.5">
              {prospect.research.company_overview.industry}
              {prospect.research.company_overview.headquarters
                ? ` · ${prospect.research.company_overview.headquarters}`
                : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {score !== undefined && (
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">BD Score</div>
              <div
                className={`text-2xl font-bold ${
                  score >= 80
                    ? 'text-emerald-600'
                    : score >= 60
                    ? 'text-amber-600'
                    : 'text-red-500'
                }`}
              >
                {score}
              </div>
            </div>
          )}

          <div>
            <select
              value={prospect.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            {statusError && (
              <p className="mt-1 text-xs text-red-600">{statusError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {(
          [
            { key: 'research', label: '📊 Research Report' },
            { key: 'outreach', label: '✉️ Outreach Generator' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'research' ? (
        prospect.research ? (
          <ResearchView research={prospect.research} />
        ) : (
          <div className="text-slate-400 text-sm">No research data available.</div>
        )
      ) : (
        <OutreachView prospectId={id} />
      )}
    </div>
  );
}
