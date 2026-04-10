import { useEffect } from "react";
import {
  Plus,
  Play,
  Square,
  Trash2,
  Settings,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useAgentStore } from "../../stores/agentStore";

export default function AgentsListView() {
  const { setView, navigateToAgent } = useAppStore();
  const { agents, gatewayStatuses, refresh, startGateway, stopGateway, removeAgent } =
    useAgentStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const platformLabels: Record<string, string> = {
    feishu: "飞书",
    dingtalk: "钉钉",
    wecom: "企微",
    telegram: "Telegram",
    discord: "Discord",
    slack: "Slack",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-zinc-100">Agent 管理</h1>
          <button
            onClick={() => setView("agent-create")}
            className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建 Agent
          </button>
        </div>

        <div className="space-y-3">
          {agents.map((agent) => {
            const gw = gatewayStatuses[agent.id];
            const isRunning = !!gw?.running;

            return (
              <div
                key={agent.id}
                className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-hermes-500/30 to-hermes-700/30 flex items-center justify-center text-xl shrink-0">
                  {agent.avatar || "🤖"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-zinc-100">{agent.name}</h3>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                      }`}
                    />
                    <span className="text-xs text-zinc-500">
                      {isRunning ? "运行中" : "已停止"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">{agent.model}</span>
                    {agent.platforms.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-zinc-400"
                      >
                        {platformLabels[p] || p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <button
                      onClick={() => stopGateway(agent.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"
                      title="停止"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startGateway(agent.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="启动"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => navigateToAgent(agent.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-surface-2 transition-colors"
                    title="设置"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`确定删除 Agent "${agent.name}"？`)) {
                        removeAgent(agent.id);
                      }
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {agents.length === 0 && (
            <div className="text-center py-16 text-zinc-500">
              <p className="mb-4">还没有创建任何 Agent</p>
              <button
                onClick={() => setView("agent-create")}
                className="text-hermes-400 hover:text-hermes-300 text-sm"
              >
                创建第一个 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
