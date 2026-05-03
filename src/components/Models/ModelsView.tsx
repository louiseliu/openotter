import { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Plus,
  Trash2,
  Check,
  X,
  Zap,
  Globe,
  Server,
  BarChart3,
  Eye,
  Brain,
  Wrench,
  MessageSquare,
  DollarSign,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  listSavedModels,
  addSavedModel,
  removeSavedModel,
  saveApiConfig,
  type SavedModel,
} from "../../lib/hermes-bridge";
import * as api from "../../lib/hermes-api";
import type { ModelsAnalyticsResponse, ModelsAnalyticsModelEntry } from "../../lib/hermes-api";

const PROVIDER_META: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  zai: { label: "智谱", color: "text-blue-400", icon: Zap },
  deepseek: { label: "DeepSeek", color: "text-cyan-400", icon: Zap },
  dashscope: { label: "通义千问", color: "text-purple-400", icon: Zap },
  kimi: { label: "Kimi", color: "text-amber-400", icon: Zap },
  "minimax-cn": { label: "MiniMax", color: "text-pink-400", icon: Zap },
  openrouter: { label: "OpenRouter", color: "text-emerald-400", icon: Globe },
  anthropic: { label: "Anthropic", color: "text-orange-400", icon: Server },
  openai: { label: "OpenAI", color: "text-green-400", icon: Server },
  groq: { label: "Groq", color: "text-yellow-400", icon: Zap },
  "lm-studio": { label: "LM Studio", color: "text-indigo-400", icon: Server },
  "gmi-cloud": { label: "GMI Cloud", color: "text-teal-400", icon: Globe },
  "azure-ai": { label: "Azure AI", color: "text-sky-400", icon: Globe },
  "tencent-tokenhub": { label: "腾讯 Tokenhub", color: "text-blue-400", icon: Globe },
  custom: { label: "自定义", color: "text-zinc-400", icon: Server },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

type Tab = "analytics" | "saved";

