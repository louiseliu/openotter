import { useEffect, useState } from "react";
import {
  Brain,
  Database,
  MessageSquare,
  RefreshCw,
  BarChart3,
  Loader2,
} from "lucide-react";
import {
  getSessionStats,
  listRecentSessions,
  type SessionStats,
  type SessionListItem,
} from "../../lib/hermes-bridge";

export default function MemoryView() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, sess] = await Promise.all([
        getSessionStats(),
        listRecentSessions(undefined, 30),
      ]);
      setStats(s);
      setSessions(sess);
    } catch (err) {
      console.error("Failed to load memory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">记忆系统</h1>
            <p className="text-base text-zinc-500 mt-1">
              Hermes 的三层记忆：会话 · 持久 · Skill
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<MessageSquare className="w-5 h-5 text-blue-400" />}
                label="总会话"
                value={String(stats?.total_sessions ?? 0)}
              />
              <StatCard
                icon={<BarChart3 className="w-5 h-5 text-hermes-400" />}
                label="总消息"
                value={String(stats?.total_messages ?? 0)}
              />
              <StatCard
                icon={<Database className="w-5 h-5 text-emerald-400" />}
                label="数据库"
                value={`${stats?.db_size_mb?.toFixed(1) ?? "0"} MB`}
              />
              <StatCard
                icon={<Brain className="w-5 h-5 text-purple-400" />}
                label="平台数"
                value={String(stats?.platforms?.length ?? 0)}
              />
            </div>

            {/* Platform Breakdown */}
            {stats?.platforms && stats.platforms.length > 0 && (
              <section className="mb-8">
                <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5">
                  平台分布
                </h2>
                <div className="bg-surface-1 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                  {stats.platforms.map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-sm text-zinc-200">{p.name}</span>
                      <span className="text-sm text-zinc-500">
                        {p.sessions} 条会话
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Sessions */}
            <section>
              <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5">
                最近会话
              </h2>
              {sessions.length === 0 ? (
                <div className="text-center py-12 bg-surface-1 border border-zinc-800 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">暂无会话记录</p>
                </div>
              ) : (
                <div className="bg-surface-1 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                  {sessions.map((s, i) => (
                    <div
                      key={`${s.id}-${i}`}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">
                          {s.preview || "无预览"}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {s.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {s.source}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {s.last_active}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}
