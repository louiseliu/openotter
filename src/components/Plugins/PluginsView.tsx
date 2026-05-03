import { useEffect, useState, useCallback } from "react";
import {
  Puzzle,
  RefreshCw,
  Loader2,
  Power,
  PowerOff,
  Trash2,
  Download,
  ArrowUpCircle,
  Store,
  Package,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  X,
  Search,
} from "lucide-react";
import * as api from "../../lib/hermes-api";
import type {
  PluginManifestResponse,
  HubAgentPluginRow,
  PluginsHubResponse,
} from "../../lib/hermes-api";

type Tab = "installed" | "hub";

export default function PluginsView() {
  const [tab, setTab] = useState<Tab>("installed");
  const [plugins, setPlugins] = useState<PluginManifestResponse[]>([]);
  const [hub, setHub] = useState<PluginsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hubLoading, setHubLoading] = useState(false);
  const [actioningPlugin, setActioningPlugin] = useState<string | null>(null);
  const [installInput, setInstallInput] = useState("");
  const [installResult, setInstallResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [installing, setInstalling] = useState(false);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      await api.initWebServer();
      const list = await api.getPlugins();
      setPlugins(list);
    } catch (err) {
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHub = useCallback(async () => {
    setHubLoading(true);
    try {
      await api.initWebServer();
      const data = await api.getPluginsHub();
      setHub(data);
    } catch (err) {
      console.error("Failed to load hub:", err);
    } finally {
      setHubLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    if (tab === "hub" && !hub) loadHub();
  }, [tab, hub, loadHub]);

  const handleEnable = async (name: string) => {
    setActioningPlugin(name);
    try {
      await api.enableAgentPlugin(name);
      await loadPlugins();
      if (hub) await loadHub();
    } catch (err) {
      console.error("Enable failed:", err);
    } finally {
      setActioningPlugin(null);
    }
  };

  const handleDisable = async (name: string) => {
    setActioningPlugin(name);
    try {
      await api.disableAgentPlugin(name);
      await loadPlugins();
      if (hub) await loadHub();
    } catch (err) {
      console.error("Disable failed:", err);
    } finally {
      setActioningPlugin(null);
    }
  };

  const handleRemove = async (name: string) => {
    setActioningPlugin(name);
    try {
      await api.removeAgentPlugin(name);
      await loadPlugins();
      if (hub) await loadHub();
    } catch (err) {
      console.error("Remove failed:", err);
    } finally {
      setActioningPlugin(null);
    }
  };

  const handleUpdate = async (name: string) => {
    setActioningPlugin(name);
    try {
      await api.updateAgentPlugin(name);
      await loadPlugins();
      if (hub) await loadHub();
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setActioningPlugin(null);
    }
  };

  const handleInstall = async () => {
    if (!installInput.trim()) return;
    setInstalling(true);
    setInstallResult(null);
    try {
      const res = await api.installAgentPlugin({
        identifier: installInput.trim(),
        enable: true,
      });
      if (res.ok) {
        setInstallResult({
          ok: true,
          message: `插件 "${res.plugin_name}" 安装成功`,
        });
        setInstallInput("");
        await loadPlugins();
        if (hub) await loadHub();
      } else {
        setInstallResult({ ok: false, message: res.error || "安装失败" });
      }
    } catch (err) {
      setInstallResult({ ok: false, message: String(err) });
    } finally {
      setInstalling(false);
    }
  };

  const handleRescan = async () => {
    try {
      await api.rescanPlugins();
      await loadPlugins();
    } catch (err) {
      console.error("Rescan failed:", err);
    }
  };

  const handleVisibility = async (name: string, hidden: boolean) => {
    setActioningPlugin(name);
    try {
      await api.setPluginVisibility(name, hidden);
      await loadPlugins();
    } catch (err) {
      console.error("Visibility toggle failed:", err);
    } finally {
      setActioningPlugin(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">插件管理</h1>
            <p className="text-base text-zinc-500 mt-1">
              安装、配置和管理 Hermes Agent 插件
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRescan}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新扫描
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setTab("installed")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === "installed"
                ? "bg-hermes-600/20 text-hermes-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
            }`}
          >
            <Package className="w-4 h-4" />
            已安装 ({plugins.length})
          </button>
          <button
            onClick={() => setTab("hub")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === "hub"
                ? "bg-hermes-600/20 text-hermes-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
            }`}
          >
            <Store className="w-4 h-4" />
            插件 Hub
          </button>
        </div>

        {tab === "installed" && (
          <>
            {/* Quick install */}
            <div className="mb-6 bg-surface-1 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2">快速安装插件</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={installInput}
                  onChange={(e) => setInstallInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                  placeholder="输入插件标识符 (名称或 git URL)..."
                  className="flex-1 bg-surface-0 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
                />
                <button
                  onClick={handleInstall}
                  disabled={!installInput.trim() || installing}
                  className="px-4 py-2 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {installing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  安装
                </button>
              </div>
              {installResult && (
                <div
                  className={`flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-lg ${
                    installResult.ok
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {installResult.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {installResult.message}
                  <button
                    onClick={() => setInstallResult(null)}
                    className="ml-auto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : plugins.length === 0 ? (
              <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
                <Puzzle className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 mb-1">暂无已安装插件</p>
                <p className="text-xs text-zinc-600">
                  通过上方输入框或 Hub 安装插件
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {plugins.map((p) => (
                  <InstalledPluginCard
                    key={p.name}
                    plugin={p}
                    actioning={actioningPlugin === p.name}
                    onDisable={() => handleDisable(p.name)}
                    onRemove={() => handleRemove(p.name)}
                    onToggleVisibility={(hidden) =>
                      handleVisibility(p.name, hidden)
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "hub" && (
          <HubTab
            hub={hub}
            loading={hubLoading}
            actioningPlugin={actioningPlugin}
            onEnable={handleEnable}
            onDisable={handleDisable}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            onInstall={async (identifier) => {
              setActioningPlugin(identifier);
              try {
                await api.installAgentPlugin({
                  identifier,
                  enable: true,
                });
                await loadPlugins();
                await loadHub();
              } catch (err) {
                console.error("Install failed:", err);
              } finally {
                setActioningPlugin(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function InstalledPluginCard({
  plugin: p,
  actioning,
  onDisable,
  onRemove,
  onToggleVisibility,
}: {
  plugin: PluginManifestResponse;
  actioning: boolean;
  onDisable: () => void;
  onRemove: () => void;
  onToggleVisibility: (hidden: boolean) => void;
}) {
  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-hermes-500/10 flex items-center justify-center text-lg shrink-0">
        {p.icon || "🧩"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{p.label || p.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
            v{p.version}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-hermes-500/10 text-hermes-400">
            {p.source}
          </span>
          {p.tab?.hidden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
              隐藏
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleVisibility(!p.tab?.hidden)}
          disabled={actioning}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          title={p.tab?.hidden ? "显示" : "隐藏"}
        >
          {p.tab?.hidden ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={onDisable}
          disabled={actioning}
          className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
          title="禁用"
        >
          <PowerOff className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          disabled={actioning}
          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
          title="卸载"
        >
          {actioning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function HubTab({
  hub,
  loading,
  actioningPlugin,
  onEnable,
  onDisable,
  onRemove,
  onUpdate,
  onInstall,
}: {
  hub: PluginsHubResponse | null;
  loading: boolean;
  actioningPlugin: string | null;
  onEnable: (name: string) => void;
  onDisable: (name: string) => void;
  onRemove: (name: string) => void;
  onUpdate: (name: string) => void;
  onInstall: (identifier: string) => void;
}) {
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
        <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400">无法加载插件 Hub</p>
        <p className="text-xs text-zinc-600 mt-1">
          请确保 Hermes Web Server 已启动
        </p>
      </div>
    );
  }

  const filtered = hub.plugins.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Providers */}
      <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          系统提供者
        </p>
        <div className="flex gap-4 text-xs text-zinc-400">
          <span>
            记忆引擎:{" "}
            <span className="text-zinc-200 font-medium">
              {hub.providers.memory_provider}
            </span>
          </span>
          <span>
            上下文引擎:{" "}
            <span className="text-zinc-200 font-medium">
              {hub.providers.context_engine}
            </span>
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索插件..."
          className="w-full bg-surface-1 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
        />
      </div>

      {/* Plugin list */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <HubPluginCard
            key={p.name}
            plugin={p}
            actioning={actioningPlugin === p.name}
            onEnable={() => onEnable(p.name)}
            onDisable={() => onDisable(p.name)}
            onRemove={() => onRemove(p.name)}
            onUpdate={() => onUpdate(p.name)}
            onInstall={() => onInstall(p.name)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-zinc-500 text-sm">
          {search ? `未找到匹配「${search}」的插件` : "暂无可用插件"}
        </div>
      )}
    </div>
  );
}

function HubPluginCard({
  plugin: p,
  actioning,
  onEnable,
  onDisable,
  onRemove,
  onUpdate,
  onInstall,
}: {
  plugin: HubAgentPluginRow;
  actioning: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onRemove: () => void;
  onUpdate: () => void;
  onInstall: () => void;
}) {
  const statusColor = {
    enabled: "bg-emerald-500/10 text-emerald-400",
    disabled: "bg-zinc-800 text-zinc-500",
    inactive: "bg-amber-500/10 text-amber-400",
  }[p.runtime_status];

  const statusLabel = {
    enabled: "已启用",
    disabled: "已禁用",
    inactive: "未激活",
  }[p.runtime_status];

  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-hermes-500/10 flex items-center justify-center text-lg shrink-0">
          {p.dashboard_manifest?.icon || "🧩"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">
              {p.dashboard_manifest?.label || p.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
              v{p.version}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500">
              {p.source}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {p.description}
          </p>
          {p.auth_required && (
            <p className="text-[10px] text-amber-400 mt-1">
              需要认证: <code className="text-zinc-400">{p.auth_command}</code>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.runtime_status === "inactive" ? (
            <button
              onClick={onInstall}
              disabled={actioning}
              className="px-3 py-1.5 bg-hermes-600/20 text-hermes-400 hover:bg-hermes-600/30 text-xs rounded-lg transition-colors flex items-center gap-1"
            >
              {actioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              安装
            </button>
          ) : (
            <>
              {p.runtime_status === "disabled" ? (
                <button
                  onClick={onEnable}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                  title="启用"
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={onDisable}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                  title="禁用"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                </button>
              )}
              {p.can_update_git && (
                <button
                  onClick={onUpdate}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors"
                  title="更新"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {p.can_remove && (
                <button
                  onClick={onRemove}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                  title="卸载"
                >
                  {actioning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
