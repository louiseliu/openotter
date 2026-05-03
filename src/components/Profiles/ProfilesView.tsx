import { useEffect, useState, useCallback } from "react";
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  FileText,
  Save,
  Cpu,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import * as api from "../../lib/hermes-api";
import type { ProfileInfo } from "../../lib/hermes-api";

export default function ProfilesView() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [cloneDefault, setCloneDefault] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actioningProfile, setActioningProfile] = useState<string | null>(null);
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [soulContent, setSoulContent] = useState<string | null>(null);
  const [soulLoading, setSoulLoading] = useState(false);
  const [soulEditing, setSoulEditing] = useState(false);
  const [soulDraft, setSoulDraft] = useState("");
  const [soulSaving, setSoulSaving] = useState(false);

  const [setupCommand, setSetupCommand] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await api.initWebServer();
      const { profiles: list } = await api.getProfiles();
      setProfiles(list);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createProfile({
        name: newName.trim(),
        clone_from_default: cloneDefault,
      });
      setShowCreate(false);
      setNewName("");
      await load();
    } catch (err) {
      console.error("Create profile failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    setActioningProfile(name);
    try {
      await api.deleteProfile(name);
      if (expandedProfile === name) setExpandedProfile(null);
      await load();
    } catch (err) {
      console.error("Delete profile failed:", err);
    } finally {
      setActioningProfile(null);
    }
  };

  const handleRename = async (name: string) => {
    if (!renameValue.trim() || renameValue === name) {
      setRenamingProfile(null);
      return;
    }
    setActioningProfile(name);
    try {
      await api.renameProfile(name, renameValue.trim());
      setRenamingProfile(null);
      await load();
    } catch (err) {
      console.error("Rename profile failed:", err);
    } finally {
      setActioningProfile(null);
    }
  };

  const handleExpand = async (name: string) => {
    if (expandedProfile === name) {
      setExpandedProfile(null);
      setSoulContent(null);
      setSetupCommand(null);
      setSoulEditing(false);
      return;
    }
    setExpandedProfile(name);
    setSoulContent(null);
    setSetupCommand(null);
    setSoulEditing(false);
    setSoulLoading(true);
    try {
      const [soul, cmd] = await Promise.all([
        api.getProfileSoul(name),
        api.getProfileSetupCommand(name),
      ]);
      setSoulContent(soul.exists ? soul.content : "");
      setSetupCommand(cmd.command);
    } catch (err) {
      console.error("Failed to load profile details:", err);
    } finally {
      setSoulLoading(false);
    }
  };

  const handleSoulSave = async (name: string) => {
    setSoulSaving(true);
    try {
      await api.updateProfileSoul(name, soulDraft);
      setSoulContent(soulDraft);
      setSoulEditing(false);
    } catch (err) {
      console.error("Failed to save soul:", err);
    } finally {
      setSoulSaving(false);
    }
  };

  const handleCopyCmd = () => {
    if (!setupCommand) return;
    navigator.clipboard.writeText(setupCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">配置档案</h1>
            <p className="text-base text-zinc-500 mt-1">
              管理 Hermes 多配置档案，切换不同使用场景
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建档案
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 bg-surface-1 border border-zinc-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-200">
                新建配置档案
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-zinc-500 hover:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  档案名称
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: work, personal..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cloneDefault}
                  onChange={(e) => setCloneDefault(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                从默认档案克隆配置
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-1.5 bg-hermes-600 text-white text-sm rounded-lg hover:bg-hermes-500 disabled:opacity-40 transition-colors"
                >
                  {creating ? "创建中…" : "创建"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
            <UserCog className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-1">暂无配置档案</p>
            <p className="text-xs text-zinc-600">
              点击「新建档案」创建配置
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => {
              const isExpanded = expandedProfile === p.name;
              return (
                <div
                  key={p.name}
                  className="bg-surface-1 border border-zinc-800 rounded-xl overflow-hidden"
                >
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors text-left"
                    onClick={() => handleExpand(p.name)}
                  >
                    <UserCog className="w-5 h-5 text-hermes-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {renamingProfile === p.name ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(p.name);
                              if (e.key === "Escape") setRenamingProfile(null);
                            }}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRename(p.name)}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRenamingProfile(null)}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {p.name}
                          </span>
                          {p.is_default && (
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                        {p.model && (
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {p.model}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {p.skill_count} 技能
                        </span>
                        {p.has_env && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            独立 .env
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!p.is_default && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingProfile(p.name);
                              setRenameValue(p.name);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="重命名"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p.name);
                            }}
                            disabled={actioningProfile === p.name}
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            {actioningProfile === p.name ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                      {soulLoading ? (
                        <div className="flex items-center gap-2 text-zinc-500 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          加载中...
                        </div>
                      ) : (
                        <>
                          {/* Setup command */}
                          {setupCommand && (
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase mb-1">
                                切换命令
                              </p>
                              <div className="flex items-center gap-2 bg-surface-0 rounded-lg px-3 py-2">
                                <code className="text-xs text-zinc-400 flex-1 font-mono truncate">
                                  {setupCommand}
                                </code>
                                <button
                                  onClick={handleCopyCmd}
                                  className="p-1 text-zinc-500 hover:text-zinc-300"
                                >
                                  {copiedCmd ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Soul editor */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Soul.md
                              </p>
                              {!soulEditing && (
                                <button
                                  onClick={() => {
                                    setSoulEditing(true);
                                    setSoulDraft(soulContent || "");
                                  }}
                                  className="text-[10px] text-hermes-400 hover:text-hermes-300"
                                >
                                  编辑
                                </button>
                              )}
                            </div>
                            {soulEditing ? (
                              <div>
                                <textarea
                                  value={soulDraft}
                                  onChange={(e) =>
                                    setSoulDraft(e.target.value)
                                  }
                                  rows={10}
                                  className="w-full bg-surface-0 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-hermes-500/50 resize-none"
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    onClick={() => setSoulEditing(false)}
                                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-300"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleSoulSave(p.name)
                                    }
                                    disabled={soulSaving}
                                    className="px-3 py-1 bg-hermes-600 hover:bg-hermes-500 text-white text-xs rounded-lg disabled:opacity-40 flex items-center gap-1"
                                  >
                                    {soulSaving ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                    保存
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-surface-0 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                                {soulContent || "（空）"}
                              </pre>
                            )}
                          </div>

                          {/* Path */}
                          <p className="text-[10px] text-zinc-600 truncate">
                            路径: {p.path}
                          </p>
                        </>
                      )}
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
