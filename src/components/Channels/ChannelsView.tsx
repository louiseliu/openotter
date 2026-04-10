import { useState, useEffect } from "react";
import {
  Plus,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  Loader2,
  CheckCircle2,
  Save,
  Trash2,
  Pencil,
  Radio,
} from "lucide-react";
import {
  getPlatformTemplates,
  listChannelBots,
  addChannelBot,
  updateChannelBot,
  removeChannelBot,
  type PlatformTemplate,
  type ChannelBot,
} from "../../lib/hermes-bridge";

const PLATFORM_ICONS: Record<string, string> = {
  feishu: "/icons/channels/feishu.png",
  dingtalk: "/icons/channels/dingding.png",
  wecom: "/icons/channels/wecom.png",
  weixin: "/icons/channels/weixin.png",
  qq_bot: "/icons/channels/qq_bot.jpeg",
  popo: "/icons/channels/popo.png",
  nim: "/icons/channels/nim.png",
  netease_bee: "/icons/channels/netease-bee.png",
};

function PlatformIcon({ platformId, size = 20 }: { platformId: string; size?: number }) {
  const iconPath = PLATFORM_ICONS[platformId];
  if (iconPath) {
    return <img src={iconPath} alt={platformId} width={size} height={size} className="object-contain rounded" />;
  }
  return <span style={{ fontSize: size * 0.8 }}>📡</span>;
}

