import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Sparkles,
  Settings,
  Radio,
  Brain,
  Clock,
  Plug,
  Sun,
  Moon,
  Cpu,
  KeyRound,
  Box,
} from "lucide-react";
import { useAppStore, type View } from "../../stores/appStore";

const navItems: { id: View; icon: typeof LayoutDashboard; label: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "总览" },
  { id: "agents", icon: Bot, label: "Agent" },
  { id: "chat", icon: MessageSquare, label: "对话" },
  { id: "channels", icon: Radio, label: "渠道" },
  { id: "skills", icon: Sparkles, label: "技能" },
  { id: "memory", icon: Brain, label: "记忆" },
  { id: "models", icon: Cpu, label: "模型" },
  { id: "credentials", icon: KeyRound, label: "凭证" },
  { id: "cron", icon: Clock, label: "定时" },
  { id: "mcp", icon: Plug, label: "MCP" },
  { id: "claw3d", icon: Box, label: "3D" },
  { id: "settings", icon: Settings, label: "设置" },
];

export default function Sidebar() {
  const { currentView, setView, appStatus, theme, toggleTheme } = useAppStore();

  const isAgentView =
    currentView === "agents" ||
    currentView === "agent-create" ||
    currentView === "agent-detail";

  return (
    <aside className="w-20 bg-surface-0 border-r border-zinc-800 flex flex-col items-center py-5 gap-1.5 shrink-0">
      <div className="mb-5 flex flex-col items-center gap-1.5">
        <img
          src="/logo.png"
          alt="OpenOtter"
          className="w-11 h-11 rounded-xl object-cover"
          draggable={false}
        />
        <span className="text-[10px] text-zinc-500 font-medium tracking-wider">
          OpenOtter
        </span>
      </div>

      <div className="w-10 h-px bg-zinc-800 mb-2" />

      {navItems.map(({ id, icon: Icon, label }) => {
        const active =
          currentView === id || (id === "agents" && isAgentView);
        return (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-colors gap-1 ${
              active
                ? "bg-hermes-600/20 text-hermes-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      {appStatus && (
        <div className="flex flex-col items-center gap-1 mb-3">
          {appStatus.running_gateways > 0 && (
            <div className="flex items-center gap-1.5" title={`${appStatus.running_gateways} 个 Agent 运行中`}>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">
                {appStatus.running_gateways}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={toggleTheme}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 transition-colors mb-2"
        title={theme === "dark" ? "切换到浅色模式" : "切换到暗黑模式"}
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>

      <div className="text-[10px] text-zinc-600 text-center leading-tight">
        v0.1
      </div>
    </aside>
  );
}
