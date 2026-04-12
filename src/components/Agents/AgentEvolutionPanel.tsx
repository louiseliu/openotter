import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Sparkles,
  Brain,
  MessageSquare,
  Zap,
  Clock,
  TrendingUp,
  Loader2,
  RefreshCw,
  Star,
  ChevronDown,
  ChevronRight,
  Radio,
} from "lucide-react";
import {
  getAgentEvolution,
  getEvolutionLog,
  onEvolutionEvent,
  getHermesInsights,
  type AgentEvolution,
  type EvolutionEvent,
  type EvolutionLogEntry,
  type WatcherEvent,
  type HermesInsights,
} from "../../lib/hermes-bridge";

const LEVEL_COLORS: Record<number, string> = {
  1: "from-zinc-500 to-zinc-400",
  2: "from-green-500 to-emerald-400",
  3: "from-teal-500 to-cyan-400",
  4: "from-blue-500 to-sky-400",
  5: "from-indigo-500 to-blue-400",
  6: "from-violet-500 to-purple-400",
  7: "from-purple-500 to-pink-400",
  8: "from-amber-500 to-yellow-400",
  9: "from-orange-500 to-red-400",
  10: "from-rose-500 to-pink-400",
};

const EVENT_ICONS: Record<string, string> = {
  birth: "🎉",
  skill: "⚡",
  memory: "🧠",
  milestone: "🏆",
  session: "💬",
};

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff < 7) return `${diff}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formatFullDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function XPBar({
  xp,
  xpNext,
  level,
  prevThreshold,
}: {
  xp: number;
  xpNext: number;
  level: number;
  prevThreshold: number;
}) {
  const range = xpNext - prevThreshold;
  const progress = range > 0 ? Math.min(((xp - prevThreshold) / range) * 100, 100) : 100;
  const gradientCls = LEVEL_COLORS[level] || LEVEL_COLORS[1];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-500">
          {xp.toLocaleString()} / {xpNext.toLocaleString()} XP
        </span>
        <span className="text-xs text-zinc-500">{Math.round(progress)}%</span>
      </div>
      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientCls} transition-all duration-1000 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}


function EventTimeline({ events }: { events: EvolutionEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, 8);

  return (
    <div className="space-y-0">
      {visible.map((evt, i) => (
        <div key={i} className="flex gap-3 group">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-sm shrink-0 group-hover:bg-surface-3 transition-colors">
              {EVENT_ICONS[evt.event_type] || "📌"}
            </div>
            {i < visible.length - 1 && (
              <div className="w-px flex-1 bg-zinc-800 min-h-[16px]" />
            )}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-sm text-zinc-200 font-medium">{evt.title}</p>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {evt.detail}
            </p>
            {evt.timestamp > 0 && (
              <p className="text-[10px] text-zinc-600 mt-1">
                {formatFullDate(evt.timestamp)}
              </p>
            )}
          </div>
        </div>
      ))}
      {events.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-xs text-hermes-400 hover:text-hermes-300 ml-11 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronDown className="w-3 h-3" />
              收起
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              查看全部 {events.length} 条
            </>
          )}
        </button>
      )}
    </div>
  );
}

function AbilityRadar({
  tools,
}: {
  tools: { tool: string; calls: number; percentage: number }[];
}) {
  const items = tools.slice(0, 6);
  if (items.length < 3) return null;

  const cx = 120;
  const cy = 120;
  const maxR = 90;
  const rings = [0.25, 0.5, 0.75, 1.0];
  const n = items.length;
  const maxCalls = Math.max(...items.map((t) => t.calls), 1);

  const getPoint = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
    };
  };

  const dataPoints = items.map((item, i) => getPoint(i, item.calls / maxCalls));
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto">
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => {
            const p = getPoint(i, r);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="rgb(63 63 70 / 0.4)"
          strokeWidth="0.5"
        />
      ))}

      {items.map((_, i) => {
        const p = getPoint(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgb(63 63 70 / 0.3)"
            strokeWidth="0.5"
          />
        );
      })}

      <polygon
        points={dataPath.replace(/[MLZ]/g, "").trim()}
        fill="rgb(14 165 233 / 0.15)"
        stroke="rgb(14 165 233 / 0.6)"
        strokeWidth="1.5"
      />

      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="#0ea5e9"
          stroke="#09090b"
          strokeWidth="1.5"
        />
      ))}

      {items.map((item, i) => {
        const p = getPoint(i, 1.18);
        const anchor =
          Math.abs(p.x - cx) < 5 ? "middle" : p.x > cx ? "start" : "end";
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-zinc-500 text-[9px]"
          >
            {item.tool.length > 12 ? item.tool.slice(0, 12) + "…" : item.tool}
          </text>
        );
      })}
    </svg>
  );
}

function ActivityHeatmap({ data }: { data: [string, number][] }) {
  const weeks = useMemo(() => {
    const today = new Date();
    const grid: { date: string; count: number; dayOfWeek: number }[][] = [];
    const lookup = new Map(data.map((d) => [d[0], d[1]]));

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 12 * 7 + 1);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];

    for (let i = 0; i < 13 * 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const dow = d.getDay();

      if (dow === 0 && currentWeek.length > 0) {
        grid.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({
        date: key,
        count: lookup.get(key) || 0,
        dayOfWeek: dow,
      });
    }
    if (currentWeek.length > 0) grid.push(currentWeek);
    return grid;
  }, [data]);

  const maxCount = Math.max(...data.map((d) => d[1]), 1);

  const getColor = (count: number) => {
    if (count === 0) return "bg-surface-2";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-hermes-500/20";
    if (ratio < 0.5) return "bg-hermes-500/40";
    if (ratio < 0.75) return "bg-hermes-500/60";
    return "bg-hermes-500/80";
  };

  const dayLabels = ["日", "", "二", "", "四", "", "六"];

  return (
    <div className="flex gap-1">
      <div className="flex flex-col gap-1 mr-1">
        {dayLabels.map((label, i) => (
          <div key={i} className="h-3 w-4 text-[8px] text-zinc-600 flex items-center justify-end">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.date}
              className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
              title={`${day.date}: ${day.count} 条会话`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const XP_THRESHOLDS = [0, 50, 150, 400, 800, 1500, 3000, 5000, 8000, 12000];

export default function AgentEvolutionPanel({ agentId }: { agentId: string }) {
  const [data, setData] = useState<AgentEvolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<WatcherEvent[]>([]);
  const [changeLog, setChangeLog] = useState<EvolutionLogEntry[]>([]);
  const [watcherActive, setWatcherActive] = useState(false);
  const [insights, setInsights] = useState<HermesInsights | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evo, log] = await Promise.all([
        getAgentEvolution(agentId),
        getEvolutionLog(30),
      ]);
      setData(evo);
      setChangeLog(log);
      lastRefreshRef.current = Date.now();
      getHermesInsights(30).then(setInsights).catch(() => {});
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    onEvolutionEvent((evt) => {
      setWatcherActive(true);
      setRealtimeEvents((prev) => [evt, ...prev].slice(0, 20));
      if (Date.now() - lastRefreshRef.current > 3000) {
        loadData();
      }
    }).then((u) => {
      unlisten = u;
      setWatcherActive(true);
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadData]);

  const prevThreshold = useMemo(() => {
    if (!data) return 0;
    return XP_THRESHOLDS[data.level - 1] || 0;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-hermes-400" />
        <p className="text-sm text-zinc-500">加载进化数据...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-400">{error || "无法加载进化数据"}</p>
        <button
          onClick={loadData}
          className="text-xs text-hermes-400 hover:text-hermes-300 mt-2"
        >
          重试
        </button>
      </div>
    );
  }

  const gradientCls = LEVEL_COLORS[data.level] || LEVEL_COLORS[1];

  return (
    <div className="space-y-6">
      {/* Hero: Level Card */}
      <div className="relative bg-surface-1 border border-zinc-800 rounded-2xl p-6 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientCls} opacity-5`} />
        <div className="relative">
          <div className="flex items-center gap-4 mb-5">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientCls} flex items-center justify-center text-2xl shadow-lg`}
            >
              <Star className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-bold bg-gradient-to-r ${gradientCls} bg-clip-text text-transparent`}>
                  Lv.{data.level}
                </span>
                <span className="text-lg text-zinc-300 font-medium">
                  {data.level_title}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">
                {data.agent_name} · 创建于 {formatDate(data.created_at)}
              </p>
            </div>
            <div className="ml-auto">
              <button
                onClick={loadData}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <XPBar
            xp={data.xp}
            xpNext={data.xp_next}
            level={data.level}
            prevThreshold={prevThreshold}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<MessageSquare className="w-4 h-4 text-blue-400" />}
          label="总会话"
          value={data.total_sessions}
          accent="bg-blue-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-hermes-400" />}
          label="总消息"
          value={data.total_messages}
          accent="bg-hermes-500/10"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          label="技能"
          value={data.total_skills}
          accent="bg-amber-500/10"
        />
        <StatCard
          icon={<Brain className="w-4 h-4 text-violet-400" />}
          label="记忆"
          value={data.total_memories}
          accent="bg-violet-500/10"
        />
      </div>

      {/* Ability Radar + Activity Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ability Radar */}
        {insights && insights.top_tools.length >= 3 && (
          <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-hermes-400" />
              <h3 className="text-sm font-medium text-zinc-300">能力雷达</h3>
            </div>
            <AbilityRadar tools={insights.top_tools} />
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
              {insights.top_tools.slice(0, 6).map((t) => (
                <span
                  key={t.tool}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-hermes-500/10 text-hermes-400"
                >
                  {t.tool}: {t.calls}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activity Heatmap */}
        <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">活跃度热力图</h3>
            <span className="text-[10px] text-zinc-600">近 3 个月</span>
          </div>
          {data.daily_messages.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <ActivityHeatmap data={data.daily_messages} />
              </div>
              <div className="flex items-center gap-1.5 mt-3 justify-end">
                <span className="text-[9px] text-zinc-600">少</span>
                <span className="w-3 h-3 rounded-sm bg-surface-2" />
                <span className="w-3 h-3 rounded-sm bg-hermes-500/20" />
                <span className="w-3 h-3 rounded-sm bg-hermes-500/40" />
                <span className="w-3 h-3 rounded-sm bg-hermes-500/60" />
                <span className="w-3 h-3 rounded-sm bg-hermes-500/80" />
                <span className="text-[9px] text-zinc-600">多</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-zinc-600">暂无活跃数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Two columns: Skills & Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Skills */}
        <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-300">
              已掌握技能
              <span className="text-zinc-600 ml-1">({data.skills_timeline.length})</span>
            </h3>
          </div>
          {data.skills_timeline.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">暂无技能</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.skills_timeline.map((skill) => (
                <div
                  key={skill.name}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-amber-500 text-xs">⚡</span>
                    <span className="text-sm text-zinc-300 truncate">
                      {skill.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0 ml-2">
                    {formatDate(skill.installed_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Memories */}
        <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-medium text-zinc-300">
              记忆碎片
              <span className="text-zinc-600 ml-1">({data.memory_files.length})</span>
            </h3>
          </div>
          {data.memory_files.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">暂无记忆</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.memory_files.map((mem) => (
                <div key={mem.name} className="py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 truncate">
                      {mem.name}
                    </span>
                    <span className="text-[10px] text-zinc-600 shrink-0 ml-2">
                      {formatDate(mem.modified_at)}
                    </span>
                  </div>
                  {mem.preview && (
                    <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">
                      {mem.preview}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Evolution Timeline */}
      {data.events.length > 0 && (
        <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">进化时间线</h3>
          </div>
          <EventTimeline events={data.events} />
        </div>
      )}

      {/* Real-time Monitor */}
      <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${
                watcherActive ? "text-emerald-400" : "text-zinc-600"
              }`}
            />
            <h3 className="text-sm font-medium text-zinc-300">实时监控</h3>
            {watcherActive && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500">监听中</span>
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-600">
            监听 skills · memories 变动
          </span>
        </div>

        {realtimeEvents.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-4">
            {watcherActive
              ? "等待变动事件..."
              : "正在连接文件监听器..."}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {realtimeEvents.map((evt, i) => (
              <div
                key={`${evt.timestamp}-${i}`}
                className="flex items-start gap-2 py-1.5 animate-in fade-in"
              >
                <span className="text-xs mt-0.5">
                  {EVENT_ICONS[evt.event_type.split("_")[0]] || "📌"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300">{evt.title}</p>
                  <p className="text-[10px] text-zinc-600 truncate">
                    {evt.detail}
                  </p>
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {formatFullDate(evt.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Log History */}
      {changeLog.length > 0 && (
        <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">
              变更日志
              <span className="text-zinc-600 ml-1">
                ({changeLog.length})
              </span>
            </h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {changeLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0"
              >
                <span className="text-xs mt-0.5">
                  {EVENT_ICONS[entry.event_type.split("_")[0]] || "📌"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300">{entry.title}</p>
                  {entry.detail && (
                    <p className="text-[10px] text-zinc-600 truncate">
                      {entry.detail}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {formatFullDate(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${accent} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-zinc-100 tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
