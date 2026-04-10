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
} from "lucide-react";
import {
  listSavedModels,
  addSavedModel,
  removeSavedModel,
  saveApiConfig,
  type SavedModel,
} from "../../lib/hermes-bridge";

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
  custom: { label: "自定义", color: "text-zinc-400", icon: Server },
};

export default function ModelsView() {
  const [models, setModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState("openrouter");
  const [newModel, setNewModel] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listSavedModels();
      setModels(list);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd() {
    if (!newName.trim() || !newModel.trim()) return;
    await addSavedModel(newName, newProvider, newModel, newBaseUrl);
    setShowAdd(false);
    setNewName("");
    setNewModel("");
    setNewBaseUrl("");
    refresh();
  }

  async function handleRemove(id: string) {
    await removeSavedModel(id);
    refresh();
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-zinc-500">加载模型列表...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-hermes-400" />
            模型管理
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            管理和快速切换 AI 模型配置
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                      onClick={() => handleSwitch(m)}
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
                      onClick={() => handleRemove(m.id)}
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

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-1 border border-zinc-700/50 rounded-2xl p-6 w-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-100">
                添加模型
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  显示名称
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: Claude Sonnet 4"
                  className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  Provider
                </label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
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
                <label className="text-xs text-zinc-400 mb-1 block">
                  模型 ID
                </label>
                <input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
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
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="留空使用默认"
                  className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newModel.trim()}
                className="px-4 py-2 text-sm bg-hermes-600 hover:bg-hermes-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
