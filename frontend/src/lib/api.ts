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
