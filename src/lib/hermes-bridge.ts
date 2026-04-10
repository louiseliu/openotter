import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ─── Types ─────────────────────────────────────────────────

export interface AppStatus {
  install_status: "NotInstalled" | "NeedsSetup" | { Broken: string } | "Ready";
  hermes_version: string | null;
  hermes_home: string;
  sidecar_running: boolean;
  sidecar_port: number | null;
  agent_count: number;
  running_gateways: number;
}

export interface AgentMeta {
  id: string;
  name: string;
  description: string;
  avatar: string;
  provider: string;
  model: string;
  platforms: string[];
  created_at: number;
  updated_at: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  env_key: string;
  placeholder: string;
  models: string[];
  group: string;
  get_key_url: string;
}

export interface PlatformTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  fields: PlatformField[];
  setup_url: string;
  setup_guide: string;
}

export interface PlatformField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  secret: boolean;
  help: string;
}

export interface GatewayStatus {
  agent_id: string;
  running: boolean;
  pid: number | null;
  platforms: { name: string; connected: boolean }[];
  uptime_secs: number | null;
}

export interface ChatResponse {
  content: string;
  tool_calls: { name: string; status: string; output_preview: string | null }[];
  conversation_id: string;
}

// ─── App Status ────────────────────────────────────────────

export async function getAppStatus(): Promise<AppStatus> {
  return invoke<AppStatus>("get_app_status");
}

// ─── Agent CRUD ────────────────────────────────────────────

export async function createAgent(request: {
  name: string;
  description: string;
  avatar: string;
  soul_md: string;
  provider: string;
  model: string;
  api_key: string;
}): Promise<AgentMeta> {
  return invoke<AgentMeta>("create_agent", { request });
}

export async function listAgents(): Promise<AgentMeta[]> {
  return invoke<AgentMeta[]>("list_agents");
}

export async function getAgent(id: string): Promise<AgentMeta> {
  return invoke<AgentMeta>("get_agent", { id });
}

export async function deleteAgent(id: string): Promise<void> {
  return invoke("delete_agent", { id });
}

export async function getAgentSoul(id: string): Promise<string> {
  return invoke<string>("get_agent_soul", { id });
}

export async function updateAgentSoul(id: string, soulMd: string): Promise<void> {
  return invoke("update_agent_soul", { id, soulMd });
}

// ─── Platform Configuration ────────────────────────────────

export async function configurePlatform(request: {
  agent_id: string;
  platform: string;
  config: Record<string, string>;
}): Promise<void> {
  return invoke("configure_platform", { request });
}

export async function getPlatformTemplates(): Promise<PlatformTemplate[]> {
  return invoke<PlatformTemplate[]>("get_platform_templates");
}

// ─── Channel Bots ──────────────────────────────────────────

export interface ChannelBot {
  id: string;
  name: string;
  platform_id: string;
  config: Record<string, string>;
  created_at: number;
}

export async function listChannelBots(): Promise<ChannelBot[]> {
  return invoke<ChannelBot[]>("list_channel_bots");
}

export async function addChannelBot(
  name: string,
  platformId: string,
  config: Record<string, string>
): Promise<ChannelBot> {
  return invoke<ChannelBot>("add_channel_bot", {
    request: { name, platform_id: platformId, config },
  });
}

export async function updateChannelBot(
  id: string,
  name?: string,
  config?: Record<string, string>
): Promise<ChannelBot> {
  return invoke<ChannelBot>("update_channel_bot", {
    request: { id, name, config },
  });
}

export async function removeChannelBot(id: string): Promise<void> {
  return invoke("remove_channel_bot", { id });
}

// ─── Gateway Management ────────────────────────────────────

export async function startAgentGateway(id: string): Promise<GatewayStatus> {
  return invoke<GatewayStatus>("start_agent_gateway", { id });
}

export async function stopAgentGateway(id: string): Promise<void> {
  return invoke("stop_agent_gateway", { id });
}

export async function getGatewayStatus(id: string): Promise<GatewayStatus> {
  return invoke<GatewayStatus>("get_gateway_status", { id });
}

export async function getAllGatewayStatuses(): Promise<GatewayStatus[]> {
  return invoke<GatewayStatus[]>("get_all_gateway_statuses");
}

export async function getAgentLogs(id: string): Promise<string> {
  return invoke<string>("get_agent_logs", { id });
}

