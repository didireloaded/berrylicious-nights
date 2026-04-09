import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, ChefHat, DollarSign, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ReportType = "shift-summary" | "kitchen-report" | "revenue-report" | "recommendations";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Brain; desc: string }[] = [
  { id: "shift-summary", label: "Shift Summary", icon: Sparkles, desc: "Full operational overview" },
  { id: "kitchen-report", label: "Kitchen Report", icon: ChefHat, desc: "Throughput & efficiency" },
  { id: "revenue-report", label: "Revenue Report", icon: DollarSign, desc: "Financial analysis" },
  { id: "recommendations", label: "Smart Tips", icon: Lightbulb, desc: "Actionable advice" },
];

interface Props {
  orders: any[];
  bookings: any[];
}

const AdminAIInsights = ({ orders, bookings }: Props) => {
  const [activeReport, setActiveReport] = useState<ReportType>("shift-summary");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const generateReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setAnalysis(null);
    setActiveReport(type);

    try {
      const { data, error } = await supabase.functions.invoke("admin-insights", {
        body: {
          orders: orders.slice(0, 100), // Send last 100 orders for context
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

  return (
    <div className="space-y-4">
      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REPORT_OPTIONS.map((opt) => {
          const active = activeReport === opt.id && analysis;
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

      {/* Results area */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Analysis</span>
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

        {/* Content */}
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
              prose-ul:my-2 prose-ol:my-2
              prose-li:my-0.5">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
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

export default AdminAIInsights;
