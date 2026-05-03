/**
 * REST API client for Hermes Web Dashboard.
 * Communicates with the Hermes Web Server (FastAPI) at http://127.0.0.1:PORT/api/*.
 * Synced with hermes-agent v0.12.0 API surface.
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Types ──────────────────────────────────────────────────

export interface WebServerInfo {
  running: boolean;
  port: number | null;
  token: string | null;
}

export interface SessionInfo {
  id: string;
  source: string | null;
  model: string | null;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  last_active: number;
  is_active: boolean;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  preview: string | null;
}

export interface PaginatedSessions {
  sessions: SessionInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_name?: string;
  tool_call_id?: string;
  timestamp?: number;
}

export interface SessionMessagesResponse {
  session_id: string;
  messages: SessionMessage[];
}

export interface SessionSearchResult {
  session_id: string;
  snippet: string;
  role: string | null;
  source: string | null;
  model: string | null;
  session_started: number | null;
}

export interface SessionSearchResponse {
  results: SessionSearchResult[];
}

export interface LogsResponse {
  file: string;
  lines: string[];
}

// ─── Analytics ──────────────────────────────────────────────

export interface AnalyticsDailyEntry {
  day: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost: number;
  actual_cost: number;
  sessions: number;
  api_calls: number;
}

export interface AnalyticsModelEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  sessions: number;
  api_calls: number;
}

export interface AnalyticsSkillEntry {
  skill: string;
  view_count: number;
  manage_count: number;
  total_count: number;
  percentage: number;
  last_used_at: number | null;
}

export interface AnalyticsSkillsSummary {
  total_skill_loads: number;
  total_skill_edits: number;
  total_skill_actions: number;
  distinct_skills_used: number;
}

export interface AnalyticsResponse {
  daily: AnalyticsDailyEntry[];
  by_model: AnalyticsModelEntry[];
  totals: {
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_reasoning: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    total_sessions: number;
    total_api_calls: number;
  };
  skills: {
    summary: AnalyticsSkillsSummary;
    top_skills: AnalyticsSkillEntry[];
  };
}

// ─── Models Analytics (v0.12.0) ─────────────────────────────

export interface ModelsAnalyticsModelEntry {
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost: number;
  actual_cost: number;
  sessions: number;
  api_calls: number;
  tool_calls: number;
  last_used_at: number;
  avg_tokens_per_session: number;
  capabilities: {
    supports_tools?: boolean;
    supports_vision?: boolean;
    supports_reasoning?: boolean;
    context_window?: number;
    max_output_tokens?: number;
    model_family?: string;
  };
}

export interface ModelsAnalyticsResponse {
  models: ModelsAnalyticsModelEntry[];
  totals: {
    distinct_models: number;
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_reasoning: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    total_sessions: number;
    total_api_calls: number;
  };
  period_days: number;
}

// ─── Status ─────────────────────────────────────────────────

export interface StatusResponse {
  active_sessions: number;
  config_path: string;
  config_version: number;
  env_path: string;
  gateway_exit_reason: string | null;
  gateway_health_url: string | null;
  gateway_pid: number | null;
  gateway_platforms: Record<
    string,
    { state: string; error_code?: string; error_message?: string; updated_at: string }
  >;
  gateway_running: boolean;
  gateway_state: string | null;
  gateway_updated_at: string | null;
  hermes_home: string;
  latest_config_version: number;
  release_date: string;
  version: string;
}

// ─── Model Info & Config ────────────────────────────────────

export interface ModelInfoResponse {
  model: string;
  provider: string;
  auto_context_length: number;
  config_context_length: number;
  effective_context_length: number;
  capabilities: {
    supports_tools?: boolean;
    supports_vision?: boolean;
    supports_reasoning?: boolean;
    context_window?: number;
    max_output_tokens?: number;
    model_family?: string;
  };
}

export interface ModelOptionProvider {
  name: string;
  slug: string;
  models?: string[];
  total_models?: number;
  is_current?: boolean;
  is_user_defined?: boolean;
  source?: string;
  warning?: string;
}

export interface ModelOptionsResponse {
  model?: string;
  provider?: string;
  providers?: ModelOptionProvider[];
}

export interface AuxiliaryTaskAssignment {
  task: string;
  provider: string;
  model: string;
  base_url: string;
}

export interface AuxiliaryModelsResponse {
  tasks: AuxiliaryTaskAssignment[];
  main: { provider: string; model: string };
}

export interface ModelAssignmentRequest {
  scope: "main" | "auxiliary";
  provider: string;
  model: string;
  task?: string;
}

export interface ModelAssignmentResponse {
  ok: boolean;
  scope?: string;
  provider?: string;
  model?: string;
  tasks?: string[];
  reset?: boolean;
}

// ─── Env Vars ───────────────────────────────────────────────

export interface EnvVarInfo {
  is_set: boolean;
  redacted_value: string | null;
  description: string;
  url: string | null;
  category: string;
  is_password: boolean;
  tools: string[];
  advanced: boolean;
}

// ─── Cron Jobs ──────────────────────────────────────────────

export interface CronJob {
  id: string;
  name?: string;
  prompt: string;
  schedule: { kind: string; expr: string; display: string };
  schedule_display: string;
  enabled: boolean;
  state: string;
  deliver?: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
}

// ─── Skills & Toolsets ──────────────────────────────────────

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface ToolsetInfo {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  tools: string[];
}

// ─── Profiles ───────────────────────────────────────────────

export interface ProfileInfo {
  name: string;
  path: string;
  is_default: boolean;
  model: string | null;
  provider: string | null;
  has_env: boolean;
  skill_count: number;
}

// ─── OAuth Providers ────────────────────────────────────────

export interface OAuthProviderStatus {
  logged_in: boolean;
  source?: string | null;
  source_label?: string | null;
  token_preview?: string | null;
  expires_at?: string | null;
  has_refresh_token?: boolean;
  last_refresh?: string | null;
  error?: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  flow: "pkce" | "device_code" | "external";
  cli_command: string;
  docs_url: string;
  status: OAuthProviderStatus;
}

export interface OAuthProvidersResponse {
  providers: OAuthProvider[];
}

// ─── Plugins ────────────────────────────────────────────────

export interface PluginManifestResponse {
  name: string;
  label: string;
  description: string;
  icon: string;
  version: string;
  tab: {
    path: string;
    position?: string;
    override?: string;
    hidden?: boolean;
  };
  slots?: string[];
  entry: string;
  css?: string | null;
  has_api: boolean;
  source: string;
}

export interface HubAgentPluginRow {
  name: string;
  version: string;
  description: string;
  source: string;
  runtime_status: "disabled" | "enabled" | "inactive";
  has_dashboard_manifest: boolean;
  dashboard_manifest: PluginManifestResponse | null;
  path: string;
  can_remove: boolean;
  can_update_git: boolean;
  auth_required: boolean;
  auth_command: string;
  user_hidden: boolean;
}

export interface PluginsHubProviders {
  memory_provider: string;
  memory_options: Array<{ name: string; description: string }>;
  context_engine: string;
  context_options: Array<{ name: string; description: string }>;
}

export interface PluginsHubResponse {
  plugins: HubAgentPluginRow[];
  orphan_dashboard_plugins: PluginManifestResponse[];
  providers: PluginsHubProviders;
}

export interface AgentPluginInstallRequest {
  identifier: string;
  force?: boolean;
  enable?: boolean;
}

export interface AgentPluginInstallResponse {
  ok: boolean;
  plugin_name?: string;
  warnings?: string[];
  missing_env?: string[];
  after_install_path?: string | null;
  enabled?: boolean;
  error?: string;
}

export interface AgentPluginUpdateResponse {
  ok: boolean;
  name?: string;
  output?: string;
  unchanged?: boolean;
  error?: string;
}

export interface PluginProvidersPutRequest {
  memory_provider?: string;
  context_engine?: string;
}

// ─── OAuth Flow Types ───────────────────────────────────────

export type OAuthStartResponse =
  | {
      session_id: string;
      flow: "pkce";
      auth_url: string;
      expires_in: number;
    }
  | {
      session_id: string;
      flow: "device_code";
      user_code: string;
      verification_url: string;
      expires_in: number;
      poll_interval: number;
    };

export interface OAuthSubmitResponse {
  ok: boolean;
  status: "approved" | "error";
  message?: string;
}

export interface OAuthPollResponse {
  session_id: string;
  status: "pending" | "approved" | "denied" | "expired" | "error";
  error_message?: string | null;
  expires_at?: number | null;
}

// ─── Dashboard Themes ───────────────────────────────────────

export interface DashboardThemeSummary {
  description: string;
  label: string;
  name: string;
  definition?: Record<string, unknown>;
}

export interface DashboardThemesResponse {
  active: string;
  themes: DashboardThemeSummary[];
}

// ─── Actions ────────────────────────────────────────────────

export interface ActionResponse {
  name: string;
  ok: boolean;
  pid: number;
}

export interface ActionStatusResponse {
  exit_code: number | null;
  lines: string[];
  name: string;
  pid: number | null;
  running: boolean;
}

// ─── State ──────────────────────────────────────────────────

let _serverInfo: WebServerInfo | null = null;

async function ensureServer(): Promise<{ port: number; token: string }> {
  if (_serverInfo?.running && _serverInfo.port && _serverInfo.token) {
    return { port: _serverInfo.port, token: _serverInfo.token };
  }

  const info = await invoke<WebServerInfo>("start_web_server");
  _serverInfo = info;

  if (!info.running || !info.port || !info.token) {
    throw new Error("Failed to start Hermes Web Server");
  }

  return { port: info.port, token: info.token };
}

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const { port, token } = await ensureServer();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Public API ─────────────────────────────────────────────

/** Initialize the web server connection. Call early in app startup. */
export async function initWebServer(): Promise<WebServerInfo> {
  const info = await invoke<WebServerInfo>("start_web_server");
  _serverInfo = info;
  return info;
}