// ─── IM Messages ────────────────────────────────────────────

export interface ImMessage {
  id: number | null;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  source: string;
  user_id: string | null;
  model: string | null;
}

export interface ImSession {
  id: string;
  source: string;
  user_id: string | null;
  model: string | null;
  started_at: number;
  message_count: number | null;
  title: string | null;
  messages: ImMessage[];
}

export async function getAgentMessages(
  id: string,
  limit?: number
): Promise<ImSession[]> {
  return invoke<ImSession[]>("get_agent_messages", { id, limit: limit ?? null });
}

// ─── Providers ─────────────────────────────────────────────

export async function getProviders(): Promise<ProviderInfo[]> {
  return invoke<ProviderInfo[]>("get_providers");
}

export async function saveApiConfig(
  provider: string,
  apiKey: string,
  model: string
): Promise<void> {
  return invoke("save_api_config", { provider, apiKey, model });
}

// ─── Chat ──────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  conversationId?: string | null
): Promise<ChatResponse> {
  return invoke<ChatResponse>("send_chat_message", {
    request: { message, conversation_id: conversationId ?? null },
  });
}

export async function sendChatMessageStreaming(
  message: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: string) => void,
  _conversationId?: string | null
): Promise<void> {
  const status = await getAppStatus();
  if (!status.sidecar_port) {
    onError("Hermes sidecar is not running");
    return;
  }

  const url = `http://127.0.0.1:${status.sidecar_port}/v1/chat/completions`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: [{ role: "user", content: message }],
        stream: true,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      onError(`API error ${resp.status}: ${text}`);
      return;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") && !contentType.includes("text/plain")) {
      const json = await resp.json();
      const content =
        json.choices?.[0]?.message?.content ??
        json.choices?.[0]?.delta?.content ??
        "";
      if (content) {
        onDone(content);
      } else {
        onError(`Unexpected response format: ${JSON.stringify(json).slice(0, 200)}`);
      }
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) {
      onError("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onDone(fullText);
          return;
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          chunkCount++;
          const delta =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.message?.content ??
            null;
          if (delta != null && delta !== "") {
            fullText += delta;
            onChunk(fullText);
          }
        } catch {
          console.warn("[hermes-stream] malformed SSE chunk:", data.slice(0, 100));
        }
      }
    }

    if (fullText) {
      onDone(fullText);
    } else if (chunkCount === 0 && buffer.trim()) {
      try {
        const fallback = JSON.parse(buffer);
        const content = fallback.choices?.[0]?.message?.content ?? "";
        onDone(content || `Empty response from Hermes (raw: ${buffer.slice(0, 100)})`);
      } catch {
        onError(`No content received from stream (buffer: ${buffer.slice(0, 100)})`);
      }
    } else {
      onDone(fullText);
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }
}

// ─── Connectivity & Config ──────────────────────────────────

export interface ConnectivityResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
}

export interface CurrentConfig {
  model: string | null;
  provider: string | null;
  has_api_key: boolean;
  api_server_enabled: boolean;
  api_server_port: string | null;
}

export async function testProviderConnectivity(
  providerId: string,
  apiKey: string,
  model: string
): Promise<ConnectivityResult> {
  return invoke<ConnectivityResult>("test_provider_connectivity", {
    providerId,
    apiKey,
    model,
  });
}

export async function testSavedConnectivity(): Promise<ConnectivityResult> {
  return invoke<ConnectivityResult>("test_saved_connectivity");
}

export async function getCurrentConfig(): Promise<CurrentConfig> {
  return invoke<CurrentConfig>("get_current_config");
}

// ─── Skills ─────────────────────────────────────────────────

export interface SkillInfo {
  name: string;
  category: string;
  source: string;
  path: string | null;
}

export async function listSkills(): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>("list_skills");
}

export async function getSkillContent(name: string): Promise<string> {
  return invoke<string>("get_skill_content", { name });
}

// ─── Memory / Sessions ──────────────────────────────────────

export interface SessionStats {
  total_sessions: number;
  total_messages: number;
  db_size_mb: number;
  platforms: { name: string; sessions: number }[];
}

export interface SessionListItem {
  id: string;
  preview: string;
  source: string;
  last_active: string;
}

export async function getSessionStats(): Promise<SessionStats> {
  return invoke<SessionStats>("get_session_stats");
}

