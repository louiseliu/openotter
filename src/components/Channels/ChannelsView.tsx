import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  QrCode,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  getPlatformTemplates,
  listChannelBots,
  listAgents,
  addChannelBot,
  updateChannelBot,
  removeChannelBot,
  startQrSession,
  stopQrSession,
  detectQrCredentials,
  checkQrPlatformSupport,
  onQrSessionOutput,
  onQrSessionUpdate,
  onQrSessionEnded,
  type QrSessionUpdate,
  type PlatformTemplate,
  type ChannelBot,
  type AgentMeta,
} from "../../lib/hermes-bridge";

const QR_PLATFORMS: Set<string> = new Set(["whatsapp", "weixin"]);

const PLATFORM_ICONS: Record<string, string> = {
  feishu: "/icons/channels/feishu.png",
  dingtalk: "/icons/channels/dingding.png",
  wecom: "/icons/channels/wecom.png",
  weixin: "/icons/channels/weixin.png",
  qq_bot: "/icons/channels/qq_bot.jpeg",
  popo: "/icons/channels/popo.png",
  nim: "/icons/channels/nim.png",
  netease_bee: "/icons/channels/netease-bee.png",
  discord: "/icons/channels/discord.png",
  telegram: "/icons/channels/telegram.png",
  slack: "/icons/channels/slack.png",
  whatsapp: "/icons/channels/whatsapp.png",
  signal: "/icons/channels/signal.png",
  email: "/icons/channels/email.png",
  matrix: "/icons/channels/matrix.png",
  mattermost: "/icons/channels/mattermost.png",
  homeassistant: "/icons/channels/homeassistant.png",
  bluebubbles: "/icons/channels/bluebubbles.png",
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
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [editingBot, setEditingBot] = useState<{
    mode: "add" | "edit";
    platform: PlatformTemplate;
    botId?: string;
    agentId: string;
  } | null>(null);

  const [formName, setFormName] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadData = async () => {
    const [p, b, a] = await Promise.all([getPlatformTemplates(), listChannelBots(), listAgents()]);
    setPlatforms(p);
    setBots(b);
    setAgents(a);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePickPlatform = (platform: PlatformTemplate) => {
    setShowPicker(false);
    setEditingBot({ mode: "add", platform, agentId: "default" });
    setFormName("");
    setFormData({ GATEWAY_ALLOW_ALL_USERS: "true" });
    setShowSecrets(false);
    setSaveMsg(null);
  };

  const handleEditBot = (bot: ChannelBot) => {
    const platform = platforms.find((p) => p.id === bot.platform_id);
    if (!platform) return;
    setEditingBot({ mode: "edit", platform, botId: bot.id, agentId: bot.agent_id || "default" });
    setFormName(bot.name);
    setFormData({ ...bot.config });
    setShowSecrets(false);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!editingBot) return;
    const { platform, mode, botId, agentId } = editingBot;

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
        await addChannelBot(formName.trim(), platform.id, formData, agentId);
      } else if (botId) {
        await updateChannelBot(botId, formName.trim(), formData, agentId);
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
                              {agents.find((a) => a.id === bot.agent_id)
                                ? `${agents.find((a) => a.id === bot.agent_id)!.avatar} ${agents.find((a) => a.id === bot.agent_id)!.name}`
                                : "默认 Agent"}
                              {" · "}
                              {Object.keys(bot.config).filter((k) => k !== "GATEWAY_ALLOW_ALL_USERS").length} 项配置
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
          <BotEditModal
            editingBot={editingBot}
            setEditingBot={setEditingBot}
            agents={agents}
            formName={formName}
            setFormName={setFormName}
            formData={formData}
            setFormData={setFormData}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
            saving={saving}
            saveMsg={saveMsg}
            onSave={handleSave}
            onClose={() => setEditingBot(null)}
          />
        )}
      </div>
    </div>
  );
}

