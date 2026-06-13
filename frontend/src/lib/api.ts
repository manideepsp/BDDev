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
  const res = await fetch(`${API_BASE}${path}`, options);
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
  status: 'pending' | 'scraping' | 'linkedin' | 'keywords' | 'researching' | 'insights' | 'embedding' | 'complete' | 'failed';
  intelligence?: Omit<Research, 'key_people'> & { sources?: { title: string; url: string }[]; grounded?: boolean; key_keywords?: string[]; prospects?: PipelineProspect[] };
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
