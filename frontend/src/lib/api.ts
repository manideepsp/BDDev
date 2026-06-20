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
  poc_summary?: string;
  keywords_used?: string[];
  personalization_hook?: string;
  subject_lines?: string[];
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
  // Brand Voice
  brand_voice_tone?: string;       // preferred default tone: professional|conversational|bold|thought-leader
  brand_voice_rules?: string;      // writing rules and dos/don'ts
  brand_voice_example?: string;    // example post/email the team likes
  brand_voice_forbidden?: string;  // words/phrases to never use
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
  seniority?: string;
  role_category?: string;
  location?: string;
  prospect_status?: string;
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
  trigger_event?: string;
  linkedin_quote?: string;
  word_limit?: number;
}

export async function startAnalysis(data: AnalyzeRequest): Promise<{ pipeline_id: string; status: string }> {
  return request('/v2/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPipeline(id: string): Promise<Pipeline> {
  return request(`/v2/pipeline/${id}`);
}

export async function continuePipeline(id: string, data: ContinueRequest): Promise<{ pipeline_id: string; status: string }> {
  return request(`/api/v2/pipeline/${id}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listPipelines(): Promise<Pipeline[]> {
  return request('/v2/pipelines');
}

export async function getPipelineProspects(pipelineId: string): Promise<PipelineProspect[]> {
  return request(`/v2/pipeline/${pipelineId}/prospects`);
}

export async function generatePOCPlan(pipelineId: string, data: POCRequest): Promise<POCPlan> {
  return request(`/v2/pipeline/${pipelineId}/poc-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function generateEmailV2(pipelineId: string, data: EmailV2Request): Promise<OutreachEmail> {
  return request(`/v2/pipeline/${pipelineId}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPipelineEmails(pipelineId: string): Promise<OutreachEmail[]> {
  return request(`/v2/pipeline/${pipelineId}/emails`);
}

export async function getMarketTrends(): Promise<TrendsResponse> {
  return request('/v2/trends');
}

export async function getStats(): Promise<Stats> {
  return request('/stats');
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

export interface EmailABRequest {
  prospect_id: string;
  sender_name: string;
  sender_company: string;
  sender_offering: string;
  tone_a?: string;
  tone_b?: string;
  trigger_event?: string;
  linkedin_quote?: string;
  word_limit?: number;
}

export interface EmailABResult {
  variant_a: OutreachEmail;
  variant_b: OutreachEmail;
  tone_a: string;
  tone_b: string;
}

export async function generateABEmails(pipelineId: string, data: EmailABRequest): Promise<EmailABResult> {
  return request(`/api/v2/pipeline/${pipelineId}/email-ab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface BulkGenerateRequest {
  sender_name?: string;
  sender_company?: string;
  sender_offering?: string;
  tone?: 'professional' | 'conversational' | 'bold';
  word_limit?: number;
  generate_poc?: boolean;
  generate_email?: boolean;
}

export interface BulkGenerateResult {
  generated: number;
  total: number;
  results: { prospect_id: string; name: string; poc: POCPlan | null; email: OutreachEmail | null; error: string | null }[];
}

export interface DriftChange {
  type: string;
  title: string;
  detail: string;
  impact_on_bd: string;
  source_index: number;
}

export interface DriftResult {
  changes: DriftChange[];
  alert_level: 'high' | 'medium' | 'low' | 'none';
  summary: string;
  new_signals: { title: string; url: string; snippet: string }[];
  checked_at: string;
}

export interface CompetitorProfile {
  name: string;
  positioning: string;
  pricing_signal: string;
  tech_approach: string;
  weakness: string;
  bd_angle: string;
}

export interface CompetitiveAnalysis {
  competitors: CompetitorProfile[];
  market_position: string;
  seller_wedge: string;
  displacement_risk: 'high' | 'medium' | 'low';
  recommended_talking_points: string[];
  company_name: string;
}

export interface ProfileSuggestions {
  suggested_services: string[];
  suggested_industries: string[];
  suggested_technologies: string;
  suggested_usps: string;
  suggested_case_study: string;
  reasoning: string;
}

export async function getProfileSuggestions(pipelineId: string): Promise<ProfileSuggestions> {
  return request(`/api/v2/pipeline/${pipelineId}/profile-suggestions`);
}

export async function runCompetitiveAnalysis(pipelineId: string): Promise<CompetitiveAnalysis> {
  return request(`/api/v2/pipeline/${pipelineId}/competitive-analysis`, { method: 'POST' });
}

export async function getCompetitiveAnalysis(pipelineId: string): Promise<CompetitiveAnalysis> {
  return request(`/api/v2/pipeline/${pipelineId}/competitive-analysis`);
}

export async function runDriftCheck(pipelineId: string): Promise<DriftResult> {
  return request(`/api/v2/pipeline/${pipelineId}/drift-check`, { method: 'POST' });
}

export async function getDriftHistory(pipelineId: string): Promise<DriftResult[]> {
  return request(`/api/v2/pipeline/${pipelineId}/drift-checks`);
}

export async function bulkGenerate(pipelineId: string, data: BulkGenerateRequest): Promise<BulkGenerateResult> {
  return request(`/api/v2/pipeline/${pipelineId}/bulk-generate`, {
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

// ── LinkedIn Posts ─────────────────────────────────────────────────────────────

export interface LinkedInPost {
  id: string;
  content: string;
  strategy: 'trend_spotlight' | 'pain_narrative' | 'contrarian' | 'how_we_help' | 'industry_take' | 'case_signal';
  trend_cluster: string;
  strategy_note: string;
  status: 'draft' | 'selected' | 'posted';
  char_count: number;
  created_at: string;
  pipeline_ids?: string[];
}

export interface RefineRequest {
  message: string;
  current_content: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface RefineResponse {
  content: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export async function generateLinkedInPosts(persona?: string): Promise<LinkedInPost[]> {
  return request('/api/v2/linkedin/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona: persona ?? 'auto' }),
  });
}

export async function listLinkedInPosts(): Promise<LinkedInPost[]> {
  return request('/api/v2/linkedin/posts');
}

export async function updateLinkedInPostStatus(postId: string, status: string): Promise<void> {
  await request(`/api/v2/linkedin/posts/${postId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function deleteLinkedInPost(postId: string): Promise<void> {
  await request(`/api/v2/linkedin/posts/${postId}`, { method: 'DELETE' });
}

export async function refineLinkedInPost(postId: string, data: RefineRequest): Promise<RefineResponse> {
  return request(`/api/v2/linkedin/posts/${postId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateProspectStatusV2(prospectId: string, status: string): Promise<void> {
  await request(`/api/v2/prospects/${prospectId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function getEmailRefinements(emailId: string): Promise<{ role: string; content: string; created_at: string }[]> {
  return request(`/api/v2/email/${emailId}/refinements`);
}

export async function refineEmail(emailId: string, data: RefineRequest): Promise<RefineResponse & { field: string }> {
  return request(`/api/v2/email/${emailId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface CaseStudyPost {
  format: 'story_arc' | 'data_lead' | 'quick_insight';
  content: string;
  char_count: number;
}

export async function generateCaseStudyPosts(pipelineId: string): Promise<{ posts: CaseStudyPost[]; company_name: string }> {
  return request(`/api/v2/pipeline/${pipelineId}/case-study-posts`, { method: 'POST' });
}

// ── LinkedIn Intelligence Hub ─────────────────────────────────────────────────

export interface LinkedInTarget {
  id: string;
  company_name: string;
  linkedin_url?: string;
  website_url?: string;
  created_at: string;
}

export interface FetchedPost {
  id: string;
  source_type: 'own' | 'target';
  company_name: string;
  title?: string;
  content?: string;
  published_date?: string;
  post_url?: string;
  fetched_at: string;
}

export interface PostIdea {
  id: string;
  topic: string;
  angle: string;
  suggested_format: string;
  rationale: string;
  hook?: string;
  status: 'idea' | 'drafting' | 'drafted';
  draft_content?: string;
  created_at: string;
}

export interface HookEntry {
  pattern: 'question' | 'stat' | 'story' | 'contrarian' | 'bold_claim';
  hook: string;
  company: string;
  why: string;
}

export interface LinkedInAnalysis {
  timeline_summary: string;
  own_cadence?: string;
  content_themes: string[];
  competitor_angles: string[];
  content_gaps: string[];
  best_day_guess?: string;
  hook_swipe_file: HookEntry[];
  post_ideas: PostIdea[];
  fetched_posts?: FetchedPost[];
  _fetched_at?: string;
  error?: string | null;
}

export interface PostScore {
  scores: {
    hook_strength: number;
    specificity: number;
    readability: number;
    cta_clarity: number;
    length_fit: number;
  };
  overall: number;
  suggestions: string[];
  verdict: 'ready_to_post' | 'needs_work' | 'strong_post';
}

export interface ThreadPart {
  part: number;
  content: string;
  char_count: number;
}

export interface ThreadResult {
  thread: ThreadPart[];
  total_parts: number;
}

export interface FirstComment {
  comment: string;
  rationale: string;
}

export interface RemixResult {
  remixed_content: string;
  format_kept: string;
  what_changed: string;
}

export async function addLinkedInTarget(data: { company_name: string; linkedin_url?: string; website_url?: string }): Promise<{ id: string; ok: boolean }> {
  return request('/api/v2/linkedin/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listLinkedInTargets(): Promise<LinkedInTarget[]> {
  return request('/api/v2/linkedin/targets');
}

export async function deleteLinkedInTarget(id: string): Promise<void> {
  await request(`/api/v2/linkedin/targets/${id}`, { method: 'DELETE' });
}

export async function fetchAndAnalyzeLinkedIn(): Promise<{ analysis_id: string; fetched_count: number; analysis: LinkedInAnalysis; fetched_posts: FetchedPost[] }> {
  return request('/api/v2/linkedin/fetch-analyze', { method: 'POST' });
}

export async function getLinkedInAnalysis(): Promise<LinkedInAnalysis | null> {
  return request('/api/v2/linkedin/analysis');
}

export async function listLinkedInIdeas(): Promise<PostIdea[]> {
  return request('/api/v2/linkedin/ideas');
}

export async function startIdeaDraft(ideaId: string): Promise<{ content: string }> {
  return request(`/api/v2/linkedin/ideas/${ideaId}/draft/start`, { method: 'POST' });
}

export async function refineIdeaDraft(
  ideaId: string,
  data: { message: string; current_content: string; history: { role: string; content: string }[] }
): Promise<{ content: string; history: { role: string; content: string }[] }> {
  return request(`/api/v2/linkedin/ideas/${ideaId}/draft/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function publishIdeaAsPost(ideaId: string): Promise<{ post_id: string }> {
  return request(`/api/v2/linkedin/ideas/${ideaId}/publish`, { method: 'POST' });
}

export async function scoreLinkedInPost(content: string): Promise<PostScore> {
  return request('/api/v2/linkedin/score-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export async function buildLinkedInThread(content: string): Promise<ThreadResult> {
  return request('/api/v2/linkedin/build-thread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export async function generateFirstComment(postContent: string): Promise<FirstComment> {
  return request('/api/v2/linkedin/first-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_content: postContent }),
  });
}

export async function remixCompetitorPost(original_content: string, company_name: string): Promise<RemixResult> {
  return request('/api/v2/linkedin/remix-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original_content, company_name }),
  });
}