function BotEditModal({
  editingBot,
  setEditingBot,
  agents,
  formName,
  setFormName,
  formData,
  setFormData,
  showSecrets,
  setShowSecrets,
  saving,
  saveMsg,
  onSave,
  onClose,
}: {
  editingBot: {
    mode: "add" | "edit";
    platform: PlatformTemplate;
    botId?: string;
    agentId: string;
  };
  setEditingBot: React.Dispatch<React.SetStateAction<{
    mode: "add" | "edit";
    platform: PlatformTemplate;
    botId?: string;
    agentId: string;
  } | null>>;
  agents: AgentMeta[];
  formName: string;
  setFormName: (v: string) => void;
  formData: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showSecrets: boolean;
  setShowSecrets: (v: boolean) => void;
  saving: boolean;
  saveMsg: { ok: boolean; text: string } | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const isQr =
    QR_PLATFORMS.has(editingBot.platform.id) && editingBot.mode === "add";
  const [useQrMode, setUseQrMode] = useState(isQr);
  const [qrSupported, setQrSupported] = useState<boolean | null>(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionOutput, setSessionOutput] = useState<string[]>([]);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [pairMsg, setPairMsg] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isQr) {
      checkQrPlatformSupport(editingBot.platform.id)
        .then(setQrSupported)
        .catch(() => setQrSupported(false));
    }
  }, [isQr, editingBot.platform.id]);

  useEffect(() => {
    if (!sessionActive) return;

    let unOutput: (() => void) | null = null;
    let unUpdate: (() => void) | null = null;
    let unEnded: (() => void) | null = null;

    onQrSessionOutput((data) => {
      setSessionOutput((prev) => [...prev, data]);
    }).then((fn) => {
      unOutput = fn;
    });

    onQrSessionUpdate((update: QrSessionUpdate) => {
      if (update.stage === "qr_ready" && update.qr_url) {
        setQrImageUrl(update.qr_url);
      } else if (update.stage === "paired" && update.credentials) {
        setPaired(true);
        setPairMsg(update.message);
        setFormData((prev) => ({ ...prev, ...update.credentials! }));
        setSessionActive(false);
      } else if (update.stage === "failed") {
        setPairMsg(update.message);
        setSessionActive(false);
      }
    }).then((fn) => {
      unUpdate = fn;
    });

    onQrSessionEnded(() => {
      setSessionActive(false);
    }).then((fn) => {
      unEnded = fn;
    });

    if (editingBot.platform.id === "whatsapp") {
      pollRef.current = setInterval(async () => {
        try {
          const result = await detectQrCredentials(editingBot.platform.id);
          if (result.found) {
            setPaired(true);
            setPairMsg(result.message);
            setFormData((prev) => ({ ...prev, ...result.credentials }));
            if (pollRef.current) clearInterval(pollRef.current);
            await stopQrSession();
            setSessionActive(false);
          }
        } catch {
          /* ignore */
        }
      }, 3000);
    }

    return () => {
      unOutput?.();
      unUpdate?.();
      unEnded?.();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionActive, editingBot.platform.id]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [sessionOutput]);

  const handleStartSession = async () => {
    setSessionOutput([]);
    setQrImageUrl(null);
    setPaired(false);
    setPairMsg("");
    try {
      await startQrSession(editingBot.platform.id);
      setSessionActive(true);
    } catch (err) {
      setSessionOutput([`启动失败: ${err}`]);
    }
  };

  const handleStopSession = async () => {
    await stopQrSession();
    setSessionActive(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleClose = () => {
    if (sessionActive) {
      stopQrSession().catch(() => {});
    }
    if (pollRef.current) clearInterval(pollRef.current);
    onClose();
  };

  const isWeixin = editingBot.platform.id === "weixin";
  const weixinUnsupported = isWeixin && qrSupported === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-0 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center">
              <PlatformIcon platformId={editingBot.platform.id} size={18} />
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {editingBot.mode === "add" ? "添加" : "编辑"}{" "}
              {editingBot.platform.name} Bot
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isQr && (
              <button
                onClick={() => {
                  if (sessionActive) handleStopSession();
                  setUseQrMode(!useQrMode);
                  setSessionOutput([]);
                  setPaired(false);
                }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-surface-2"
              >
                {useQrMode ? "手动填写" : "扫码连接"}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-surface-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {useQrMode ? (
            <>
              {weixinUnsupported && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      微信适配器可能需要更新 Hermes 到最新版。
                    </p>
                  </div>
                </div>
              )}

              {!sessionActive && !paired && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-hermes-400" />
                  </div>
                  <p className="text-sm text-zinc-300 mb-1">
                    扫码连接{" "}
                    {editingBot.platform.name}
                  </p>
                  <p className="text-xs text-zinc-500 mb-5">
                    {editingBot.platform.id === "whatsapp"
                      ? "点击下方按钮，将在此窗口内显示 QR 码，用 WhatsApp 扫描即可"
                      : "点击下方按钮，将在此窗口内显示 QR 码，用微信扫描即可"}
                  </p>
                  <button
                    onClick={handleStartSession}
                    className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    获取二维码
                  </button>
                </div>
              )}

              {sessionActive && !paired && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-zinc-400">
                        {qrImageUrl ? "请扫描二维码" : "正在获取二维码..."}
                      </span>
                    </div>
                    <button
                      onClick={handleStopSession}
                      className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      取消
                    </button>
                  </div>

                  {qrImageUrl ? (
                    <div className="flex flex-col items-center py-2">
                      <div className="bg-white p-4 rounded-2xl">
                        <QRCodeSVG
                          value={qrImageUrl}
                          size={224}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <p className="text-xs text-zinc-400 mt-3">
                        {editingBot.platform.id === "whatsapp"
                          ? "打开 WhatsApp → 设置 → 已关联的设备 → 关联设备 → 扫码"
                          : "打开微信 → 扫一扫 → 扫描上方二维码"}
                      </p>
                    </div>
                  ) : sessionOutput.length > 0 ? (
                    <pre
                      ref={outputRef}
                      className="bg-black rounded-xl p-4 text-[11px] text-green-400 overflow-auto max-h-[320px] whitespace-pre select-all"
                      style={{
                        fontFamily:
                          "'SF Mono', 'Monaco', 'Cascadia Code', 'Menlo', monospace",
                        lineHeight: "1.1",
                        letterSpacing: "0px",
                      }}
                    >
                      {sessionOutput.join("")}
                    </pre>
                  ) : (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-8 h-8 text-hermes-400 animate-spin" />
                    </div>
                  )}
                </div>
              )}

              {paired && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-sm text-emerald-300 font-medium mb-1">
                    {pairMsg || "配对成功！"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    凭证已自动填入，输入 Bot 名称后保存即可
                  </p>
                </div>
              )}

              {paired && (
                <>
                  <div>
                    <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                      Bot 名称 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={`例如：我的 ${editingBot.platform.name} Bot`}
                      className="w-full bg-surface-1 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                      绑定 Agent <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={editingBot.agentId}
                      onChange={(e) =>
                        setEditingBot((prev) =>
                          prev ? { ...prev, agentId: e.target.value } : prev
                        )
                      }
                      className="w-full bg-surface-1 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.avatar} {a.name} ({a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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
            </>
          ) : (
            <>
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

              <div>
                <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                  绑定 Agent <span className="text-red-400">*</span>
                </label>
                <select
                  value={editingBot.agentId}
                  onChange={(e) =>
                    setEditingBot((prev) =>
                      prev ? { ...prev, agentId: e.target.value } : prev
                    )
                  }
                  className="w-full bg-surface-1 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatar} {a.name} ({a.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-600 mt-1">
                  渠道消息将由选定的 Agent 处理
                </p>
              </div>

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

              {editingBot.platform.fields.map((field) => (
                <div key={field.key}>
                  <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                    {field.label}
                    {field.required && (
                      <span className="text-red-400">*</span>
                    )}
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
                    <p className="text-[11px] text-zinc-600 mt-1">
                      {field.help}
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-2 border-t border-zinc-800">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-sm text-zinc-200">允许所有用户</span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      开启后任何人都可以直接与 Bot 对话，无需配对码审批
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData["GATEWAY_ALLOW_ALL_USERS"] === "true"}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          GATEWAY_ALLOW_ALL_USERS: e.target.checked ? "true" : "false",
                        }))
                      }
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-checked:bg-hermes-500 rounded-full transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                </label>
              </div>

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
            </>
          )}
        </div>

        <div className="p-5 border-t border-zinc-800 flex justify-end gap-2 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 transition-colors"
          >
            {paired ? "完成" : "取消"}
          </button>
          {(!useQrMode || paired) && (
            <button
              onClick={onSave}
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
          )}
        </div>
      </div>
    </div>
  );
}
