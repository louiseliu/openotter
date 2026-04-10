import { useState, useEffect, useCallback } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Save,
} from "lucide-react";
import {
  getCredentialPool,
  setCredentialPool,
  type CredentialEntry,
} from "../../lib/hermes-bridge";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "zai", label: "智谱 (GLM)" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "dashscope", label: "通义千问" },
  { id: "kimi", label: "Kimi" },
  { id: "minimax-cn", label: "MiniMax" },
  { id: "groq", label: "Groq" },
];

export default function CredentialsView() {
  const [pool, setPool] = useState<Record<string, CredentialEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState("openrouter");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getCredentialPool();
      setPool(data);
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function addEntry() {
    const entries = pool[activeProvider] || [];
    const newEntries = [
      ...entries,
      { key: "", label: `Key ${entries.length + 1}` },
    ];
    setPool({ ...pool, [activeProvider]: newEntries });
    setDirty(true);
  }

  function removeEntry(index: number) {
    const entries = pool[activeProvider] || [];
    const newEntries = entries.filter((_, i) => i !== index);
    setPool({ ...pool, [activeProvider]: newEntries });
    setDirty(true);
  }

  function updateEntry(
    index: number,
    field: "key" | "label",
    value: string
  ) {
    const entries = [...(pool[activeProvider] || [])];
    entries[index] = { ...entries[index], [field]: value };
    setPool({ ...pool, [activeProvider]: entries });
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setCredentialPool(activeProvider, pool[activeProvider] || []);
      setDirty(false);
    } catch (err) {
      console.error("Failed to save credentials:", err);
    } finally {
      setSaving(false);
    }
  }

  function toggleShowKey(id: string) {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••" + key.slice(-4);
  }

  const entries = pool[activeProvider] || [];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-zinc-500">加载凭证...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-hermes-400" />
          凭证管理
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          管理多个 API Key，支持同一 Provider 下多 Key 轮换
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r border-zinc-800 py-3 overflow-y-auto shrink-0">
          {PROVIDERS.map((p) => {
            const count = (pool[p.id] || []).length;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProvider(p.id)}
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                  activeProvider === p.id
                    ? "bg-hermes-600/15 text-hermes-400 border-r-2 border-hermes-500"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-2"
                }`}
              >
                <span>{p.label}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded-full text-zinc-500">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">
                {PROVIDERS.find((p) => p.id === activeProvider)?.label} 的 API Keys
              </span>
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-hermes-600 hover:bg-hermes-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "保存中..." : "保存"}
                </button>
              )}
              <button
                onClick={addEntry}
                className="flex items-center gap-1 px-3 py-1.5 bg-surface-2 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加 Key
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12">
              <KeyRound className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                暂无 API Key，点击"添加 Key"开始
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, i) => {
                const showId = `${activeProvider}-${i}`;
                const visible = showKeys[showId];
                return (
                  <div
                    key={i}
                    className="p-4 bg-surface-1 border border-zinc-800/50 rounded-xl space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={entry.label}
                        onChange={(e) =>
                          updateEntry(i, "label", e.target.value)
                        }
                        placeholder="标签（如：个人、公司）"
                        className="flex-1 px-3 py-1.5 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                      />
                      <button
                        onClick={() => removeEntry(i)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={visible ? "text" : "password"}
                        value={visible ? entry.key : entry.key ? maskKey(entry.key) : ""}
                        onChange={(e) =>
                          updateEntry(i, "key", e.target.value)
                        }
                        onFocus={() => {
                          if (!visible) setShowKeys((prev) => ({ ...prev, [showId]: true }));
                        }}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-1.5 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 font-mono focus:outline-none focus:border-hermes-500/50"
                      />
                      <button
                        onClick={() => toggleShowKey(showId)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {visible ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
