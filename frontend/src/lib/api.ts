const API_BASE = '/api';

export interface ResearchRequest {
  company_name: string;
  company_url?: string;
  additional_context?: string;
}

export interface OutreachRequest {
  prospect_id: string;
  sender_name: string;
  sender_company: string;
  sender_offering: string;
  tone: 'professional' | 'conversational' | 'bold';
}

export interface CompanyOverview {
  description: string;
  industry: string;
  size: string;
  founded: string;
  headquarters: string;
}

export interface KeyPerson {
  name: string;
  title: string;
  relevance: string;
}

export interface CompetitiveLandscape {
  main_competitors: string[];
  market_position: string;
  differentiators: string;
}

export interface EngagementScore {
  score: number;
  reasoning: string;
}

export interface Research {
  company_overview: CompanyOverview;
  key_people: KeyPerson[];
  business_model: string;
  recent_developments: string[];
  pain_points: string[];
  bd_opportunities: string[];
  competitive_landscape: CompetitiveLandscape;
  engagement_score: EngagementScore;
  recommended_approach: string;
}

export interface OutreachEmail {
  id: string;
  subject: string;
  to_name: string;
  to_title: string;
  body: string;
  follow_up_subject: string;
  follow_up_body: string;
  sender_name: string;
  sender_company: string;
  tone: string;
  created_at: string;
}

export interface Prospect {
  id: string;
  company_name: string;
  company_url?: string;
  status: string;
  research?: Research;
  outreach_emails: OutreachEmail[];
  created_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Some callers pass paths already prefixed with `/api` (v2 endpoints); others
  // pass bare paths (legacy endpoints). Normalize so we never double the prefix.
  const url = path.startsWith('/api') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();

    let message = text || `Request failed: ${res.status}`;

    try {
      const data = JSON.parse(text);
      if (
        data &&
        typeof data === 'object' &&
        'detail' in data &&
        typeof (data as { detail: unknown }).detail === 'string'
      ) {
        message = (data as { detail: string }).detail;
      }
    } catch {
      // Response is not valid JSON; fall back to the raw text / generic message.
    }

    throw new Error(message);
  }
  return res.json();
}