/** Get cached server info without starting. */
export async function getWebServerInfo(): Promise<WebServerInfo> {
  return invoke<WebServerInfo>("get_web_server_info");
}

/** Check if the web server is available (non-throwing). */
export function isAvailable(): boolean {
  return !!(_serverInfo?.running && _serverInfo.port && _serverInfo.token);
}

// ─── Sessions ───────────────────────────────────────────────

export async function getSessions(
  limit = 20,
  offset = 0
): Promise<PaginatedSessions> {
  return fetchAPI<PaginatedSessions>(
    `/api/sessions?limit=${limit}&offset=${offset}`
  );
}

export async function getSessionMessages(
  sessionId: string
): Promise<SessionMessagesResponse> {
  return fetchAPI<SessionMessagesResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages`
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
}

export async function searchSessions(
  query: string,
  limit = 20
): Promise<SessionSearchResponse> {
  return fetchAPI<SessionSearchResponse>(
    `/api/sessions/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
}

// ─── Logs ───────────────────────────────────────────────────

export async function getLogs(params: {
  file?: string;
  lines?: number;
  level?: string;
  component?: string;
}): Promise<LogsResponse> {
  const qs = new URLSearchParams();
  if (params.file) qs.set("file", params.file);
  if (params.lines) qs.set("lines", String(params.lines));
  if (params.level && params.level !== "ALL") qs.set("level", params.level);
  if (params.component && params.component !== "all")
    qs.set("component", params.component);
  return fetchAPI<LogsResponse>(`/api/logs?${qs.toString()}`);
}

