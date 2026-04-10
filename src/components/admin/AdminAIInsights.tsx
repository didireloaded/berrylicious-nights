import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, ChefHat, DollarSign, Lightbulb, Loader2, RefreshCw, FileText, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ReportType = "shift-summary" | "kitchen-report" | "revenue-report" | "recommendations";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Brain; desc: string }[] = [
  { id: "shift-summary", label: "Shift Summary", icon: Sparkles, desc: "Full operational overview" },
  { id: "kitchen-report", label: "Kitchen Report", icon: ChefHat, desc: "Throughput & efficiency" },
  { id: "revenue-report", label: "Revenue Report", icon: DollarSign, desc: "Financial analysis" },
  { id: "recommendations", label: "Smart Tips", icon: Lightbulb, desc: "Actionable advice" },
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

  // Daily reports state
  const [pastReports, setPastReports] = useState<ShiftReport[]>([]);
  const [selectedPastReport, setSelectedPastReport] = useState<ShiftReport | null>(null);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch past shift reports
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
      console.error("AI insights error:", err);
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
    <div className="space-y-4">
      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REPORT_OPTIONS.map((opt) => {
          const active = activeReport === opt.id && analysis && !selectedPastReport;
          return (
            <button
              key={opt.id}
              onClick={() => generateReport(opt.id)}
              disabled={loading}
              className={`group relative rounded-xl border p-3 text-left transition-all btn-press ${
                active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30 hover:bg-card/80"
              } disabled:opacity-50`}
            >
              <opt.icon className={`w-4 h-4 mb-1.5 ${active ? "text-primary" : "text-muted-foreground group-hover:text-primary"} transition-colors`} />
              <p className="text-xs font-semibold text-foreground">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Daily Report Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Daily Shift Reports</span>
            {todayReport && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">TODAY ✓</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Calendar className="w-3 h-3" /> {showHistory ? "Hide" : "History"} ({pastReports.length})
            </button>
            <button
              onClick={generateDailyReport}
              disabled={generatingDaily}
              className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {generatingDaily ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {todayReport ? "Regenerate Today" : "Generate Today's Report"}
            </button>
          </div>
        </div>

        {/* History list */}
        {showHistory && (
          <div className="border-b border-border/40 max-h-48 overflow-y-auto">
            {pastReports.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">No reports yet. Generate your first daily report above.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {pastReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => viewPastReport(r)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-muted/20 transition-colors flex items-center justify-between ${
                      selectedPastReport?.id === r.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {new Date(r.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {(r.metadata as any)?.total_orders ?? "?"} orders · N${((r.metadata as any)?.revenue ?? 0).toLocaleString()} revenue
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show selected past report */}
        {selectedPastReport && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Report: {new Date(selectedPastReport.report_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="text-[10px] text-muted-foreground">Generated {new Date(selectedPastReport.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedPastReport(null)} className="text-[10px] text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>

            {/* Quick stats from metadata */}
            {selectedPastReport.metadata && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { l: "Orders", v: (selectedPastReport.metadata as any).total_orders },
                  { l: "Revenue", v: `N$${((selectedPastReport.metadata as any).revenue ?? 0).toLocaleString()}` },
                  { l: "Avg Order", v: `N$${(selectedPastReport.metadata as any).avg_order_value ?? 0}` },
                  { l: "Bookings", v: (selectedPastReport.metadata as any).total_bookings },
                ].map(({ l, v }) => (
                  <div key={l} className="rounded-lg bg-muted/20 p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">{l}</p>
                    <p className="text-sm font-bold text-foreground">{v ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-display prose-headings:font-semibold
              prose-h2:text-base prose-h3:text-sm
              prose-p:text-muted-foreground prose-p:text-sm prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-li:text-muted-foreground prose-li:text-sm
              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{selectedPastReport.content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Live analysis results */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Live AI Analysis</span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
          </div>
          {analysis && (
            <button
              onClick={() => generateReport(activeReport)}
              disabled={loading}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>

        <div className="p-4 min-h-[200px]">
          {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <Brain className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a report type above</p>
              <p className="text-xs mt-1 opacity-70">AI will analyze your live data and generate insights</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Brain className="w-10 h-10 text-primary/30" />
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground mt-3">Analyzing your data…</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">This takes a few seconds</p>
            </div>
          )}

          {analysis && !loading && (
            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-display prose-headings:font-semibold
              prose-h2:text-base prose-h3:text-sm
              prose-p:text-muted-foreground prose-p:text-sm prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-li:text-muted-foreground prose-li:text-sm
              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>

        {generatedAt && analysis && (
          <div className="px-4 py-2 border-t border-border/40 bg-muted/10">
            <p className="text-[10px] text-muted-foreground/60">
              Generated {new Date(generatedAt).toLocaleTimeString()} · Powered by Lovable AI
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Need this for the history chevron
import { ChevronRight } from "lucide-react";

export default AdminAIInsights;
