import { useState, useEffect } from "react";
import {
  Server,
  Key,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  Activity,
  ExternalLink,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Zap,
  Wrench,
  Download,
  Globe,
  Package,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import {
  getAppStatus,
  getProviders,
  saveApiConfig,
  getCurrentConfig,
  testProviderConnectivity,
  testSavedConnectivity,
  startHermesSidecar,
  listToolsets,
  toggleToolset,
  detectHermesInstallation,
  updateHermesAgent,
  onInstallProgress,
  type ProviderInfo,
  type CurrentConfig,
  type ConnectivityResult,
  type ToolsetInfo,
  type HermesInstallInfo,
  type InstallProgress,
} from "../../lib/hermes-bridge";

export default function SettingsView() {
  const { appStatus, setAppStatus } = useAppStore();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<CurrentConfig | null>(null);
  const [testResult, setTestResult] = useState<ConnectivityResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [startingSidecar, setStartingSidecar] = useState(false);
  const [savedTestResult, setSavedTestResult] = useState<ConnectivityResult | null>(null);
  const [savedTesting, setSavedTesting] = useState(false);

  useEffect(() => {
    getProviders().then((p) => {
      setProviders(p);
      if (p.length > 0) {
        setSelectedProvider(p[0].id);
        setSelectedModel(p[0].models[0] || "");
      }
    });
    getCurrentConfig().then((cfg) => {
      setCurrentConfig(cfg);
      if (cfg.has_api_key) {
        setSavedTesting(true);
        testSavedConnectivity()
          .then(setSavedTestResult)
          .catch((err) => {
            setSavedTestResult({
              success: false,
              message: err instanceof Error ? err.message : String(err),
              latency_ms: null,
            });
          })
          .finally(() => setSavedTesting(false));
      }
    }).catch(console.error);
    loadToolsets();
    detectHermesInstallation().then(setHermesInfo).catch(console.error);
  }, []);

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  const handleSave = async () => {
    if (!currentProvider || !selectedModel) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveApiConfig(selectedProvider, apiKey, selectedModel);
      setSaveMsg("配置已保存！");
      const [status, config] = await Promise.all([getAppStatus(), getCurrentConfig()]);
      setAppStatus(status);
      setCurrentConfig(config);
    } catch (err) {
      setSaveMsg(`错误: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnectivity(selectedProvider, apiKey, selectedModel);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latency_ms: null,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [status, config] = await Promise.all([getAppStatus(), getCurrentConfig()]);
      setAppStatus(status);
      setCurrentConfig(config);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSavedTest = async () => {
    setSavedTesting(true);
    setSavedTestResult(null);
    try {
      const result = await testSavedConnectivity();
      setSavedTestResult(result);
    } catch (err) {
      setSavedTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latency_ms: null,
      });
    } finally {
      setSavedTesting(false);
    }
  };

  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [toolsetsLoading, setToolsetsLoading] = useState(false);
  const [togglingToolset, setTogglingToolset] = useState<string | null>(null);

  const loadToolsets = async () => {
    setToolsetsLoading(true);
    try {
      const list = await listToolsets();
      setToolsets(list);
    } catch (err) {
      console.error("Failed to load toolsets:", err);
    } finally {
      setToolsetsLoading(false);
    }
  };

  const handleToggleToolset = async (name: string, enable: boolean) => {
    setTogglingToolset(name);
    try {
      await toggleToolset(name, enable);
      await loadToolsets();
    } catch (err) {
      console.error("Failed to toggle toolset:", err);
    } finally {
      setTogglingToolset(null);
    }
  };

  const [sidecarError, setSidecarError] = useState<string | null>(null);
  const [hermesInfo, setHermesInfo] = useState<HermesInstallInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<InstallProgress | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleStartSidecar = async () => {
    setStartingSidecar(true);
    setSidecarError(null);
    try {
      await startHermesSidecar();
      const [status, config] = await Promise.all([getAppStatus(), getCurrentConfig()]);
      setAppStatus(status);
      setCurrentConfig(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSidecarError(msg);
    } finally {
      setStartingSidecar(false);
    }
  };

  const installStatus = appStatus?.install_status;
  const isReady = installStatus === "Ready";

  const configuredProvider = currentConfig?.provider
    ? providers.find((p) => p.id === currentConfig.provider)
    : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-10 px-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-8">设置</h1>

        {/* Current Config Card */}
        {currentConfig && currentConfig.has_api_key && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              当前配置
            </h2>
            <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-hermes-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-hermes-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {configuredProvider?.name || currentConfig.provider || "未知 Provider"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    模型: <code className="text-zinc-400">{currentConfig.model || "未设置"}</code>
                  </p>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  {savedTestResult ? (
                    <div className="flex items-center gap-1.5">
                      {savedTestResult.success ? (
                        <>
                          <Wifi className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-emerald-400">
                            连通 {savedTestResult.latency_ms != null && `(${savedTestResult.latency_ms}ms)`}
                          </span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400 max-w-[160px] truncate" title={savedTestResult.message}>
                            {savedTestResult.message}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-400">已配置</span>
                    </div>
                  )}
                  <button
                    onClick={handleSavedTest}
                    disabled={savedTesting}
                    className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-40 ${
                      savedTestResult?.success
                        ? "text-emerald-400 hover:text-emerald-300"
                        : "text-zinc-400 hover:text-hermes-400"
                    }`}
                    title="测试已保存配置的连通性"
                  >
                    {savedTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {savedTestResult && !savedTestResult.success && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-2">
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span>{savedTestResult.message}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>API Server: {currentConfig.api_server_enabled ? `已启用 (端口 ${currentConfig.api_server_port || "自动"})` : "未启用"}</span>
                {appStatus?.sidecar_running && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400">Gateway 运行中</span>
                  </>
                )}
              </div>

              {!appStatus?.sidecar_running && isReady && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleStartSidecar}
                    disabled={startingSidecar}
                    className="inline-flex items-center gap-1.5 text-xs text-hermes-400 hover:text-hermes-300"
                  >
                    {startingSidecar ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {startingSidecar ? "正在启动 Gateway..." : "启动 Gateway（启用 Chat 功能）"}
                  </button>
                  {sidecarError && (
                    <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                      {sidecarError}
                    </p>
                  )}
                </div>
              )}
              {appStatus?.sidecar_running && (
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-400">Gateway 运行中 (端口 {appStatus.sidecar_port})</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Status Card */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            系统状态
          </h2>
          <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5 space-y-3">
            <StatusRow
              icon={Server}
              label="Hermes Agent"
              value={appStatus?.hermes_version || "未检测到"}
              ok={!!appStatus?.hermes_version}
            />
            <StatusRow
              icon={CheckCircle2}
              label="安装状态"
              value={
                isReady
                  ? "就绪"
                  : typeof installStatus === "object" && installStatus !== null && "Broken" in installStatus
                  ? `异常: ${installStatus.Broken}`
                  : String(installStatus ?? "未知")
              }
              ok={isReady}
            />
            <StatusRow
              icon={FolderOpen}
              label="Hermes 目录"
              value={appStatus?.hermes_home || "~/.hermes"}
              ok={true}
            />
            <StatusRow
              icon={Server}
              label="API Server"
              value={
                appStatus?.sidecar_running
                  ? `运行中 (端口 ${appStatus.sidecar_port})`
                  : "已停止"
              }
              ok={!!appStatus?.sidecar_running}
            />
            <StatusRow
              icon={Bot}
              label="Agent 数量"
              value={String(appStatus?.agent_count ?? 0)}
              ok={true}
            />
            <StatusRow
              icon={Activity}
              label="运行中 Gateway"
              value={String(appStatus?.running_gateways ?? 0)}
              ok={(appStatus?.running_gateways ?? 0) > 0}
            />

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs text-hermes-400 hover:text-hermes-300 mt-2"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
              />
              刷新状态
            </button>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            API 配置
          </h2>
          <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-base text-zinc-300 mb-2">
                Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  const p = providers.find((pr) => pr.id === e.target.value);
                  if (p) setSelectedModel(p.models[0] || "");
                  setTestResult(null);
                }}
                className="w-full bg-surface-2 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
              >
                {["china", "international", "custom"].map((group) => {
                  const groupProviders = providers.filter((p) => p.group === group);
                  if (groupProviders.length === 0) return null;
                  const label = group === "china" ? "中国" : group === "international" ? "国际" : "自定义";
                  return (
                    <optgroup key={group} label={label}>
                      {groupProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-base text-zinc-300 mb-2">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={currentProvider?.placeholder || "输入 API Key"}
                  className="w-full bg-surface-2 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {currentProvider?.get_key_url && (
                <a
                  href={currentProvider.get_key_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-hermes-400 hover:text-hermes-300 mt-1"
                >
                  获取 API Key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div>
              <label className="block text-base text-zinc-300 mb-2">
                模型
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-surface-2 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
              >
                {currentProvider?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                  testResult.success
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {testResult.success ? (
                  <Wifi className="w-4 h-4 shrink-0" />
                ) : (
                  <WifiOff className="w-4 h-4 shrink-0" />
                )}
                {testResult.message}
              </div>
            )}

            {saveMsg && (
              <p
                className={`text-sm px-3 py-2 rounded-lg ${
                  saveMsg.startsWith("错误")
                    ? "text-red-400 bg-red-500/10"
                    : "text-emerald-400 bg-emerald-500/10"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing || !apiKey}
                className="inline-flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                测试连通性
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存配置
              </button>
            </div>
          </div>
        </section>

        {/* Toolset */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            工具集
          </h2>
          {toolsetsLoading ? (
            <div className="flex items-center justify-center py-8 bg-surface-1 border border-zinc-800 rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : toolsets.length === 0 ? (
            <div className="text-center py-8 bg-surface-1 border border-zinc-800 rounded-xl">
              <Wrench className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">暂无可用工具集</p>
            </div>
          ) : (
            <div className="bg-surface-1 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {toolsets.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{t.icon || "🔧"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">
                        {t.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleToolset(t.name, !t.enabled)}
                    disabled={togglingToolset === t.name}
                    className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                      t.enabled ? "bg-hermes-600" : "bg-zinc-700"
                    } ${togglingToolset === t.name ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                        t.enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Hermes Installation */}
        {hermesInfo && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              Hermes Agent
            </h2>
            <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-hermes-500/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-hermes-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">
                      {hermesInfo.version || "未安装"}
                    </p>
                    {hermesInfo.source === "OpenOtterManaged" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-hermes-500/20 text-hermes-300">
                        OpenOtter 管理
                      </span>
                    )}
                    {hermesInfo.source === "SystemExisting" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        系统安装
                      </span>
                    )}
                  </div>
                  {hermesInfo.binary_path && (
                    <p className="text-xs text-zinc-500 truncate" title={hermesInfo.binary_path}>
                      {hermesInfo.binary_path}
                    </p>
                  )}
                </div>
                {hermesInfo.meets_min_version ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-amber-500 shrink-0" />
                )}
              </div>

              {hermesInfo.can_update && (
                <div className="pt-2 border-t border-zinc-800">
                  {updateProgress && updating && (
                    <div className="mb-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{updateProgress.message}</span>
                        <span>{Math.round(updateProgress.progress * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-hermes-500 rounded-full transition-all duration-300"
                          style={{ width: `${updateProgress.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updateError && (
                    <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-3">
                      {updateError}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setUpdating(true);
                        setUpdateError(null);
                        setUpdateProgress(null);
                        const unlisten = await onInstallProgress((p) => {
                          setUpdateProgress(p);
                          if (p.done && !p.error) {
                            setUpdating(false);
                            detectHermesInstallation().then(setHermesInfo);
                            getAppStatus().then(setAppStatus);
                          }
                          if (p.error) {
                            setUpdating(false);
                            setUpdateError(p.error);
                          }
                        });
                        try {
                          const info = await detectHermesInstallation();
                          await updateHermesAgent(info.hermes_home.includes("china") || false);
                        } catch (err) {
                          setUpdateError(err instanceof Error ? err.message : String(err));
                          setUpdating(false);
                        }
                        unlisten();
                      }}
                      disabled={updating}
                      className="inline-flex items-center gap-1.5 text-xs text-hermes-400 hover:text-hermes-300 disabled:opacity-40"
                    >
                      {updating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {updating ? "更新中..." : "检查更新"}
                    </button>
                    <span className="text-xs text-zinc-600">|</span>
                    <a
                      href="https://github.com/NousResearch/hermes-agent"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      <Globe className="w-3 h-3" />
                      GitHub
                    </a>
                  </div>
                </div>
              )}

              {!hermesInfo.can_update && hermesInfo.source === "SystemExisting" && (
                <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                  系统安装的 Hermes 请通过命令行手动更新
                </p>
              )}
            </div>
          </section>
        )}

        {/* About */}
        <section>
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            关于
          </h2>
          <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm text-zinc-300">
              <strong>OpenOtter</strong> v0.1.0
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Hermes Agent 桌面管理平台，让 AI Agent 触手可及。
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Hermes Agent 基于 MIT 协议开源。使用 Tauri v2 构建。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <Icon className="w-4 h-4 text-zinc-500" />
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-zinc-400">{value}</span>
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-zinc-600" />
        )}
      </div>
    </div>
  );
}
