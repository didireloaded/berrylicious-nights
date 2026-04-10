import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ChefHat, DollarSign, Lightbulb, Loader2, RefreshCw, FileText, Calendar, ChevronRight, TrendingUp, BarChart3, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ReportType = "shift-summary" | "kitchen-report" | "revenue-report" | "recommendations";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Sparkles; desc: string; accent: string }[] = [
  { id: "shift-summary", label: "Shift Summary", icon: BarChart3, desc: "Full operational overview", accent: "from-primary/20 to-primary/5" },
  { id: "kitchen-report", label: "Kitchen Report", icon: ChefHat, desc: "Throughput & efficiency", accent: "from-yellow-500/20 to-yellow-500/5" },
  { id: "revenue-report", label: "Revenue Report", icon: DollarSign, desc: "Financial analysis", accent: "from-emerald-500/20 to-emerald-500/5" },
  { id: "recommendations", label: "Smart Tips", icon: Lightbulb, desc: "Actionable advice", accent: "from-violet-500/20 to-violet-500/5" },
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
  const [activeReport, setActiveReport] = useState<ReportType>("shift-summary");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [pastReports, setPastReports] = useState<ShiftReport[]>([]);
  const [selectedPastReport, setSelectedPastReport] = useState<ShiftReport | null>(null);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
        body: {
          orders: orders.slice(0, 100),
          bookings: bookings.slice(0, 50),
          type,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

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
      if (data?.error) {
        toast.error(data.error);
        return;
      }
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
    setShowHistory(false);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayReport = pastReports.find(r => r.report_date === todayStr);

  return (
    <div className="space-y-5">
      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REPORT_OPTIONS.map((opt) => {
          const active = activeReport === opt.id && analysis && !selectedPastReport;
          return (
            <button
              key={opt.id}
              onClick={() => generateReport(opt.id)}
              disabled={loading}
              className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 btn-press overflow-hidden ${
                active
                  ? "border-primary/40 bg-gradient-to-br " + opt.accent + " shadow-lg shadow-primary/5"
                  : "border-border/60 bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
              } disabled:opacity-50`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                active ? "bg-primary/20" : "bg-muted/40 group-hover:bg-primary/10"
              }`}>
                <opt.icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-primary"} transition-colors`} />
              </div>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Daily Report Section */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Daily Shift Reports</span>
            {todayReport && (
              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold tracking-wide">TODAY ✓</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors px-2 py-1 rounded-lg hover:bg-muted/20"
            >
              <Calendar className="w-3.5 h-3.5" /> {showHistory ? "Hide" : "History"} ({pastReports.length})
            </button>
            <button
              onClick={generateDailyReport}
              disabled={generatingDaily}
              className="text-[11px] bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {generatingDaily ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {todayReport ? "Regenerate" : "Generate Today"}
            </button>
          </div>
        </div>

        {/* History list */}
        {showHistory && (
          <div className="border-b border-border/30 max-h-56 overflow-y-auto">
            {pastReports.length === 0 ? (
              <p className="p-5 text-xs text-muted-foreground text-center">No reports yet. Generate your first daily report above.</p>
            ) : (
              <div className="divide-y divide-border/20">
                {pastReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => viewPastReport(r)}
                    className={`w-full px-5 py-3 text-left hover:bg-muted/10 transition-colors flex items-center justify-between ${
                      selectedPastReport?.id === r.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {new Date(r.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {(r.metadata as any)?.total_orders ?? "?"} orders · N${((r.metadata as any)?.revenue ?? 0).toLocaleString()} revenue
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show selected past report */}
        {selectedPastReport && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {new Date(selectedPastReport.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Generated {new Date(selectedPastReport.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedPastReport(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/20 transition-colors">✕ Close</button>
            </div>

            {selectedPastReport.metadata && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { l: "Orders", v: (selectedPastReport.metadata as any).total_orders, icon: TrendingUp },
                  { l: "Revenue", v: `N$${((selectedPastReport.metadata as any).revenue ?? 0).toLocaleString()}`, icon: DollarSign },
                  { l: "Avg Order", v: `N$${(selectedPastReport.metadata as any).avg_order_value ?? 0}`, icon: BarChart3 },
                  { l: "Bookings", v: (selectedPastReport.metadata as any).total_bookings, icon: Calendar },
                ].map(({ l, v, icon: Icon }) => (
                  <div key={l} className="rounded-xl bg-muted/15 border border-border/30 p-3.5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{v ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-display prose-headings:font-semibold
              prose-h2:text-base prose-h3:text-sm
              prose-p:text-muted-foreground prose-p:text-[13px] prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-li:text-muted-foreground prose-li:text-[13px]
              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{selectedPastReport.content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Live analysis results */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Live Analysis</span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
          </div>
          {analysis && (
            <button
              onClick={() => generateReport(activeReport)}
              disabled={loading}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors px-2 py-1 rounded-lg hover:bg-muted/20"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>

        <div className="p-5 min-h-[220px]">
          {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Select a report type above</p>
              <p className="text-xs mt-1.5 opacity-60 max-w-[240px]">Your data will be analyzed to generate detailed insights</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <BarChart3 className="w-6 h-6 text-primary/60" />
                </div>
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-bounce" />
              </div>
              <p className="text-sm text-muted-foreground mt-4 font-medium">Analyzing your data…</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:200ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:400ms]" />
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-display prose-headings:font-semibold
              prose-h2:text-base prose-h3:text-sm
              prose-p:text-muted-foreground prose-p:text-[13px] prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-li:text-muted-foreground prose-li:text-[13px]
              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>

        {generatedAt && analysis && (
          <div className="px-5 py-2.5 border-t border-border/30 bg-muted/5">
            <p className="text-[10px] text-muted-foreground/50">
              Generated {new Date(generatedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAIInsights;
