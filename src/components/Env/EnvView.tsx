import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Save,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Unlock,
  AlertCircle,
  Check,
} from "lucide-react";
import * as api from "../../lib/hermes-api";
import type { EnvVarInfo } from "../../lib/hermes-api";

interface EnvEntry {
  key: string;
  info: EnvVarInfo;
}

export default function EnvView() {
  const [vars, setVars] = useState<Record<string, EnvVarInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {}
  );
  const [revealingKey, setRevealingKey] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await api.initWebServer();
      const data = await api.getEnvVars();
      setVars(data);
    } catch (err) {
      console.error("Failed to load env vars:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo<EnvEntry[]>(() => {
    let list = Object.entries(vars).map(([key, info]) => ({ key, info }));

    if (!showAdvanced) {
      list = list.filter((e) => !e.info.advanced);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          e.info.description.toLowerCase().includes(q) ||
          e.info.category.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      const catCmp = a.info.category.localeCompare(b.info.category);
      if (catCmp !== 0) return catCmp;
      return a.key.localeCompare(b.key);
    });
  }, [vars, search, showAdvanced]);

  const grouped = useMemo(() => {
    const map = new Map<string, EnvEntry[]>();
    for (const entry of entries) {
      const cat = entry.info.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(entry);
    }
    return map;
  }, [entries]);

  const totalSet = useMemo(
    () => Object.values(vars).filter((v) => v.is_set).length,
    [vars]
  );
  const totalCount = Object.keys(vars).length;

  const handleReveal = async (key: string) => {
    if (revealedValues[key]) {
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setRevealingKey(key);
    try {
      const { value } = await api.revealEnvVar(key);
      setRevealedValues((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error("Reveal failed:", err);
    } finally {
      setRevealingKey(null);
    }
  };

  const handleSave = async (key: string) => {
    if (!editValue) return;
    setSavingKey(key);
    try {
      await api.setEnvVar(key, editValue);
      setEditingKey(null);
      setEditValue("");
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      await api.deleteEnvVar(key);
      await load();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setAdding(true);
    try {
      await api.setEnvVar(newKey.trim(), newValue.trim());
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
      await load();
    } catch (err) {
      console.error("Add env var failed:", err);
    } finally {
      setAdding(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">环境变量</h1>
            <p className="text-base text-zinc-500 mt-1">
              管理 Hermes 的 .env 配置项 — 已设置{" "}
              <span className="text-hermes-400">{totalSet}</span> /{" "}
              {totalCount}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加变量
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索变量名或描述..."
              className="w-full pl-8 pr-8 py-2 bg-surface-1 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500/50 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="rounded border-zinc-600"
            />
            显示高级配置
          </label>
        </div>

        {/* Add new var form */}
        {showAdd && (
          <div className="mb-6 bg-surface-1 border border-zinc-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-200">
                添加环境变量
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-zinc-500 hover:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  变量名
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  placeholder="OPENAI_API_KEY"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 font-mono placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">值</label>
                <input
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 font-mono placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!newKey.trim() || !newValue.trim() || adding}
                className="px-4 py-1.5 bg-hermes-600 text-white text-sm rounded-lg hover:bg-hermes-500 disabled:opacity-40 transition-colors"
              >
                {adding ? "添加中…" : "添加"}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
            <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-1">
              {search ? "未找到匹配的变量" : "暂无环境变量"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([category, items]) => {
              const collapsed = collapsedCategories.has(category);
              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-400 mb-2"
                  >
                    {collapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {category}
                    <span className="text-zinc-600">({items.length})</span>
                  </button>

                  {!collapsed && (
                    <div className="space-y-1">
                      {items.map(({ key, info }) => (
                        <div
                          key={key}
                          className="bg-surface-1 border border-zinc-800 rounded-lg px-4 py-3 flex items-start gap-3 group"
                        >
                          <div className="mt-0.5 shrink-0">
                            {info.is_set ? (
                              <Unlock className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Lock className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-semibold text-zinc-200">
                                {key}
                              </span>
                              {info.is_password && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/10 text-amber-400 rounded">
                                  SECRET
                                </span>
                              )}
                              {info.url && (
                                <a
                                  href={info.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-zinc-600 hover:text-hermes-400"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {info.description}
                            </p>
                            {info.tools.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {info.tools.map((tool) => (
                                  <span
                                    key={tool}
                                    className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded"
                                  >
                                    {tool}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Value display / edit */}
                            {editingKey === key ? (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) =>
                                    setEditValue(e.target.value)
                                  }
                                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-hermes-500/50"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSave(key)}
                                  disabled={savingKey === key}
                                  className="p-1 text-emerald-400 hover:text-emerald-300"
                                >
                                  {savingKey === key ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingKey(null);
                                    setEditValue("");
                                  }}
                                  className="p-1 text-zinc-500 hover:text-zinc-300"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : info.is_set && revealedValues[key] ? (
                              <div className="mt-2 flex items-center gap-2">
                                <code className="text-xs text-zinc-400 font-mono bg-zinc-900/60 px-2 py-0.5 rounded max-w-lg truncate">
                                  {revealedValues[key]}
                                </code>
                              </div>
                            ) : info.is_set && info.redacted_value ? (
                              <div className="mt-2">
                                <code className="text-xs text-zinc-600 font-mono">
                                  {info.redacted_value}
                                </code>
                              </div>
                            ) : !info.is_set ? (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-600">
                                <AlertCircle className="w-3 h-3" />
                                未设置
                              </div>
                            ) : null}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {info.is_set && (
                              <button
                                onClick={() => handleReveal(key)}
                                disabled={revealingKey === key}
                                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                title={
                                  revealedValues[key]
                                    ? "隐藏"
                                    : "查看"
                                }
                              >
                                {revealingKey === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : revealedValues[key] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingKey(key);
                                setEditValue(revealedValues[key] || "");
                              }}
                              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="编辑"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            {info.is_set && (
                              <button
                                onClick={() => handleDelete(key)}
                                disabled={deletingKey === key}
                                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                title="删除"
                              >
                                {deletingKey === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