export default function ModelsView() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [models, setModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState("openrouter");
  const [newModel, setNewModel] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);

  const [analyticsData, setAnalyticsData] = useState<ModelsAnalyticsResponse | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const refreshSaved = useCallback(async () => {
    try {
      const list = await listSavedModels();
      setModels(list);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (days: number) => {
    setAnalyticsLoading(true);
    try {
      await api.initWebServer();
      const data = await api.getModelsAnalytics(days);
      setAnalyticsData(data);
    } catch (err) {
      console.error("Failed to load models analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSaved();
    loadAnalytics(analyticsDays);
  }, [refreshSaved, loadAnalytics, analyticsDays]);

  async function handleAdd() {
    if (!newName.trim() || !newModel.trim()) return;
    await addSavedModel(newName, newProvider, newModel, newBaseUrl);
    setShowAdd(false);
    setNewName("");
    setNewModel("");
    setNewBaseUrl("");
    refreshSaved();
  }

  async function handleRemove(id: string) {
    await removeSavedModel(id);
    refreshSaved();
  }

  async function handleSwitch(m: SavedModel) {
    setSwitching(m.id);
    try {
      await saveApiConfig(m.provider, "", m.model);
    } catch (err) {
      console.error("Failed to switch model:", err);
    } finally {
      setSwitching(null);
    }
  }

  const grouped = models.reduce<Record<string, SavedModel[]>>((acc, m) => {
    const key = m.provider;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-hermes-400" />
              模型管理
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              查看使用分析 · 管理和切换模型配置
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加模型
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setTab("analytics")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === "analytics"
                ? "bg-hermes-600/20 text-hermes-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              使用分析
            </span>
          </button>
          <button
            onClick={() => setTab("saved")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === "saved"
                ? "bg-hermes-600/20 text-hermes-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              已保存 ({models.length})
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "analytics" ? (
          <ModelsAnalyticsTab
            data={analyticsData}
            loading={analyticsLoading}
            days={analyticsDays}
            onDaysChange={setAnalyticsDays}
          />
        ) : (
          <SavedModelsTab
            grouped={grouped}
            loading={loading}
            switching={switching}
            onSwitch={handleSwitch}
            onRemove={handleRemove}
          />
        )}
      </div>

      {showAdd && (
        <AddModelDialog
          newName={newName}
          newProvider={newProvider}
          newModel={newModel}
          newBaseUrl={newBaseUrl}
          onNameChange={setNewName}
          onProviderChange={setNewProvider}
          onModelChange={setNewModel}
          onBaseUrlChange={setNewBaseUrl}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function ModelsAnalyticsTab({
  data,
  loading,
  days,
  onDaysChange,
}: {
  data: ModelsAnalyticsResponse | null;
  loading: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data || data.models.length === 0) {
    return (
      <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
        <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400 mb-1">暂无模型使用数据</p>
        <p className="text-xs text-zinc-600">
          开始使用后将在此显示各模型的详细分析
        </p>
      </div>
    );
  }

  const sorted = [...data.models].sort(
    (a, b) => b.sessions - a.sessions
  );

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 mr-4">
          <MiniStat
            icon={<Cpu className="w-4 h-4 text-purple-400" />}
            label="模型数"
            value={String(data.totals.distinct_models)}
          />
          <MiniStat
            icon={<MessageSquare className="w-4 h-4 text-blue-400" />}
            label="总会话"
            value={String(data.totals.total_sessions)}
          />
          <MiniStat
            icon={<BarChart3 className="w-4 h-4 text-hermes-400" />}
            label="API 调用"
            value={String(data.totals.total_api_calls)}
          />
          <MiniStat
            icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
            label="总费用"
            value={`$${data.totals.total_estimated_cost.toFixed(2)}`}
          />
        </div>
        <select
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          className="px-3 py-1.5 bg-surface-1 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-hermes-500/50 shrink-0"
        >
          <option value={7}>近 7 天</option>
          <option value={14}>近 14 天</option>
          <option value={30}>近 30 天</option>
          <option value={90}>近 90 天</option>
        </select>
      </div>

      {/* Model cards */}
      <div className="space-y-2">
        {sorted.map((m) => {
          const providerMeta = PROVIDER_META[m.provider] ?? PROVIDER_META.custom;
          const isExpanded = expandedModel === m.model;
          return (
            <div
              key={m.model}
              className="bg-surface-1 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors text-left"
                onClick={() =>
                  setExpandedModel(isExpanded ? null : m.model)
                }
              >
                <div className={`shrink-0 ${providerMeta.color}`}>
                  <providerMeta.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {m.model.split("/").pop()}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                      {providerMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                    <span>{m.sessions} 会话</span>
                    <span>{m.api_calls} 次调用</span>
                    <span>${m.estimated_cost.toFixed(2)}</span>
                    <span>最近: {timeAgo(m.last_used_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.capabilities.supports_tools && (
                    <span title="支持工具"><Wrench className="w-3 h-3 text-amber-400" /></span>
                  )}
                  {m.capabilities.supports_vision && (
                    <span title="支持视觉"><Eye className="w-3 h-3 text-blue-400" /></span>
                  )}
                  {m.capabilities.supports_reasoning && (
                    <span title="支持推理"><Brain className="w-3 h-3 text-purple-400" /></span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <ModelDetailPanel model={m} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelDetailPanel({ model: m }: { model: ModelsAnalyticsModelEntry }) {
  return (
    <div className="border-t border-zinc-800 bg-zinc-900/40 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">输入 Tokens</p>
          <p className="text-sm font-semibold text-zinc-200">
            {formatTokens(m.input_tokens)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">输出 Tokens</p>
          <p className="text-sm font-semibold text-zinc-200">
            {formatTokens(m.output_tokens)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">缓存读取</p>
          <p className="text-sm font-semibold text-zinc-200">
            {formatTokens(m.cache_read_tokens)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">推理 Tokens</p>
          <p className="text-sm font-semibold text-zinc-200">
            {formatTokens(m.reasoning_tokens)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">工具调用</p>
          <p className="text-sm font-semibold text-zinc-200">
            {m.tool_calls}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">平均 Tokens/会话</p>
          <p className="text-sm font-semibold text-zinc-200">
            {formatTokens(m.avg_tokens_per_session)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">预估费用</p>
          <p className="text-sm font-semibold text-emerald-400">
            ${m.estimated_cost.toFixed(3)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">实际费用</p>
          <p className="text-sm font-semibold text-emerald-400">
            ${m.actual_cost.toFixed(3)}
          </p>
        </div>
      </div>
      {m.capabilities.context_window && (
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
          <span>上下文窗口: {(m.capabilities.context_window / 1000).toFixed(0)}K</span>
          {m.capabilities.max_output_tokens && (
            <span>最大输出: {(m.capabilities.max_output_tokens / 1000).toFixed(0)}K</span>
          )}
          {m.capabilities.model_family && (
            <span>系列: {m.capabilities.model_family}</span>
          )}
        </div>
      )}
    </div>
  );
}

function SavedModelsTab({
  grouped,
  loading,
  switching,
  onSwitch,
  onRemove,
}: {
  grouped: Record<string, SavedModel[]>;
  loading: boolean;
  switching: string | null;
  onSwitch: (m: SavedModel) => void;
  onRemove: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
        <Server className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400 mb-1">暂无保存的模型</p>
        <p className="text-xs text-zinc-600">点击「添加模型」保存常用配置</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([provider, providerModels]) => {
        const meta = PROVIDER_META[provider] || PROVIDER_META.custom;
        const Icon = meta.icon;
        return (
          <div key={provider}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${meta.color}`} />
              <h2 className={`text-sm font-medium ${meta.color}`}>
                {meta.label}
              </h2>
              <span className="text-xs text-zinc-600">
                {providerModels.length} 个模型
              </span>
            </div>
            <div className="grid gap-2">
              {providerModels.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3 bg-surface-1 border border-zinc-800/50 rounded-xl hover:border-zinc-700/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200">
                      {m.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate mt-0.5">
                      {m.model}
                    </div>
                  </div>
                  <button
                    onClick={() => onSwitch(m)}
                    disabled={switching === m.id}
                    className="px-3 py-1.5 text-xs bg-hermes-600/20 text-hermes-400 hover:bg-hermes-600/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {switching === m.id ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" /> 切换中...
                      </span>
                    ) : (
                      "使用"
                    )}
                  </button>
                  <button
                    onClick={() => onRemove(m.id)}
                    className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
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
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-3 flex items-center gap-2.5">
      {icon}
      <div>
        <p className="text-[10px] text-zinc-500">{label}</p>
        <p className="text-base font-bold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function AddModelDialog({
  newName,
  newProvider,
  newModel,
  newBaseUrl,
  onNameChange,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onAdd,
  onClose,
}: {
  newName: string;
  newProvider: string;
  newModel: string;
  newBaseUrl: string;
  onNameChange: (v: string) => void;
  onProviderChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onBaseUrlChange: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-1 border border-zinc-700/50 rounded-2xl p-6 w-[420px] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-100">添加模型</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">显示名称</label>
            <input
              value={newName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="例如: Claude Sonnet 4"
              className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Provider</label>
            <select
              value={newProvider}
              onChange={(e) => onProviderChange(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
            >
              {Object.entries(PROVIDER_META).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">模型 ID</label>
            <input
              value={newModel}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="例如: anthropic/claude-sonnet-4-20250514"
              className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Base URL（可选）
            </label>
            <input
              value={newBaseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="留空使用默认"
              className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onAdd}
            disabled={!newName.trim() || !newModel.trim()}
            className="px-4 py-2 text-sm bg-hermes-600 hover:bg-hermes-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