// ─── Analytics ──────────────────────────────────────────────

export async function getAnalytics(days: number): Promise<AnalyticsResponse> {
  return fetchAPI<AnalyticsResponse>(`/api/analytics/usage?days=${days}`);
}

export async function getModelsAnalytics(
  days: number
): Promise<ModelsAnalyticsResponse> {
  return fetchAPI<ModelsAnalyticsResponse>(
    `/api/analytics/models?days=${days}`
  );
}

// ─── Status & Config ────────────────────────────────────────

export async function getStatus(): Promise<StatusResponse> {
  return fetchAPI<StatusResponse>("/api/status");
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  return fetchAPI<ModelInfoResponse>("/api/model/info");
}

export async function getModelOptions(): Promise<ModelOptionsResponse> {
  return fetchAPI<ModelOptionsResponse>("/api/model/options");
}

export async function getAuxiliaryModels(): Promise<AuxiliaryModelsResponse> {
  return fetchAPI<AuxiliaryModelsResponse>("/api/model/auxiliary");
}

export async function setModelAssignment(
  body: ModelAssignmentRequest
): Promise<ModelAssignmentResponse> {
  return fetchAPI<ModelAssignmentResponse>("/api/model/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Config (read/write) ────────────────────────────────────

export async function getConfig(): Promise<Record<string, unknown>> {
  return fetchAPI<Record<string, unknown>>("/api/config");
}

export async function getConfigDefaults(): Promise<Record<string, unknown>> {
  return fetchAPI<Record<string, unknown>>("/api/config/defaults");
}

export async function getConfigSchema(): Promise<{
  fields: Record<string, unknown>;
  category_order: string[];
}> {
  return fetchAPI("/api/config/schema");
}

export async function saveConfig(
  config: Record<string, unknown>
): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

export async function getConfigRaw(): Promise<{ yaml: string }> {
  return fetchAPI<{ yaml: string }>("/api/config/raw");
}

export async function saveConfigRaw(yaml_text: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/config/raw", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml_text }),
  });
}

