import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  FileText,
  Plug,
  Terminal,
  Save,
  Loader2,
  MessageSquare,
  User,
  Bot,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  QrCode,
  Check,
  AlertTriangle,
  Settings,
  File,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useAgentStore } from "../../stores/agentStore";
import {
  getAgent,
  getAgentLogs,
  getPlatformTemplates,
  configurePlatform,
  unconfigurePlatform,
  getAgentMessages,
  listProfileFiles,
  getProfileFile,
  saveProfileFile,
  startQrSession,
  stopQrSession,
  detectQrCredentials,
  checkQrPlatformSupport,
  onQrSessionOutput,
  onQrSessionEnded,
  type AgentMeta,
  type PlatformTemplate,
  type ProfileFileInfo,
  type ImSession,
} from "../../lib/hermes-bridge";

import AgentEvolutionPanel from "./AgentEvolutionPanel";
import PersonalityEditor from "./PersonalityEditor";

type Tab = "overview" | "evolution" | "messages" | "soul" | "platforms" | "config" | "logs";

const PLATFORM_ICONS: Record<string, string> = {
  feishu: "/icons/channels/feishu.png",
  dingtalk: "/icons/channels/dingding.png",
  wecom: "/icons/channels/wecom.png",
  weixin: "/icons/channels/weixin.png",
  telegram: "/icons/channels/telegram.png",
  discord: "/icons/channels/discord.png",
  slack: "/icons/channels/slack.png",
  whatsapp: "/icons/channels/whatsapp.png",
  signal: "/icons/channels/signal.png",
  sms: "📲",
  email: "/icons/channels/email.png",
  mattermost: "/icons/channels/mattermost.png",
  matrix: "/icons/channels/matrix.png",
  homeassistant: "/icons/channels/homeassistant.png",
  bluebubbles: "🍎",
};

const PLATFORM_LABELS: Record<string, string> = {
  feishu: "飞书",
  dingtalk: "钉钉",
  wecom: "企微",
  weixin: "微信",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  whatsapp: "WhatsApp",
  signal: "Signal",
  sms: "SMS",
  email: "邮件",
  mattermost: "Mattermost",
  matrix: "Matrix",
  homeassistant: "Home Assistant",
  bluebubbles: "iMessage",
};

function PlatformIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  const icon = PLATFORM_ICONS[platform];
  if (icon && icon.startsWith("/")) {
    return (
      <img
        src={icon}
        alt={platform}
        className="rounded"
        style={{ width: size, height: size }}
      />
    );
  }
  return <span style={{ fontSize: size * 0.8 }}>{icon || "🔌"}</span>;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const date = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) return `今天 ${timeStr}`;
  if (diffDays === 1) return `昨天 ${timeStr}`;
  if (diffDays < 7) return `${diffDays}天前 ${timeStr}`;
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUptime(secs: number): string {
  if (secs < 60) return `${secs} 秒`;
  if (secs < 3600) return `${Math.floor(secs / 60)} 分钟`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h} 小时 ${m} 分钟`;
}

export default function AgentDetailView() {
  const { selectedAgentId, setView } = useAppStore();
  const { gatewayStatuses, startGateway, stopGateway } = useAgentStore();

  const [agent, setAgent] = useState<AgentMeta | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [logs, setLogs] = useState("");
  const [platformTemplates, setPlatformTemplates] = useState<PlatformTemplate[]>([]);
  const [addingPlatform, setAddingPlatform] = useState<string | null>(null);
  const [platformValues, setPlatformValues] = useState<Record<string, string>>({});
  const [platformSaving, setPlatformSaving] = useState(false);

  const [sessions, setSessions] = useState<ImSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgentId) return;
    getAgent(selectedAgentId).then(setAgent).catch(console.error);
    getPlatformTemplates().then(setPlatformTemplates).catch(console.error);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId || tab !== "logs") return;
    const load = () => getAgentLogs(selectedAgentId).then(setLogs).catch(console.error);
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [selectedAgentId, tab]);

  useEffect(() => {
    if (!selectedAgentId || tab !== "messages") return;
    loadMessages();
  }, [selectedAgentId, tab]);

  const loadMessages = async () => {
    if (!selectedAgentId) return;
    setSessionsLoading(true);
    try {
      const data = await getAgentMessages(selectedAgentId, 50);
      setSessions(data);
      if (data.length > 0 && !expandedSession) {
        setExpandedSession(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  if (!selectedAgentId || !agent) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        Agent 未找到
      </div>
    );
  }

  const gw = gatewayStatuses[agent.id];
  const isRunning = !!gw?.running;

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "概览", icon: FileText },
    { id: "evolution", label: "进化", icon: Sparkles },
    { id: "messages", label: "消息", icon: MessageSquare },
    { id: "soul", label: "人格", icon: FileText },
    { id: "platforms", label: "平台", icon: Plug },
    { id: "config", label: "配置", icon: Settings },
    { id: "logs", label: "日志", icon: Terminal },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView("agents")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-hermes-500/30 to-hermes-700/30 flex items-center justify-center text-2xl">
            {agent.avatar || "🤖"}
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-100">{agent.name}</h1>
            <p className="text-sm text-zinc-500">
              {agent.model} · {agent.description || "无描述"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                isRunning
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                }`}
              />
              {isRunning ? "运行中" : "已停止"}
            </div>

            {isRunning ? (
              <button
                onClick={() => stopGateway(agent.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                停止
              </button>
            ) : (
              <button
                onClick={() => startGateway(agent.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                启动
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                tab === t.id
                  ? "border-hermes-500 text-hermes-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "overview" && (
          <div className="space-y-4">
            <InfoRow label="ID" value={agent.id} />
            <InfoRow label="模型" value={agent.model} />
            <InfoRow label="Provider" value={agent.provider} />
            <InfoRow
              label="接入平台"
              value={
                agent.platforms.length > 0
                  ? agent.platforms.map((p) => PLATFORM_LABELS[p] || p).join(", ")
                  : "未接入"
              }
            />
            <InfoRow
              label="创建时间"
              value={new Date(agent.created_at * 1000).toLocaleString()}
            />
            {gw?.uptime_secs != null && (
              <InfoRow label="运行时间" value={formatUptime(gw.uptime_secs)} />
            )}
          </div>
        )}

        {tab === "evolution" && selectedAgentId && (
          <AgentEvolutionPanel agentId={selectedAgentId} />
        )}

        {tab === "messages" && (
          <MessagesTab
            sessions={sessions}
            loading={sessionsLoading}
            expandedSession={expandedSession}
            onToggleSession={(id) =>
              setExpandedSession((prev) => (prev === id ? null : id))
            }
            onRefresh={loadMessages}
            hasPlatforms={agent.platforms.length > 0}
          />
        )}

        {tab === "soul" && selectedAgentId && (
          <PersonalityEditor agentId={selectedAgentId} />
        )}

        {tab === "platforms" && (
          <div className="space-y-4">
            {agent.platforms.length > 0 && (
              <div className="space-y-3">
                {agent.platforms.map((p) => (
                  <div
                    key={p}
                    className="flex items-center justify-between p-4 bg-surface-1 border border-zinc-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                        <PlatformIcon platform={p} size={20} />
                      </div>
                      <span className="text-sm text-zinc-200">
                        {PLATFORM_LABELS[p] || p}
                      </span>
                      <span className={`text-xs ${isRunning ? "text-emerald-400" : "text-zinc-500"}`}>
                        {isRunning ? "已连接" : "未启动"}
                      </span>
                    </div>
                    <button
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-colors"
                      onClick={async () => {
                        if (!confirm(`确定要解绑 ${PLATFORM_LABELS[p] || p} 吗？凭证将从此 Agent 的配置中移除。`)) return;
                        try {
                          await unconfigurePlatform({ agent_id: agent.id, platform: p });
                          const updated = await getAgent(agent.id);
                          setAgent(updated);
                        } catch (err) {
                          console.error("Failed to unconfigure platform:", err);
                        }
                      }}
                    >
                      解绑
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingPlatform ? (
              <AddPlatformForm
                template={platformTemplates.find((t) => t.id === addingPlatform)!}
                agentId={agent.id}
                values={platformValues}
                saving={platformSaving}
                onChange={(key, value) => setPlatformValues((prev) => ({ ...prev, [key]: value }))}
                onSave={async () => {
                  setPlatformSaving(true);
                  try {
                    await configurePlatform({
                      agent_id: agent.id,
                      platform: addingPlatform,
                      config: platformValues,
                    });
                    const updated = await getAgent(agent.id);
                    setAgent(updated);
                    setAddingPlatform(null);
                    setPlatformValues({});
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setPlatformSaving(false);
                  }
                }}
                onCancel={() => {
                  setAddingPlatform(null);
                  setPlatformValues({});
                }}
              />
            ) : (
              <div>
                <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
                  添加平台
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {platformTemplates
                    .filter((t) => !agent.platforms.includes(t.id))
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setAddingPlatform(t.id);
                          const initial: Record<string, string> = {};
                          t.fields.forEach((f) => (initial[f.key] = ""));
                          setPlatformValues(initial);
                        }}
                        className="flex items-center gap-3 text-left p-3 rounded-xl border border-zinc-800 bg-surface-1 hover:border-zinc-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                          <PlatformIcon platform={t.id} size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{t.name}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{t.description}</div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "config" && selectedAgentId && (
          <ProfileConfigTab agentId={selectedAgentId} />
        )}

        {tab === "logs" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-zinc-300">Gateway 日志</label>
              <button
                onClick={() => getAgentLogs(agent.id).then(setLogs)}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300"
              >
                <RefreshCw className="w-3 h-3" />
                刷新
              </button>
            </div>
            <pre className="bg-surface-2 border border-zinc-700 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
              {logs || "暂无日志"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileConfigTab({ agentId }: { agentId: string }) {
  const [files, setFiles] = useState<ProfileFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    listProfileFiles(agentId).then(setFiles).catch(console.error);
  }, [agentId]);

  const handleSelectFile = async (name: string) => {
    try {
      const content = await getProfileFile(agentId, name);
      setSelectedFile(name);
      setFileContent(content);
      setOriginalContent(content);
      setSaveMsg(null);
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveProfileFile(agentId, selectedFile, fileContent);
      setOriginalContent(fileContent);
      setSaveMsg({ ok: true, text: "保存成功！重启 Gateway 后生效" });
    } catch (err) {
      setSaveMsg({
        ok: false,
        text: `保存失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const isDirty = fileContent !== originalContent;
  const isEditable = files.find((f) => f.name === selectedFile)?.editable ?? false;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400/70">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>高级功能 — 修改配置文件可能影响 Agent 运行，请谨慎操作。修改后需重启 Gateway 生效。</span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 space-y-1">
          <p className="text-xs text-zinc-500 mb-2 px-1">Profile 文件</p>
          {files.filter((f) => f.editable).map((f) => (
            <button
              key={f.name}
              onClick={() => handleSelectFile(f.name)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                selectedFile === f.name
                  ? "bg-hermes-500/10 text-hermes-400 border border-hermes-500/30"
                  : "text-zinc-400 hover:bg-surface-1 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <File className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="ml-auto text-[10px] text-zinc-600">{formatSize(f.size)}</span>
            </button>
          ))}
          {files.some((f) => !f.editable) && (
            <>
              <div className="border-t border-zinc-800 my-2" />
              <p className="text-[10px] text-zinc-600 mb-1 px-1">其他文件（只读）</p>
              {files.filter((f) => !f.editable).map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600"
                >
                  <File className="w-3 h-3 shrink-0 opacity-40" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-[10px]">{formatSize(f.size)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="col-span-3">
          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{selectedFile}</span>
                  {isEditable ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-hermes-500/10 text-hermes-400">可编辑</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">只读</span>
                  )}
                  {isDirty && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">未保存</span>
                  )}
                </div>
                {isEditable && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="inline-flex items-center gap-1.5 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    保存
                  </button>
                )}
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => isEditable && setFileContent(e.target.value)}
                readOnly={!isEditable}
                spellCheck={false}
                className="w-full h-[420px] bg-surface-1 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed resize-none focus:outline-none focus:border-hermes-500/30 placeholder:text-zinc-600"
              />
              {saveMsg && (
                <p className={`text-xs ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {saveMsg.text}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Settings className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">选择左侧文件查看或编辑</p>
              <p className="text-xs text-zinc-600 mt-1">.env、SOUL.md、config.yaml 可编辑</p>
              <div className="mt-4 px-4 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-[11px] text-amber-400/70">⚠ 高级功能 — 正常情况请勿修改，错误配置可能导致 Agent 无法正常工作</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessagesTab({
  sessions,
  loading,
  expandedSession,
  onToggleSession,
  onRefresh,
  hasPlatforms,
}: {
  sessions: ImSession[];
  loading: boolean;
  expandedSession: string | null;
  onToggleSession: (id: string) => void;
  onRefresh: () => void;
  hasPlatforms: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!hasPlatforms) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm mb-1">该 Agent 未接入任何 IM 平台</p>
        <p className="text-xs text-zinc-600">请在「平台」Tab 中添加 IM 渠道</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-300">IM 会话</span>
          {sessions.length > 0 && (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
              {sessions.length} 条会话
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm mb-1">暂无 IM 消息</p>
          <p className="text-xs text-zinc-600">启动 Gateway 后，来自 IM 平台的消息将在此展示</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isExpanded = expandedSession === session.id;
            const lastMsg = session.messages[session.messages.length - 1];
            const preview =
              session.messages.find((m) => m.role === "user")?.content || "";

            return (
              <div
                key={session.id}
                className="bg-surface-1 border border-zinc-800 rounded-xl overflow-hidden"
              >
                {/* Session Header */}
                <button
                  onClick={() => onToggleSession(session.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <PlatformIcon platform={session.source} size={24} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {session.title || preview.slice(0, 40) || "会话"}
                      </span>
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                        {PLATFORM_LABELS[session.source] || session.source}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {preview.slice(0, 80)}
                      {preview.length > 80 ? "..." : ""}
                    </p>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(lastMsg?.timestamp || session.started_at)}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {session.messages.length} 条消息
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Messages */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-surface-2/30 max-h-[500px] overflow-y-auto">
                    <div className="p-4 space-y-3">
                      {session.messages.map((msg, idx) => (
                        <MessageBubble key={msg.id ?? idx} message={msg} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: { role: string; content: string; timestamp: number; source: string } }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-blue-500/15 text-blue-400"
            : "bg-hermes-500/15 text-hermes-400"
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium text-zinc-400">
            {isUser ? "用户" : "AI"}
          </span>
          {message.timestamp > 0 && (
            <span className="text-[10px] text-zinc-600">
              {new Date(message.timestamp * 1000).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>
        <div
          className={`text-sm leading-relaxed rounded-xl px-3.5 py-2.5 ${
            isUser
              ? "bg-blue-500/8 text-zinc-200 border border-blue-500/10"
              : "bg-zinc-800/60 text-zinc-300 border border-zinc-700/50"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{value}</span>
    </div>
  );
}

const QR_PLATFORMS: Set<string> = new Set(["whatsapp", "weixin"]);

function AddPlatformForm({
  template,
  agentId,
  values,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  template: PlatformTemplate;
  agentId: string;
  values: Record<string, string>;
  saving: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isQrPlatform = QR_PLATFORMS.has(template.id);
  const [qrMode, setQrMode] = useState(isQrPlatform);
  const [qrSupported, setQrSupported] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionOutput, setSessionOutput] = useState<string[]>([]);
  const [paired, setPaired] = useState(false);
  const [pairMsg, setPairMsg] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isQrPlatform) {
      checkQrPlatformSupport(template.id)
        .then(setQrSupported)
        .catch(() => setQrSupported(false));
    }
  }, [isQrPlatform, template.id]);

  useEffect(() => {
    if (!sessionActive) return;

    let unOutput: (() => void) | null = null;
    let unEnded: (() => void) | null = null;

    onQrSessionOutput((data) => {
      setSessionOutput((prev) => [...prev, data]);
    }).then((fn) => {
      unOutput = fn;
    });

    onQrSessionEnded(() => {
      setSessionActive(false);
    }).then((fn) => {
      unEnded = fn;
    });

    pollRef.current = setInterval(async () => {
      try {
        const result = await detectQrCredentials(template.id);
        if (result.found) {
          setPaired(true);
          setPairMsg(result.message);
          for (const [key, val] of Object.entries(result.credentials)) {
            onChange(key, val);
          }
          if (pollRef.current) clearInterval(pollRef.current);
          await stopQrSession();
          setSessionActive(false);
          try {
            await configurePlatform({
              agent_id: agentId,
              platform: template.id,
              config: result.credentials,
            });
            setPairMsg(result.message + " 已自动保存配置。");
          } catch {
            setPairMsg(result.message + " 自动保存失败，请手动保存。");
          }
        }
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => {
      unOutput?.();
      unEnded?.();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionActive, template.id, agentId]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [sessionOutput]);

  const handleStartSession = async () => {
    setSessionOutput([]);
    setPaired(false);
    setPairMsg("");
    try {
      await startQrSession(template.id);
      setSessionActive(true);
    } catch (err) {
      setSessionOutput([`启动失败: ${err}`]);
    }
  };

  const handleStopSession = async () => {
    await stopQrSession();
    setSessionActive(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleCancel = () => {
    if (sessionActive) {
      stopQrSession().catch(() => {});
    }
    if (pollRef.current) clearInterval(pollRef.current);
    onCancel();
  };

  if (!template) return null;

  if (isQrPlatform && qrMode) {
    const isWeixin = template.id === "weixin";
    const weixinUnsupported = isWeixin && qrSupported === false;

    return (
      <div className="bg-surface-1 border border-hermes-500/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-zinc-200">
            接入 {template.name}
          </h3>
          <button
            onClick={() => {
              if (sessionActive) handleStopSession();
              setQrMode(false);
              setSessionOutput([]);
              setPaired(false);
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            切换到手动填写 →
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">{template.description}</p>

        {weixinUnsupported && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                微信适配器可能需要更新 Hermes 到最新版。
              </p>
            </div>
          </div>
        )}

        {!sessionActive && !paired && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-7 h-7 text-hermes-400" />
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              {template.id === "whatsapp"
                ? "点击按钮获取 QR 码，用 WhatsApp 扫描即可"
                : "点击按钮获取 QR 码，用微信扫描即可"}
            </p>
            <button
              onClick={handleStartSession}
              className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <QrCode className="w-4 h-4" />
              获取二维码
            </button>
          </div>
        )}

        {sessionActive && !paired && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-zinc-400">等待扫码...</span>
              </div>
              <button
                onClick={handleStopSession}
                className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
              >
                取消
              </button>
            </div>
            <pre
              ref={outputRef}
              className="bg-black rounded-xl p-4 text-[11px] text-green-400 overflow-auto max-h-[280px] whitespace-pre select-all"
              style={{
                fontFamily:
                  "'SF Mono', 'Monaco', 'Cascadia Code', 'Menlo', monospace",
                lineHeight: "1.1",
                letterSpacing: "0px",
              }}
            >
              {sessionOutput.length === 0
                ? "正在启动，请稍候..."
                : sessionOutput.join("")}
            </pre>
            <p className="text-[10px] text-zinc-600 mt-2 text-center">
              {template.id === "whatsapp"
                ? "打开 WhatsApp → 设置 → 已关联的设备 → 关联设备 → 扫描上方 QR 码"
                : "打开微信 → 扫一扫 → 扫描上方二维码 → 手机确认登录"}
            </p>
          </div>
        )}

        {paired && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm text-emerald-300 font-medium mb-1">
              {pairMsg || "配对成功！"}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            {paired ? "完成" : "取消"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-hermes-500/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-zinc-200">
          接入 {template.name}
        </h3>
        {isQrPlatform && (
          <button
            onClick={() => setQrMode(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← 切换到扫码连接
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-4">{template.description}</p>

      <div className="text-xs text-zinc-500 bg-surface-2 rounded-lg p-3 mb-4 whitespace-pre-line">
        {template.setup_guide}
        {template.setup_url && (
          <a
            href={template.setup_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-hermes-400 hover:text-hermes-300 mt-2"
          >
            打开开放平台 →
          </a>
        )}
      </div>

      <div className="space-y-3">
        {template.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs text-zinc-400 mb-1">
              {field.label}
              {field.required && (
                <span className="text-hermes-400 ml-0.5">*</span>
              )}
            </label>
            <input
              type={field.secret ? "password" : "text"}
              value={values[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full bg-surface-2 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
            />
            {field.help && (
              <p className="text-[10px] text-zinc-600 mt-0.5">{field.help}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          取消
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          保存
        </button>
      </div>
    </div>
  );
}
