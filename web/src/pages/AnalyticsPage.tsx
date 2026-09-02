import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart3,
  MessageSquare,
  Brain,
  Layers,
  TrendingUp,
  Activity,
  Hash,
  Calendar,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PERIODS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 365 },
] as const;

type Range = (typeof PERIODS)[number]["days"];

type AnalyticsData = any;

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relTime(epoch: number): string {
  const sec = Math.floor(Date.now() / 1000 - epoch);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// SVG Line/Area Chart for messages over time
function MessagesChart({ data }: { data: AnalyticsData["by_day"] }) {
  const W = 600;
  const H = 140;
  const PAD = 8;
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>;
  }
  const max = Math.max(1, ...data.map((d: any) => d.messages));
  const stepX = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
  const points = data.map((d: any, i: number) => {
    const x = PAD + i * stepX;
    const y = H - PAD - (d.messages / max) * (H - PAD * 2);
    return { x, y, d };
  });
  const pathLine = points.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const pathArea = `${pathLine} L${PAD + (data.length - 1) * stepX},${H - PAD} L${PAD},${H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#007AFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill="url(#msgGrad)" />
      <path d={pathLine} fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p: any, i: number) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#007AFF">
          <title>{`${p.d.day}: ${p.d.messages} messages`}</title>
        </circle>
      ))}
    </svg>
  );
}

// Donut chart for model distribution
function ModelDonut({ data }: { data: AnalyticsData["by_model"] }) {
  const total = data.reduce((s: number, d: any) => s + d.messages, 0) || 1;
  const colors = ["#007AFF", "#34C759", "#FF9F0A", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55", "#8E8E93"];
  let offset = 0;
  const R = 50;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-24 h-24 shrink-0">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(120,120,128,0.15)" strokeWidth="14" />
        {data.slice(0, 5).map((m: any, i: number) => {
          const pct = m.messages / total;
          const dash = pct * C;
          const el = (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
              strokeLinecap="round"
            >
              <title>{`${m.model}: ${m.messages} (${(pct * 100).toFixed(1)}%)`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="flex-1 space-y-1 min-w-0">
        {data.slice(0, 5).map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-[0.7rem]">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="truncate flex-1 min-w-0 font-medium">{m.model}</span>
            <span className="text-muted-foreground tabular-nums">{m.messages}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar chart for providers
function ProviderBars({ data }: { data: AnalyticsData["by_provider"] }) {
  if (data.length === 0) {
    return <div className="text-xs text-muted-foreground">No data yet</div>;
  }
  return (
    <div className="space-y-2">
      {data.map((p: any) => (
        <div key={p.provider} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{p.provider}</span>
            <span className="text-muted-foreground tabular-nums">
              {p.sessions} · {(p.share * 100).toFixed(1)}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "color-mix(in srgb, var(--c-dark) 8%, transparent)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${p.share * 100}%`,
                background:
                  "linear-gradient(90deg, var(--c-action) 0%, color-mix(in srgb, var(--c-action) 60%, transparent) 100%)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 365-day activity heatmap
function Heatmap({ data }: { data: AnalyticsData["heatmap"] }) {
  // Build a 53-week grid (last 365 days)
  const dayMap = new Map<string, number>();
  data.forEach((d: any) => dayMap.set(d.day, d.count));
  const today = new Date();
  const cells: { date: string; count: number; week: number; day: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0=Sun
    const weekIdx = Math.floor((364 - i + today.getDay()) / 7);
    cells.push({ date: key, count: dayMap.get(key) || 0, week: weekIdx, day: dow });
  }
  // group by week
  const weeks: typeof cells[] = [];
  cells.forEach((c) => {
    if (!weeks[c.week]) weeks[c.week] = [];
    weeks[c.week].push(c);
  });
  const max = Math.max(1, ...data.map((d: any) => d.count));
  const intensity = (c: number) => {
    if (c === 0) return 0.05;
    return 0.25 + 0.75 * (c / max);
  };
  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="inline-flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const cell = week.find((c) => c.day === di);
              if (!cell) return <div key={di} className="h-3 w-3" />;
              return (
                <div
                  key={di}
                  className="h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--c-action) ${intensity(cell.count) * 100}%, transparent)`,
                    border: "0.5px solid color-mix(in srgb, var(--c-light) 6%, transparent)",
                  }}
                  title={`${cell.date}: ${cell.count} messages`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<Range>(7);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [pulse, setPulse] = useState(false);
  const prevTotal = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const json: any = await api.getAnalytics(range);
      setData(json);
      setLastUpdate(Date.now());
      if (json?.total_messages !== prevTotal.current) {
        setPulse(true);
        prevTotal.current = json?.total_messages ?? 0;
        setTimeout(() => setPulse(false), 800);
      }
    } catch (e) {
      console.error("analytics fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 3000);
    return () => clearInterval(i);
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass h-24 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="glass h-40 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="glass h-48 rounded-2xl animate-pulse" />
          <div className="glass h-48 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Top row: 4 overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Messages"
          value={data.total_messages}
          accent="#007AFF"
          pulse={pulse}
        />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Sessions" value={data.total_sessions} accent="#34C759" />
        <StatCard
          icon={<Brain className="h-4 w-4" />}
          label="Models"
          value={data.models_used.length}
          accent="#FF9F0A"
        />
        <StatCard
          icon={<Hash className="h-4 w-4" />}
          label="Tokens"
          value={formatNum((data.total_tokens_in || 0) + (data.total_tokens_out || 0))}
          accent="#AF52DE"
        />
      </div>

      {/* Time range tabs + live indicator */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-full p-0.5" style={{ backgroundColor: "color-mix(in srgb, var(--c-glass) 8%, transparent)" }}>
          {PERIODS.map((p) => {
            const active = p.days === range;
            return (
              <button
                key={p.days}
                onClick={() => setRange(p.days as Range)}
                className="relative px-3 py-1 text-[0.72rem] font-medium rounded-full focus-visible:outline-none transition-colors"
                style={{
                  color: active ? "var(--c-action)" : "var(--c-content)",
                  backgroundColor: active ? "color-mix(in srgb, var(--c-glass) 36%, transparent)" : "transparent",
                  boxShadow: active
                    ? "inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 20%), transparent)"
                    : "none",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: "#34C759",
              boxShadow: "0 0 6px rgba(52,199,89,0.6)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span>Live · {lastUpdate ? relTime(Math.floor(lastUpdate / 1000)) : "—"}</span>
        </div>
      </div>

      {/* Messages over time (line/area chart) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Messages over time
            <span className="ml-auto text-[0.65rem] font-normal text-muted-foreground">
              {data.by_day.length} day{data.by_day.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <MessagesChart data={data.by_day} />
        </CardContent>
      </Card>

      {/* Two columns: models + providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Top models
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ModelDonut data={data.by_model} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Provider usage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ProviderBars data={data.by_provider} />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Activity heatmap
            <span className="ml-auto text-[0.65rem] font-normal text-muted-foreground">Last 365 days</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Heatmap data={data.heatmap} />
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Recent activity
            <span className="ml-auto text-[0.65rem] font-normal text-muted-foreground">
              {data.by_status.active} active
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recent.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No sessions yet</div>
          ) : (
            <div className="space-y-1.5">
              {data.recent.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="font-mono text-[0.62rem] text-muted-foreground tabular-nums shrink-0 w-16">
                    {s.last_active ? relTime(s.last_active) : "—"}
                  </span>
                  <span className="flex-1 truncate font-medium">{s.title || s.id.slice(0, 20)}</span>
                  <span className="text-[0.62rem] text-muted-foreground shrink-0">{s.model || "—"}</span>
                  <span className="text-[0.62rem] text-muted-foreground tabular-nums shrink-0">
                    {s.messages || 0} msg
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status row */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatusCard
          label="Active"
          value={data.by_status.active}
          color="#34C759"
        />
        <StatusCard
          label="Paused"
          value={data.by_status.paused}
          color="#FF9F0A"
        />
        <StatusCard
          label="Ended"
          value={data.by_status.ended}
          color="#8E8E93"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div
      className="glass relative overflow-hidden rounded-2xl p-3"
      style={{
        animation: pulse ? "pulse 0.8s ease-out" : undefined,
      }}
    >
      <div
        className="absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center gap-1.5 text-muted-foreground text-[0.7rem]">
        {icon}
        <span className="uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