export async function listRecentSessions(
  source?: string,
  limit?: number
): Promise<SessionListItem[]> {
  return invoke<SessionListItem[]>("list_recent_sessions", {
    source: source ?? null,
    limit: limit ?? null,
  });
}

// ─── Cron ───────────────────────────────────────────────────

export interface CronJobInfo {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  status: string;
  next_run: string;
  last_run: string;
}

export async function listCronJobs(): Promise<CronJobInfo[]> {
  return invoke<CronJobInfo[]>("list_cron_jobs");
}

export async function createCronJob(
  schedule: string,
  prompt: string,
  name?: string
): Promise<string> {
  return invoke<string>("create_cron_job", {
    schedule,
    prompt,
    name: name ?? null,
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  return invoke("delete_cron_job", { id });
}

// ─── MCP ────────────────────────────────────────────────────

export interface McpServerInfo {
  name: string;
  transport: string;
  tools_count: number;
  status: string;
}

export async function listMcpServers(): Promise<McpServerInfo[]> {
  return invoke<McpServerInfo[]>("list_mcp_servers");
}

// ─── Insights ───────────────────────────────────────────────

export interface HermesInsights {
  sessions: number;
  messages: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: string;
  models: { model: string; sessions: number; tokens: number }[];
  platforms: {
    platform: string;
    sessions: number;
    messages: number;
    tokens: number;
  }[];
  top_tools: { tool: string; calls: number; percentage: number }[];
}

export async function getHermesInsights(days?: number): Promise<HermesInsights> {
  return invoke<HermesInsights>("get_hermes_insights", {
    days: days ?? null,
  });
}

// ─── Session Search ─────────────────────────────────────────

export interface SearchResult {
  session_id: string;
  title: string | null;
  started_at: number;
  source: string;
  message_count: number;
  model: string;
  snippet: string;
}

export async function searchSessions(
  query: string,
  limit?: number
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_sessions_cmd", {
    query,
    limit: limit ?? null,
  });
}

// ─── Model Manager ──────────────────────────────────────────

export interface SavedModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  base_url: string;
  created_at: number;
}

export async function listSavedModels(): Promise<SavedModel[]> {
  return invoke<SavedModel[]>("list_saved_models");
}

export async function addSavedModel(
  name: string,
  provider: string,
  model: string,
  baseUrl: string
): Promise<SavedModel> {
  return invoke<SavedModel>("add_saved_model", {
    name,
    provider,
    model,
    baseUrl,
  });
}

export async function removeSavedModel(id: string): Promise<boolean> {
  return invoke<boolean>("remove_saved_model", { id });
}

export async function updateSavedModel(
  id: string,
  name?: string,
  provider?: string,
  model?: string,
  baseUrl?: string
): Promise<boolean> {
  return invoke<boolean>("update_saved_model", {
    id,
    name: name ?? null,
    provider: provider ?? null,
    model: model ?? null,
    baseUrl: baseUrl ?? null,
  });
}

// ─── Credential Pool ────────────────────────────────────────

export interface CredentialEntry {
  key: string;
  label: string;
}

export async function getCredentialPool(): Promise<
  Record<string, CredentialEntry[]>
> {
  return invoke<Record<string, CredentialEntry[]>>("get_credential_pool");
}

export async function setCredentialPool(
  provider: string,
  entries: CredentialEntry[]
): Promise<boolean> {
  return invoke<boolean>("set_credential_pool", { provider, entries });
}

// ─── Claw3D ─────────────────────────────────────────────────

export interface Claw3dStatus {
  cloned: boolean;
  installed: boolean;
  dev_server_running: boolean;
  adapter_running: boolean;
  running: boolean;
  port: number;
  port_in_use: boolean;
  ws_url: string;
  error: string;
}

export interface Claw3dSetupProgress {
  step: number;
  total_steps: number;
  title: string;
  detail: string;
}

export async function claw3dGetStatus(): Promise<Claw3dStatus> {
  return invoke<Claw3dStatus>("claw3d_get_status");
}

export async function claw3dSetup(): Promise<void> {
  return invoke("claw3d_setup");
}

export async function claw3dStartAll(): Promise<void> {
  return invoke("claw3d_start_all");
}

export async function claw3dStopAll(): Promise<void> {
  return invoke("claw3d_stop_all");
}

export async function claw3dStartDev(): Promise<void> {
  return invoke("claw3d_start_dev");
}