export async function researchCompany(
  data: ResearchRequest
): Promise<{ prospect_id: string; research: Research }> {
  return request('/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function generateOutreach(data: OutreachRequest): Promise<OutreachEmail> {
  return request('/outreach/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export const listProspects = (): Promise<Prospect[]> => request('/prospects');

export const getProspect = (id: string): Promise<Prospect> => request(`/prospects/${id}`);

export async function updateProspectStatus(id: string, status: string): Promise<Prospect> {
  return request(`/prospects/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function deleteProspect(id: string): Promise<void> {
  await request(`/prospects/${id}`, { method: 'DELETE' });
}

export interface AnalyzeRequest {
  company_name: string;
  company_url?: string;
  user_description: string;
  sender_name?: string;
  sender_company?: string;
  linkedin_url?: string;
  deal_size?: string;
  priority?: string;
  notes?: string;
  post_lookback_months?: number;
  post_limit?: number;
}

export interface GatheredPost {
  title: string;
  text: string;
  url: string;
  source: string;
  date?: string;
}

export interface GatheredJob {
  title: string;
  location: string;
  url: string;
  snippet: string;
}

export interface EnrichedPerson {
  name: string;
  title: string;
  snippet?: string;
  role_category?: string;
  seniority?: string;
  location?: string;
  relevance?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface Gathered {
  website?: { pages?: { url: string; title: string; text: string }[]; error?: string | null };
  linkedin?: { company_info?: string; company_fields?: Record<string, unknown>; people?: EnrichedPerson[]; error?: string | null };
  posts?: { posts: GatheredPost[]; lookback_months?: number; limit?: number; as_of?: string; error?: string | null };
  jobs?: { jobs: GatheredJob[]; error?: string | null };
  people?: { people: EnrichedPerson[]; swarm_size?: number; error?: string | null };
  keywords?: { keywords?: string[]; product_areas?: string[]; target_personas?: string[]; industry_tags?: string[]; tech_signals?: string[] };
  research?: { results?: { title: string; url: string; snippet: string; angle: string }[]; error?: string | null };
  crawl?: {
    findings?: CrawlFinding[];
    by_type?: Record<string, number>;
    pages_crawled?: number;
    discovered?: number;
    error?: string | null;
  };
  rag_chunks?: number;
}

export interface CrawlFinding {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  source_type: string;
  query_angle: string;
}

export interface ContinueRequest {
  human_input?: string;
  removed_people?: string[];
  excluded_items?: Record<string, number[]>;  // {"posts": [0,2], "jobs": [1], ...}
}

export interface PainPoint {
  title: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string[];
  inference: string;
  opportunity: string;
  pitch_angle?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ICPBreakdown {
  industry_fit: number;
  tech_alignment: number;
  company_size: number;
  pain_service_fit: number;
  budget_probability: number;
  decision_readiness: number;
}

export interface ICPScore {
  overall: number;
  breakdown: ICPBreakdown;
  recommended_action: string;
  suggested_deal_size: string;
  best_entry_point: string;
}

export interface TechStack {
  current: string[];
  hiring: string[];
  gaps: string[];
}

export interface PitchAssets {
  id: string;
  created_at: string;
  executive_summary: string;
  cold_email_short: string;
  cold_email_detailed: string;
  linkedin_message: string;
  talking_points: string[];
}

export interface CompanyProfile {
  company_name: string;
  company_type: string;
  team_size: string;
  headquarters: string;
  services: string[];
  industries: string[];
  technologies: string;
  case_studies: string;
  usps: string;
  engagement_models: string[];
}

export interface FeedbackRequest {
  pipeline_id?: string;
  prospect_id?: string;
  output_type: string;
  output_id?: string;
  rating: number;
  note?: string;
}

export interface PipelineProspect {
  id: string;
  pipeline_id?: string;
  name: string;
  title: string;
  relevance: string;
  contact_angle: string;
  confidence: 'high' | 'medium' | 'low';
  poc_plan?: POCPlan;
}

export interface POCPlan {
  objective: string;
  approach: string;
  timeline: string;
  value_proposition: string;
  success_metrics: string[];
  talking_points: string[];
  risks: string[];
}

export interface Pipeline {
  id: string;
  company_name: string;
  company_url?: string;
  user_description: string;
  sender_name?: string;
  sender_company?: string;
  linkedin_url?: string;
  deal_size?: string;
  priority?: string;
  notes?: string;
  status: 'pending' | 'gathering' | 'people' | 'keywords' | 'researching' | 'indexing' | 'awaiting_input' | 'insights' | 'embedding' | 'complete' | 'failed'
    // legacy statuses (older pipelines)
    | 'scraping' | 'linkedin';
  intelligence?: Omit<Research, 'key_people' | 'pain_points'> & {
    pain_points?: PainPoint[];
    tech_stack?: TechStack;
    icp_score?: ICPScore;
    sources?: { title: string; url: string }[];
    grounded?: boolean;
    key_keywords?: string[];
    prospects?: PipelineProspect[];
    people?: EnrichedPerson[];
    posts?: GatheredPost[];
    jobs?: GatheredJob[];
  };
  gathered?: Gathered;
  prospects?: PipelineProspect[];
  error_message?: string;
  created_at: string;
}

export interface TrendsCluster {
  theme: string;
  companies: string[];
  insight: string;
  opportunity: string;
}

export interface TrendsResponse {
  clusters: TrendsCluster[];
  overall_summary: string;
  total_companies_analyzed: number;
}

export interface Stats {
  total_pipelines: number;
  active_pipelines: number;
  completed_pipelines: number;
  total_prospects_identified: number;
  avg_engagement_score: number;
}

export interface POCRequest {
  prospect_id: string;
  sender_name: string;
  sender_company: string;
  user_description: string;
}

export interface EmailV2Request {
  prospect_id: string;
  sender_name: string;
  sender_company: string;
  sender_offering: string;
  tone: 'professional' | 'conversational' | 'bold';
}

export async function startAnalysis(data: AnalyzeRequest): Promise<{ pipeline_id: string; status: string }> {
  return request('/api/v2/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPipeline(id: string): Promise<Pipeline> {
  return request(`/api/v2/pipeline/${id}`);
}

export async function continuePipeline(id: string, data: ContinueRequest): Promise<{ pipeline_id: string; status: string }> {
  return request(`/api/v2/pipeline/${id}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listPipelines(): Promise<Pipeline[]> {
  return request('/api/v2/pipelines');
}

export async function getPipelineProspects(pipelineId: string): Promise<PipelineProspect[]> {
  return request(`/api/v2/pipeline/${pipelineId}/prospects`);
}

export async function generatePOCPlan(pipelineId: string, data: POCRequest): Promise<POCPlan> {
  return request(`/api/v2/pipeline/${pipelineId}/poc-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function generateEmailV2(pipelineId: string, data: EmailV2Request): Promise<OutreachEmail> {
  return request(`/api/v2/pipeline/${pipelineId}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPipelineEmails(pipelineId: string): Promise<OutreachEmail[]> {
  return request(`/api/v2/pipeline/${pipelineId}/emails`);
}

export async function getMarketTrends(): Promise<TrendsResponse> {
  return request('/api/v2/trends');
}

export async function getStats(): Promise<Stats> {
  return request('/api/stats');
}

export async function getCompanyProfile(): Promise<Partial<CompanyProfile>> {
  return request('/api/company-profile');
}

export async function saveCompanyProfile(data: CompanyProfile): Promise<CompanyProfile> {
  return request('/api/company-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function generatePitchAssets(
  pipelineId: string,
  data: { prospect_id: string; sender_name: string; sender_company: string; sender_offering: string }
): Promise<PitchAssets> {
  return request(`/api/v2/pipeline/${pipelineId}/pitch-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function submitFeedback(data: FeedbackRequest): Promise<{ id: string; ok: boolean }> {
  return request('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