// ─── Environment Variables ──────────────────────────────────

export async function getEnvVars(): Promise<Record<string, EnvVarInfo>> {
  return fetchAPI<Record<string, EnvVarInfo>>("/api/env");
}

export async function setEnvVar(key: string, value: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/env", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export async function deleteEnvVar(key: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/env", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

export async function revealEnvVar(
  key: string
): Promise<{ key: string; value: string }> {
  return fetchAPI<{ key: string; value: string }>("/api/env/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

// ─── Cron Jobs (enhanced v0.12.0) ───────────────────────────

export async function getCronJobs(): Promise<CronJob[]> {
  return fetchAPI<CronJob[]>("/api/cron/jobs");
}

export async function createCronJob(job: {
  prompt: string;
  schedule: string;
  name?: string;
  deliver?: string;
}): Promise<CronJob> {
  return fetchAPI<CronJob>("/api/cron/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
}

export async function pauseCronJob(id: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(`/api/cron/jobs/${id}/pause`, {
    method: "POST",
  });
}

export async function resumeCronJob(id: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(`/api/cron/jobs/${id}/resume`, {
    method: "POST",
  });
}

export async function triggerCronJob(id: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(`/api/cron/jobs/${id}/trigger`, {
    method: "POST",
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(`/api/cron/jobs/${id}`, {
    method: "DELETE",
  });
}

// ─── Skills & Toolsets ──────────────────────────────────────

export async function getSkills(): Promise<SkillInfo[]> {
  return fetchAPI<SkillInfo[]>("/api/skills");
}

export async function toggleSkill(
  name: string,
  enabled: boolean
): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/skills/toggle", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, enabled }),
  });
}

export async function getToolsets(): Promise<ToolsetInfo[]> {
  return fetchAPI<ToolsetInfo[]>("/api/tools/toolsets");
}

// ─── Profiles ───────────────────────────────────────────────

export async function getProfiles(): Promise<{ profiles: ProfileInfo[] }> {
  return fetchAPI<{ profiles: ProfileInfo[] }>("/api/profiles");
}

export async function createProfile(body: {
  name: string;
  clone_from_default: boolean;
}): Promise<{ ok: boolean; name: string; path: string }> {
  return fetchAPI<{ ok: boolean; name: string; path: string }>("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function renameProfile(
  name: string,
  newName: string
): Promise<{ ok: boolean; name: string; path: string }> {
  return fetchAPI<{ ok: boolean; name: string; path: string }>(
    `/api/profiles/${encodeURIComponent(name)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: newName }),
    }
  );
}

export async function deleteProfile(name: string): Promise<void> {
  await fetchAPI<{ ok: boolean }>(
    `/api/profiles/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}

export async function getProfileSetupCommand(
  name: string
): Promise<{ command: string }> {
  return fetchAPI<{ command: string }>(
    `/api/profiles/${encodeURIComponent(name)}/setup-command`
  );
}

export async function getProfileSoul(
  name: string
): Promise<{ content: string; exists: boolean }> {
  return fetchAPI<{ content: string; exists: boolean }>(
    `/api/profiles/${encodeURIComponent(name)}/soul`
  );
}

export async function updateProfileSoul(
  name: string,
  content: string
): Promise<void> {
  await fetchAPI<{ ok: boolean }>(
    `/api/profiles/${encodeURIComponent(name)}/soul`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
}

// ─── OAuth Providers ────────────────────────────────────────

export async function getOAuthProviders(): Promise<OAuthProvidersResponse> {
  return fetchAPI<OAuthProvidersResponse>("/api/providers/oauth");
}

export async function disconnectOAuthProvider(
  providerId: string
): Promise<{ ok: boolean; provider: string }> {
  return fetchAPI<{ ok: boolean; provider: string }>(
    `/api/providers/oauth/${encodeURIComponent(providerId)}`,
    { method: "DELETE" }
  );
}

export async function startOAuthLogin(
  providerId: string
): Promise<OAuthStartResponse> {
  return fetchAPI<OAuthStartResponse>(
    `/api/providers/oauth/${encodeURIComponent(providerId)}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
}

export async function submitOAuthCode(
  providerId: string,
  sessionId: string,
  code: string
): Promise<OAuthSubmitResponse> {
  return fetchAPI<OAuthSubmitResponse>(
    `/api/providers/oauth/${encodeURIComponent(providerId)}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, code }),
    }
  );
}

export async function pollOAuthSession(
  providerId: string,
  sessionId: string
): Promise<OAuthPollResponse> {
  return fetchAPI<OAuthPollResponse>(
    `/api/providers/oauth/${encodeURIComponent(providerId)}/poll/${encodeURIComponent(sessionId)}`
  );
}

export async function cancelOAuthSession(
  sessionId: string
): Promise<void> {
  await fetchAPI<{ ok: boolean }>(
    `/api/providers/oauth/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
}

// ─── Gateway / Hermes Actions ───────────────────────────────

export async function restartGateway(): Promise<ActionResponse> {
  return fetchAPI<ActionResponse>("/api/gateway/restart", { method: "POST" });
}

export async function updateHermes(): Promise<ActionResponse> {
  return fetchAPI<ActionResponse>("/api/hermes/update", { method: "POST" });
}

export async function getActionStatus(
  name: string,
  lines = 200
): Promise<ActionStatusResponse> {
  return fetchAPI<ActionStatusResponse>(
    `/api/actions/${encodeURIComponent(name)}/status?lines=${lines}`
  );
}

// ─── Plugins ────────────────────────────────────────────────

export async function getPlugins(): Promise<PluginManifestResponse[]> {
  return fetchAPI<PluginManifestResponse[]>("/api/dashboard/plugins");
}

export async function rescanPlugins(): Promise<{ ok: boolean; count: number }> {
  return fetchAPI<{ ok: boolean; count: number }>("/api/dashboard/plugins/rescan");
}

export async function getPluginsHub(): Promise<PluginsHubResponse> {
  return fetchAPI<PluginsHubResponse>("/api/dashboard/plugins/hub");
}

export async function installAgentPlugin(
  body: AgentPluginInstallRequest
): Promise<AgentPluginInstallResponse> {
  return fetchAPI<AgentPluginInstallResponse>("/api/dashboard/agent-plugins/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function enableAgentPlugin(
  name: string
): Promise<{ ok: boolean; name: string; unchanged?: boolean }> {
  return fetchAPI<{ ok: boolean; name: string; unchanged?: boolean }>(
    `/api/dashboard/agent-plugins/${encodeURIComponent(name)}/enable`,
    { method: "POST" }
  );
}

export async function disableAgentPlugin(
  name: string
): Promise<{ ok: boolean; name: string; unchanged?: boolean }> {
  return fetchAPI<{ ok: boolean; name: string; unchanged?: boolean }>(
    `/api/dashboard/agent-plugins/${encodeURIComponent(name)}/disable`,
    { method: "POST" }
  );
}

export async function updateAgentPlugin(
  name: string
): Promise<AgentPluginUpdateResponse> {
  return fetchAPI<AgentPluginUpdateResponse>(
    `/api/dashboard/agent-plugins/${encodeURIComponent(name)}/update`,
    { method: "POST" }
  );
}

export async function removeAgentPlugin(
  name: string
): Promise<{ ok: boolean; name: string }> {
  return fetchAPI<{ ok: boolean; name: string }>(
    `/api/dashboard/agent-plugins/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}

export async function savePluginProviders(
  body: PluginProvidersPutRequest
): Promise<void> {
  await fetchAPI<{ ok: boolean }>("/api/dashboard/plugin-providers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function setPluginVisibility(
  name: string,
  hidden: boolean
): Promise<{ ok: boolean; name: string; hidden: boolean }> {
  return fetchAPI<{ ok: boolean; name: string; hidden: boolean }>(
    `/api/dashboard/plugins/${encodeURIComponent(name)}/visibility`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    }
  );
}

// ─── Dashboard Themes ───────────────────────────────────────

export async function getThemes(): Promise<DashboardThemesResponse> {
  return fetchAPI<DashboardThemesResponse>("/api/dashboard/themes");
}

export async function setTheme(
  name: string
): Promise<{ ok: boolean; theme: string }> {
  return fetchAPI<{ ok: boolean; theme: string }>("/api/dashboard/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}