export async function claw3dStopDev(): Promise<void> {
  return invoke("claw3d_stop_dev");
}

export async function claw3dStartAdapter(): Promise<void> {
  return invoke("claw3d_start_adapter");
}

export async function claw3dStopAdapter(): Promise<void> {
  return invoke("claw3d_stop_adapter");
}

export async function claw3dGetPort(): Promise<number> {
  return invoke<number>("claw3d_get_port");
}

export async function claw3dSetPort(port: number): Promise<void> {
  return invoke("claw3d_set_port", { port });
}

export async function claw3dGetWsUrl(): Promise<string> {
  return invoke<string>("claw3d_get_ws_url");
}

export async function claw3dSetWsUrl(url: string): Promise<void> {
  return invoke("claw3d_set_ws_url", { url });
}

export async function onClaw3dSetupProgress(
  cb: (progress: Claw3dSetupProgress) => void
): Promise<UnlistenFn> {
  return listen<Claw3dSetupProgress>("claw3d-setup-progress", (e) =>
    cb(e.payload)
  );
}

// ─── Toolset ────────────────────────────────────────────────

export interface ToolsetInfo {
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
}

export async function listToolsets(): Promise<ToolsetInfo[]> {
  return invoke<ToolsetInfo[]>("list_toolsets");
}

export async function toggleToolset(
  name: string,
  enable: boolean
): Promise<void> {
  return invoke("toggle_toolset", { name, enable });
}

// ─── Hermes Installation Management ─────────────────────────

export interface Prerequisites {
  has_git: boolean;
  git_version: string | null;
  has_python: boolean;
  python_version: string | null;
  has_uv: boolean;
  uv_version: string | null;
  is_china_network: boolean;
}

export type HermesInstallSource =
  | "SystemExisting"
  | "OpenOtterManaged"
  | "NotInstalled";

export interface HermesInstallInfo {
  source: HermesInstallSource;
  binary_path: string | null;
  version: string | null;
  hermes_home: string;
  can_update: boolean;
  meets_min_version: boolean;
}

export interface InstallProgress {
  stage: string;
  step: number;
  total_steps: number;
  progress: number;
  message: string;
  error: string | null;
  done: boolean;
}

export async function checkHermesPrerequisites(): Promise<Prerequisites> {
  return invoke<Prerequisites>("check_hermes_prerequisites");
}

export async function detectHermesInstallation(): Promise<HermesInstallInfo> {
  return invoke<HermesInstallInfo>("detect_hermes_installation");
}

export async function installHermesAgent(
  useChinaMirror: boolean
): Promise<void> {
  return invoke("install_hermes_agent", { useChinaMirror });
}

export async function updateHermesAgent(
  useChinaMirror: boolean
): Promise<void> {
  return invoke("update_hermes_agent", { useChinaMirror });
}

export async function onInstallProgress(
  cb: (progress: InstallProgress) => void
): Promise<UnlistenFn> {
  return listen<InstallProgress>("hermes-install-progress", (e) =>
    cb(e.payload)
  );
}

// ─── Sidecar ───────────────────────────────────────────────

export async function startHermesSidecar(): Promise<number> {
  return invoke<number>("start_hermes_sidecar");
}

export async function stopHermesSidecar(): Promise<void> {
  return invoke("stop_hermes_sidecar");
}

// ─── Events ────────────────────────────────────────────────

export async function onHermesStdout(cb: (line: string) => void): Promise<UnlistenFn> {
  return listen<string>("hermes-stdout", (e) => cb(e.payload));
}

export async function onHermesStderr(cb: (line: string) => void): Promise<UnlistenFn> {
  return listen<string>("hermes-stderr", (e) => cb(e.payload));
}

export async function onHermesReady(cb: (port: number) => void): Promise<UnlistenFn> {
  return listen<number>("hermes-ready", (e) => cb(e.payload));
}

export async function onHermesTerminated(cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<number | null>("hermes-terminated", (e) => cb(e.payload));
}

export async function onGatewayStarted(cb: (agentId: string) => void): Promise<UnlistenFn> {
  return listen<string>("gateway-started", (e) => cb(e.payload));
}

export async function onGatewayStopped(cb: (agentId: string) => void): Promise<UnlistenFn> {
  return listen<string>("gateway-stopped", (e) => cb(e.payload));
}
