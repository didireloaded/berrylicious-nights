import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ChefHat, DollarSign, Lightbulb, Loader2, RefreshCw, FileText, Calendar, ChevronRight, TrendingUp, BarChart3, Zap, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ReportType = "shift-summary" | "kitchen-report" | "revenue-report" | "recommendations";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Sparkles; desc: string; color: string }[] = [
  { id: "shift-summary", label: "Shift Summary", icon: BarChart3, desc: "Full operational overview", color: "text-primary" },
  { id: "kitchen-report", label: "Kitchen Report", icon: ChefHat, desc: "Throughput & efficiency", color: "text-amber-400" },
  { id: "revenue-report", label: "Revenue Report", icon: DollarSign, desc: "Financial analysis", color: "text-emerald-400" },
  { id: "recommendations", label: "Smart Tips", icon: Lightbulb, desc: "Actionable advice", color: "text-violet-400" },
];

interface ShiftReport {
  id: string;
  report_date: string;
  report_type: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface Props {
  orders: any[];
  bookings: any[];
}

const AdminAIInsights = ({ orders, bookings }: Props) => {
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [pastReports, setPastReports] = useState<ShiftReport[]>([]);
  const [selectedPastReport, setSelectedPastReport] = useState<ShiftReport | null>(null);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  /* ---- live stats ---- */
  const todayStr = new Date().toISOString().split("T")[0];
  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => String(o.created_at).startsWith(todayStr));
    const revenue = todayOrders
      .filter((o: any) => ["completed", "ready", "preparing"].includes(o.status))
      .reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    const todayBookings = bookings.filter((b: any) => b.date === todayStr);
    return {
      todayOrders: todayOrders.length,
      revenue,
      pending,
      bookings: todayBookings.length,
      guests: todayBookings.reduce((s: number, b: any) => s + (b.guests || 0), 0),
      avgOrder: todayOrders.length > 0 ? Math.round(revenue / todayOrders.length) : 0,
    };
  }, [orders, bookings, todayStr]);

  const fetchPastReports = useCallback(async () => {
    const { data } = await supabase
      .from("shift_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .limit(30);
    if (data) setPastReports(data as unknown as ShiftReport[]);
  }, []);

  useEffect(() => { fetchPastReports(); }, [fetchPastReports]);

  const generateReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setAnalysis(null);
    setActiveReport(type);
    setSelectedPastReport(null);
    setShowHistory(false);

    try {
      const { data, error } = await supabase.functions.invoke("admin-insights", {
        body: { orders: orders.slice(0, 100), bookings: bookings.slice(0, 50), type },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAnalysis(data.analysis);
      setGeneratedAt(data.generated_at);
    } catch (err: any) {
      console.error("Insights error:", err);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [orders, bookings]);

  const generateDailyReport = useCallback(async () => {
    setGeneratingDaily(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-shift-report");
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Daily shift report generated!");
      fetchPastReports();
    } catch (err: any) {
      console.error("Daily report error:", err);
      toast.error("Failed to generate daily report");
    } finally {
      setGeneratingDaily(false);
    }
  }, [fetchPastReports]);

  const viewPastReport = (report: ShiftReport) => {
    setSelectedPastReport(report);
    setAnalysis(null);
    setActiveReport(null);
    setShowHistory(false);
  };

  const todayReport = pastReports.find(r => r.report_date === todayStr);
  const displayContent = selectedPastReport?.content ?? analysis;
  const displayMeta = selectedPastReport?.metadata ?? null;

  return (
    <div className="space-y-5">

      {/* ─── Live KPI strip ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {[
          { label: "Today's Orders", value: stats.todayOrders, icon: TrendingUp, accent: "text-primary" },
          { label: "Revenue", value: `N$${stats.revenue.toLocaleString()}`, icon: DollarSign, accent: "text-emerald-400" },
          { label: "Avg Order", value: `N$${stats.avgOrder}`, icon: BarChart3, accent: "text-amber-400" },
          { label: "Pending", value: stats.pending, icon: Clock, accent: stats.pending > 5 ? "text-red-400" : "text-muted-foreground" },
          { label: "Bookings", value: stats.bookings, icon: Calendar, accent: "text-violet-400" },
          { label: "Guests", value: stats.guests, icon: ArrowUpRight, accent: "text-primary" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-3 group hover:border-primary/20 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</span>
              <Icon className={`w-3 h-3 ${accent} opacity-60`} />
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* ─── Report type cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {REPORT_OPTIONS.map((opt) => {
          const active = activeReport === opt.id && !selectedPastReport;
          return (
            <button
              key={opt.id}
              onClick={() => generateReport(opt.id)}
              disabled={loading}
              className={`group relative rounded-xl border p-3.5 text-left transition-all duration-200 btn-press overflow-hidden ${
                active
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/40 bg-card/40 hover:border-primary/30 hover:bg-card/80"
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  active ? "bg-primary/15" : "bg-muted/20 group-hover:bg-primary/10"
                }`}>
                  <opt.icon className={`w-4 h-4 transition-colors ${active ? opt.color : "text-muted-foreground group-hover:" + opt.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 leading-tight">{opt.desc}</p>
                </div>
              </div>
              {active && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary/60" />}
            </button>
          );
        })}
      </div>

      {/* ─── Analysis display ─── */}
      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        {/* header */}
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground tracking-wide">
              {selectedPastReport
                ? new Date(selectedPastReport.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                : "Live Analysis"}
            </span>
            {loading && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
          </div>
          <div className="flex items-center gap-1.5">
            {selectedPastReport && (
              <button onClick={() => setSelectedPastReport(null)} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/20 transition-colors">✕ Close</button>
            )}
            {analysis && !selectedPastReport && (
              <button
                onClick={() => generateReport(activeReport!)}
                disabled={loading}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-muted/20"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Refresh
              </button>
            )}
          </div>
        </div>

        {/* metadata cards (from past report) */}
        {displayMeta && (
          <div className="px-4 py-3 border-b border-border/20 bg-muted/5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { l: "Orders", v: displayMeta.total_orders, icon: TrendingUp, color: "text-primary" },
                { l: "Revenue", v: `N$${(displayMeta.revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-emerald-400" },
                { l: "Avg Order", v: `N$${displayMeta.avg_order_value ?? 0}`, icon: BarChart3, color: "text-amber-400" },
                { l: "Bookings", v: displayMeta.total_bookings, icon: Calendar, color: "text-violet-400" },
              ].map(({ l, v, icon: Icon, color }) => (
                <div key={l} className="flex items-center gap-2.5 rounded-lg bg-background/40 border border-border/20 px-3 py-2">
                  <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                  <div>
                    <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider leading-none">{l}</p>
                    <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">{v ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* content body */}
        <div className="p-4 min-h-[200px]">
          {!displayContent && !loading && (
            <div className="flex flex-col items-center justify-center text-center py-14 text-muted-foreground/40">
              <BarChart3 className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-xs font-medium opacity-60">Select a report type to begin</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-14">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-xl bg-primary/10 animate-ping" />
                <div className="relative w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary/70" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 font-medium">Crunching the numbers…</p>
              <div className="flex items-center gap-1 mt-2.5">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1 h-1 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          {displayContent && !loading && (
            <div className="analysis-content space-y-4">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold text-foreground border-b border-border/30 pb-2 mb-3">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <div className="flex items-center gap-2 mt-5 mb-2">
                      <div className="w-1 h-4 rounded-full bg-primary/60" />
                      <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">{children}</h2>
                    </div>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xs font-semibold text-foreground/90 mt-3 mb-1.5">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-foreground font-semibold">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-1.5 my-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-2 my-2 counter-reset-item">{children}</ol>
                  ),
                  li: ({ children, ...props }) => (
                    <li className="flex items-start gap-2 text-[13px] text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                      <span>{children}</span>
                    </li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/40 pl-3 py-1 my-3 bg-primary/5 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* footer */}
        {generatedAt && displayContent && !selectedPastReport && (
          <div className="px-4 py-2 border-t border-border/20">
            <p className="text-[9px] text-muted-foreground/40 tabular-nums">
              Generated {new Date(generatedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {/* ─── Daily Reports / History ─── */}
      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-xs font-semibold text-foreground">Daily Reports</span>
            {todayReport && (
              <span className="text-[8px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold tracking-wide">TODAY ✓</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-muted/20"
            >
              <Calendar className="w-3 h-3" /> {showHistory ? "Hide" : "History"} ({pastReports.length})
            </button>
            <button
              onClick={generateDailyReport}
              disabled={generatingDaily}
              className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
            >
              {generatingDaily ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {todayReport ? "Regenerate" : "Generate Today"}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="max-h-52 overflow-y-auto">
            {pastReports.length === 0 ? (
              <p className="p-5 text-[11px] text-muted-foreground/50 text-center">No reports yet</p>
            ) : (
              <div className="divide-y divide-border/15">
                {pastReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => viewPastReport(r)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-muted/10 transition-colors flex items-center justify-between group ${
                      selectedPastReport?.id === r.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">
                        {new Date(r.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">
                        {(r.metadata as any)?.total_orders ?? "?"} orders · N${((r.metadata as any)?.revenue ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAIInsights;
