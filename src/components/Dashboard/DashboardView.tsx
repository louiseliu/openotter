import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Bot,
  Zap,
  Activity,
  Server,
  Settings,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Cpu,
  DollarSign,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useAgentStore } from "../../stores/agentStore";
import {
  getCurrentConfig,
  getAppStatus,
  startHermesSidecar,
  getHermesInsights,
  type CurrentConfig,
  type HermesInsights,
} from "../../lib/hermes-bridge";
import SessionSearch from "../Sessions/SessionSearch";

export default function DashboardView() {
  const {
    appStatus,
    setView,
    navigateToAgent,
    sidecarError,
    sidecarStarting,
    setSidecarError,
    setSidecarStarting,
    setAppStatus,
  } = useAppStore();
  const { agents, gatewayStatuses, refresh } = useAgentStore();
  const [currentConfig, setCurrentConfig] = useState<CurrentConfig | null>(null);
  const [insights, setInsights] = useState<HermesInsights | null>(null);

  useEffect(() => {
    refresh();
    getCurrentConfig().then(setCurrentConfig).catch(console.error);
    const timer = setTimeout(() => {
      getHermesInsights(7).then(setInsights).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [refresh]);

  const handleStartGateway = useCallback(async () => {
    setSidecarStarting(true);
    setSidecarError(null);
    try {
      const port = await startHermesSidecar();
      console.log("Gateway started on port", port);
      const freshStatus = await getAppStatus();
      setAppStatus(freshStatus);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Failed to start gateway:", msg);
      setSidecarError(msg);
    } finally {
      setSidecarStarting(false);
    }
  }, [setSidecarStarting, setSidecarError, setAppStatus]);

  const runningCount = Object.keys(gatewayStatuses).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="mb-6">
          <div className="max-w-md">
            <SessionSearch />
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">总览</h1>
            <p className="text-base text-zinc-500 mt-1">
              管理你的 AI Agent，接入 IM 平台
            </p>
          </div>
          <button
            onClick={() => setView("agent-create")}
            className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-5 py-3 rounded-xl text-base font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            创建 Agent
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5 mb-10">
          <StatCard
            icon={Bot}
            label="Agent 总数"
            value={String(agents.length)}
            color="hermes"
          />
          <StatCard
            icon={Activity}
            label="运行中"
            value={String(runningCount)}
            color="emerald"
          />
          <StatCard
            icon={Server}
            label="Hermes"
            value={appStatus?.hermes_version || "未安装"}
            color="blue"
          />
        </div>

        {/* Config Warning */}
        {currentConfig && !currentConfig.has_api_key && (
          <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300 font-medium">尚未配置 API Key</p>
              <p className="text-xs text-amber-400/70 mt-1">
                请先在设置中配置 AI 模型提供商的 API Key，才能使用 Agent 功能。
              </p>
              <button
                onClick={() => setView("settings")}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 mt-2"
              >
                <Settings className="w-3 h-3" />
                前往设置
              </button>
            </div>
          </div>
        )}

        {currentConfig && currentConfig.has_api_key && !appStatus?.sidecar_running && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
            sidecarError
              ? "bg-red-500/5 border border-red-500/20"
              : sidecarStarting
                ? "bg-amber-500/5 border border-amber-500/20"
                : "bg-blue-500/5 border border-blue-500/20"
          }`}>
            {sidecarStarting ? (
              <Loader2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin" />
            ) : sidecarError ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                sidecarError ? "text-red-300" : sidecarStarting ? "text-amber-300" : "text-blue-300"
              }`}>
                {sidecarStarting
                  ? "正在启动 Gateway..."
                  : sidecarError
                    ? "Gateway 启动失败"
                    : `已配置: ${currentConfig.model || "未知模型"}`}
              </p>
              <p className={`text-xs mt-1 ${
                sidecarError ? "text-red-400/70" : sidecarStarting ? "text-amber-400/70" : "text-blue-400/70"
              }`}>
                {sidecarStarting
                  ? "Gateway 正在初始化，请稍候..."
                  : sidecarError
                    ? sidecarError
                    : "Gateway 未运行，点击下方按钮启动。"}
              </p>
              {!sidecarStarting && (
                <button
                  onClick={handleStartGateway}
                  className={`inline-flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    sidecarError
                      ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {sidecarError ? "重试启动" : "启动 Gateway"}
                </button>
              )}
            </div>
          </div>
        )}

        {currentConfig && currentConfig.has_api_key && appStatus?.sidecar_running && (
          <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-300 font-medium">
                Gateway 运行中 — {currentConfig.model || "未知模型"}
              </p>
              <p className="text-xs text-emerald-400/70 mt-1">
                API 服务正常，可使用 Chat 和 IM 平台功能。
              </p>
            </div>
          </div>
        )}

        {/* Insights */}
        {insights && (insights.sessions > 0 || insights.messages > 0) && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5">
              近 7 天使用统计
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MiniStat
                icon={<MessageSquare className="w-4 h-4 text-blue-400" />}
                label="会话"
                value={String(insights.sessions)}
              />
              <MiniStat
                icon={<BarChart3 className="w-4 h-4 text-hermes-400" />}
                label="消息"
                value={String(insights.messages)}
              />
              <MiniStat
                icon={<Cpu className="w-4 h-4 text-purple-400" />}
                label="Tokens"
                value={
                  insights.total_tokens > 100000
                    ? `${(insights.total_tokens / 1000).toFixed(0)}K`
                    : String(insights.total_tokens)
                }
              />
              <MiniStat
                icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                label="费用"
                value={insights.estimated_cost || "$0"}
              />
            </div>
            {insights.models.length > 0 && (
              <div className="bg-surface-1 border border-zinc-800 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                  模型使用
                </p>
                <div className="flex flex-wrap gap-2">
                  {insights.models.map((m) => (
                    <span
                      key={m.model}
                      className="text-xs px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400"
                    >
                      {m.model}{" "}
                      <span className="text-zinc-600">({m.sessions} 会话)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Agent Cards */}
        <section>
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5">
            我的 Agent
          </h2>

          {agents.length === 0 ? (
            <EmptyAgents onCreate={() => setView("agent-create")} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.map((agent) => {
                const gw = gatewayStatuses[agent.id];
                const isRunning = !!gw?.running;
                return (
                  <AgentCard
                    key={agent.id}
                    name={agent.name}
                    description={agent.description}
                    avatar={agent.avatar}
                    platforms={agent.platforms}
                    model={agent.model}
                    running={isRunning}
                    uptime={gw?.uptime_secs}
                    onClick={() => navigateToAgent(agent.id)}
                  />
                );
              })}

              <button
                onClick={() => setView("agent-create")}
                className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors min-h-[180px]"
              >
                <Plus className="w-10 h-10" />
                <span className="text-base">创建新 Agent</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    hermes: "text-hermes-400 bg-hermes-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
  };
  const cls = colorMap[color] || colorMap.hermes;

  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="text-2xl font-bold text-zinc-100 whitespace-nowrap">{value}</p>
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  name,
  description,
  avatar,
  platforms,
  model,
  running,
  uptime,
  onClick,
}: {
  name: string;
  description: string;
  avatar: string;
  platforms: string[];
  model: string;
  running: boolean;
  uptime?: number | null;
  onClick: () => void;
}) {
  const platformLabels: Record<string, string> = {
    feishu: "飞书",
    dingtalk: "钉钉",
    wecom: "企微",
    telegram: "Telegram",
    discord: "Discord",
    slack: "Slack",
  };

  const formatUptime = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  };

  return (
    <button
      onClick={onClick}
      className="bg-surface-1 border border-zinc-800 rounded-xl p-6 text-left hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-hermes-500/30 to-hermes-700/30 flex items-center justify-center text-xl shrink-0">
          {avatar || "🤖"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100 truncate">{name}</h3>
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                running ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
              }`}
            />
          </div>
          <p className="text-sm text-zinc-500 mt-1 line-clamp-1">
            {description || model}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {platforms.map((p) => (
          <span
            key={p}
            className="text-xs px-2 py-0.5 rounded bg-surface-2 text-zinc-400"
          >
            {platformLabels[p] || p}
          </span>
        ))}
        {platforms.length === 0 && (
          <span className="text-xs text-zinc-600">未接入平台</span>
        )}

        <div className="flex-1" />

        {running && uptime != null && (
          <span className="text-xs text-emerald-400">
            {formatUptime(uptime)}
          </span>
        )}
      </div>
    </button>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function EmptyAgents({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-6">
        <Bot className="w-10 h-10 text-zinc-600" />
      </div>
      <h3 className="text-xl font-semibold text-zinc-300 mb-3">
        还没有 Agent
      </h3>
      <p className="text-base text-zinc-500 max-w-md mx-auto mb-8">
        创建你的第一个 AI Agent，接入飞书、钉钉、企微等 IM 平台
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-3 rounded-xl text-base font-medium transition-colors"
      >
        <Zap className="w-5 h-5" />
        创建第一个 Agent
      </button>
    </div>
  );
}
