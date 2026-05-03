import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Calendar,
  Play,
  Pause,
  AlertCircle,
  X,
  Zap,
  CheckCircle2,
} from "lucide-react";
import {
  listCronJobs,
  createCronJob,
  deleteCronJob,
  type CronJobInfo,
} from "../../lib/hermes-bridge";
import * as api from "../../lib/hermes-api";
import type { CronJob } from "../../lib/hermes-api";

type CronSource = "bridge" | "rest";

export default function CronView() {
  const [bridgeJobs, setBridgeJobs] = useState<CronJobInfo[]>([]);
  const [restJobs, setRestJobs] = useState<CronJob[]>([]);
  const [source, setSource] = useState<CronSource>("bridge");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSchedule, setNewSchedule] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newName, setNewName] = useState("");
  const [newDeliver, setNewDeliver] = useState("");
  const [creating, setCreating] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const webInfo = await api.initWebServer().catch(() => null);
      if (webInfo?.running) {
        const jobs = await api.getCronJobs();
        setRestJobs(jobs);
        setSource("rest");
      } else {
        const list = await listCronJobs();
        setBridgeJobs(list);
        setSource("bridge");
      }
    } catch (err) {
      console.error("Failed to load cron jobs:", err);
      try {
        const list = await listCronJobs();
        setBridgeJobs(list);
        setSource("bridge");
      } catch {
        /* fallthrough */
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newSchedule.trim() || !newPrompt.trim()) return;
    setCreating(true);
    try {
      if (source === "rest") {
        await api.createCronJob({
          schedule: newSchedule.trim(),
          prompt: newPrompt.trim(),
          name: newName.trim() || undefined,
          deliver: newDeliver.trim() || undefined,
        });
      } else {
        await createCronJob(
          newSchedule.trim(),
          newPrompt.trim(),
          newName.trim() || undefined
        );
      }
      setShowCreate(false);
      setNewSchedule("");
      setNewPrompt("");
      setNewName("");
      setNewDeliver("");
      await load();
    } catch (err) {
      console.error("Failed to create cron job:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActioningId(id);
    try {
      if (source === "rest") {
        await api.deleteCronJob(id);
      } else {
        await deleteCronJob(id);
      }
      await load();
    } catch (err) {
      console.error("Failed to delete cron job:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handlePause = async (id: string) => {
    setActioningId(id);
    try {
      await api.pauseCronJob(id);
      await load();
    } catch (err) {
      console.error("Failed to pause cron job:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleResume = async (id: string) => {
    setActioningId(id);
    try {
      await api.resumeCronJob(id);
      await load();
    } catch (err) {
      console.error("Failed to resume cron job:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleTrigger = async (id: string) => {
    setActioningId(id);
    try {
      await api.triggerCronJob(id);
      await load();
    } catch (err) {
      console.error("Failed to trigger cron job:", err);
    } finally {
      setActioningId(null);
    }
  };

  const jobs: CronJobNormalized[] =
    source === "rest"
      ? restJobs.map((j) => ({
          id: j.id,
          name: j.name,
          prompt: j.prompt,
          schedule: j.schedule_display || j.schedule.display,
          enabled: j.enabled,
          state: j.state,
          deliver: j.deliver,
          next_run: j.next_run_at ?? null,
          last_run: j.last_run_at ?? null,
          last_error: j.last_error ?? null,
        }))
      : bridgeJobs.map((j) => ({
          id: j.id,
          name: j.name,
          prompt: j.prompt,
          schedule: j.schedule,
          enabled: true,
          state: j.status,
          deliver: undefined,
          next_run: j.next_run ?? null,
          last_run: j.last_run ?? null,
          last_error: null,
        }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">定时任务</h1>
            <p className="text-base text-zinc-500 mt-1">
              配置 Cron 调度，让 Agent 定期执行任务
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-hermes-600 text-white text-sm rounded-lg hover:bg-hermes-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建任务
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-6 bg-surface-1 border border-zinc-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-200">新建定时任务</h3>
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
                  任务名称 (可选)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="每日摘要"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Cron 表达式
                </label>
                <input
                  type="text"
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  placeholder="0 9 * * * (每天 9 点)"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  执行 Prompt
                </label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="请总结今天的所有会话并生成日报…"
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none resize-none"
                />
              </div>
              {source === "rest" && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">
                    投递目标 (可选)
                  </label>
                  <input
                    type="text"
                    value={newDeliver}
                    onChange={(e) => setNewDeliver(e.target.value)}
                    placeholder="telegram, discord, slack..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-hermes-500 focus:outline-none"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newSchedule.trim() || !newPrompt.trim() || creating}
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
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
            <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-1">暂无定时任务</p>
            <p className="text-xs text-zinc-600">
              点击「新建任务」创建 Cron 调度
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <CronJobCard
                key={job.id}
                job={job}
                source={source}
                actioning={actioningId === job.id}
                onDelete={() => handleDelete(job.id)}
                onPause={() => handlePause(job.id)}
                onResume={() => handleResume(job.id)}
                onTrigger={() => handleTrigger(job.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
            <div className="text-xs text-zinc-500 space-y-1">
              <p>
                <strong className="text-zinc-400">Cron 表达式示例：</strong>
              </p>
              <ul className="space-y-0.5 ml-2">
                <li>
                  <code className="text-zinc-400">0 9 * * *</code> — 每天 9 点
                </li>
                <li>
                  <code className="text-zinc-400">*/30 * * * *</code> — 每 30 分钟
                </li>
                <li>
                  <code className="text-zinc-400">0 9 * * 1-5</code> — 工作日 9 点
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CronJobNormalized {
  id: string;
  name?: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  state: string;
  deliver?: string;
  next_run: string | null;
  last_run: string | null;
  last_error: string | null;
}

function CronJobCard({
  job,
  source,
  actioning,
  onDelete,
  onPause,
  onResume,
  onTrigger,
}: {
  job: CronJobNormalized;
  source: CronSource;
  actioning: boolean;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onTrigger: () => void;
}) {
  const isEnabled = job.enabled;
  const isRunning = job.state === "running";

  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : isEnabled ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Pause className="w-4 h-4 text-zinc-500" />
          )}
          <span className="font-medium text-zinc-200 text-sm">
            {job.name || "未命名任务"}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              isRunning
                ? "bg-amber-900/30 text-amber-400"
                : isEnabled
                  ? "bg-emerald-900/30 text-emerald-400"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {isRunning ? "运行中" : isEnabled ? "活跃" : "已暂停"}
          </span>
          {job.deliver && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400">
              → {job.deliver}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {source === "rest" && (
            <>
              <button
                onClick={onTrigger}
                disabled={actioning}
                className="p-1.5 text-zinc-500 hover:text-hermes-400 transition-colors"
                title="立即触发"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              {isEnabled ? (
                <button
                  onClick={onPause}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                  title="暂停"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={onResume}
                  disabled={actioning}
                  className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                  title="恢复"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          <button
            onClick={onDelete}
            disabled={actioning}
            className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
            title="删除"
          >
            {actioning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-2">
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {job.schedule}
        </span>
        {job.next_run && <span>下次: {job.next_run}</span>}
        {job.last_run && <span>上次: {job.last_run}</span>}
      </div>
      {job.last_error && (
        <div className="flex items-start gap-1.5 text-xs text-red-400/80 bg-red-500/5 border border-red-500/20 rounded-lg p-2 mb-2">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="truncate">{job.last_error}</span>
        </div>
      )}
      <p className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg p-2 font-mono">
        {job.prompt}
      </p>
    </div>
  );
}