export default function ChannelsView() {
  const [platforms, setPlatforms] = useState<PlatformTemplate[]>([]);
  const [bots, setBots] = useState<ChannelBot[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [editingBot, setEditingBot] = useState<{
    mode: "add" | "edit";
    platform: PlatformTemplate;
    botId?: string;
  } | null>(null);

  const [formName, setFormName] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadData = async () => {
    const [p, b] = await Promise.all([getPlatformTemplates(), listChannelBots()]);
    setPlatforms(p);
    setBots(b);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePickPlatform = (platform: PlatformTemplate) => {
    setShowPicker(false);
    setEditingBot({ mode: "add", platform });
    setFormName("");
    setFormData({});
    setShowSecrets(false);
    setSaveMsg(null);
  };

  const handleEditBot = (bot: ChannelBot) => {
    const platform = platforms.find((p) => p.id === bot.platform_id);
    if (!platform) return;
    setEditingBot({ mode: "edit", platform, botId: bot.id });
    setFormName(bot.name);
    setFormData({ ...bot.config });
    setShowSecrets(false);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!editingBot) return;
    const { platform, mode, botId } = editingBot;

    if (!formName.trim()) {
      setSaveMsg({ ok: false, text: "请输入 Bot 名称" });
      return;
    }

    const missing = platform.fields
      .filter((f) => f.required && !formData[f.key]?.trim())
      .map((f) => f.label);
    if (missing.length > 0) {
      setSaveMsg({ ok: false, text: `请填写: ${missing.join(", ")}` });
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      if (mode === "add") {
        await addChannelBot(formName.trim(), platform.id, formData);
      } else if (botId) {
        await updateChannelBot(botId, formName.trim(), formData);
      }
      setSaveMsg({ ok: true, text: "保存成功！" });
      await loadData();
      setTimeout(() => setEditingBot(null), 500);
    } catch (err) {
      setSaveMsg({
        ok: false,
        text: `保存失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (botId: string) => {
    setRemoving(botId);
    try {
      await removeChannelBot(botId);
      await loadData();
    } catch (err) {
      console.error("Remove failed:", err);
    } finally {
      setRemoving(null);
    }
  };

  const groupedBots = platforms.reduce<Record<string, ChannelBot[]>>((acc, p) => {
    const platformBots = bots.filter((b) => b.platform_id === p.id);
    if (platformBots.length > 0) {
      acc[p.id] = platformBots;
    }
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">渠道</h1>
            <p className="text-base text-zinc-500 mt-1">
              管理 IM 平台的 Bot 实例，同一平台可以创建多个 Bot
            </p>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加 Bot
          </button>
        </div>

        {/* Bot List */}
        {Object.keys(groupedBots).length > 0 ? (
          <div className="space-y-6">
            {platforms.map((platform) => {
              const platformBots = groupedBots[platform.id];
              if (!platformBots) return null;
              return (
                <section key={platform.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <PlatformIcon platformId={platform.id} size={18} />
                    <h2 className="text-sm font-medium text-zinc-400">
                      {platform.name}
                    </h2>
                    <span className="text-xs text-zinc-600">
                      {platformBots.length} 个 Bot
                    </span>
                  </div>
                  <div className="space-y-2">
                    {platformBots.map((bot) => {
                      const isRemoving = removing === bot.id;
                      return (
                        <div
                          key={bot.id}
                          className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                            <PlatformIcon platformId={bot.platform_id} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-zinc-200">
                              {bot.name}
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {Object.keys(bot.config).length} 项配置
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs text-emerald-400">就绪</span>
                            </div>
                            <button
                              onClick={() => handleEditBot(bot)}
                              className="p-1.5 text-zinc-500 hover:text-hermes-400 transition-colors rounded-lg hover:bg-hermes-500/10"
                              title="编辑"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemove(bot.id)}
                              disabled={isRemoving}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 disabled:opacity-40"
                              title="删除"
                            >
                              {isRemoving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : bots.length === 0 && platforms.length > 0 ? (
          <div className="text-center py-20">
            <Radio className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-sm text-zinc-400 mb-2">还没有配置任何 Bot</p>
            <p className="text-xs text-zinc-500">点击「添加 Bot」开始配置 IM 渠道</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <Radio className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-sm text-zinc-400">正在加载...</p>
          </div>
        )}

        {/* Platform Picker Modal */}
        {showPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-0 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-100">
                  选择 IM 平台
                </h2>
                <button
                  onClick={() => setShowPicker(false)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-surface-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {platforms.map((platform) => {
                  const count = bots.filter((b) => b.platform_id === platform.id).length;
                  return (
                    <button
                      key={platform.id}
                      onClick={() => handlePickPlatform(platform)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-1 flex items-center justify-center shrink-0">
                        <PlatformIcon platformId={platform.id} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-zinc-200">
                          {platform.name}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                          {platform.description}
                        </p>
                      </div>
                      {count > 0 && (
                        <span className="text-[10px] text-zinc-400 bg-surface-2 px-2 py-0.5 rounded-full">
                          {count} 个 Bot
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Bot Modal */}
        {editingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-0 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center">
                    <PlatformIcon platformId={editingBot.platform.id} size={18} />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {editingBot.mode === "add" ? "添加" : "编辑"} {editingBot.platform.name} Bot
                  </h2>
                </div>
                <button
                  onClick={() => setEditingBot(null)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-surface-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Bot Name */}
                <div>
                  <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                    Bot 名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如：客服机器人、内部助手"
                    className="w-full bg-surface-1 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
                  />
                </div>

                {/* Setup Guide */}
                <div className="bg-surface-1 rounded-lg p-3">
                  <p className="text-xs text-zinc-400 whitespace-pre-line leading-relaxed">
                    {editingBot.platform.setup_guide}
                  </p>
                  {editingBot.platform.setup_url && (
                    <a
                      href={editingBot.platform.setup_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-hermes-400 hover:text-hermes-300 mt-2"
                    >
                      前往开放平台 <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Config Fields */}
                {editingBot.platform.fields.map((field) => (
                  <div key={field.key}>
                    <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={field.secret && !showSecrets ? "password" : "text"}
                        value={formData[field.key] || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder={field.placeholder || field.help}
                        className="w-full bg-surface-1 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
                      />
                      {field.secret && (
                        <button
                          onClick={() => setShowSecrets(!showSecrets)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                          {showSecrets ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {field.help && (
                      <p className="text-[11px] text-zinc-600 mt-1">{field.help}</p>
                    )}
                  </div>
                ))}

                {/* Save Message */}
                {saveMsg && (
                  <div
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                      saveMsg.ok
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-red-400 bg-red-500/10"
                    }`}
                  >
                    {saveMsg.ok && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saveMsg.text}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-zinc-800 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setEditingBot(null)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
