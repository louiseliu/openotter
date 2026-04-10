import { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Calendar,
  Play,
  AlertCircle,
  X,
} from "lucide-react";
import {
  listCronJobs,
  createCronJob,
  deleteCronJob,
  type CronJobInfo,
} from "../../lib/hermes-bridge";

export default function CronView() {
  const [jobs, setJobs] = useState<CronJobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSchedule, setNewSchedule] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listCronJobs();
      setJobs(list);
    } catch (err) {
      console.error("Failed to load cron jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!newSchedule.trim() || !newPrompt.trim()) return;
    setCreating(true);
    try {
      await createCronJob(
        newSchedule.trim(),
        newPrompt.trim(),
        newName.trim() || undefined
      );
      setShowCreate(false);
      setNewSchedule("");
      setNewPrompt("");
      setNewName("");
      await load();
    } catch (err) {
      console.error("Failed to create cron job:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCronJob(id);
      await load();
    } catch (err) {
      console.error("Failed to delete cron job:", err);
    } finally {
      setDeletingId(null);
    }
  };

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

        {/* Create Dialog */}
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

        {/* Job List */}
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
              <div
                key={job.id}
                className="bg-surface-1 border border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-hermes-400" />
                    <span className="font-medium text-zinc-200 text-sm">
                      {job.name || "未命名任务"}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        job.status === "active"
                          ? "bg-emerald-900/30 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {job.schedule}
                  </span>
                  {job.next_run && (
                    <span>下次运行: {job.next_run}</span>
                  )}
                  {job.last_run && (
                    <span>上次运行: {job.last_run}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg p-2 font-mono">
                  {job.prompt}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
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
                  <code className="text-zinc-400">*/30 * * * *</code> — 每 30
                  分钟
                </li>
                <li>
                  <code className="text-zinc-400">0 9 * * 1-5</code> — 工作日 9
                  点
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
