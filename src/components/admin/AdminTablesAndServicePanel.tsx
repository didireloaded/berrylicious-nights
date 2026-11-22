import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Plus, Printer, QrCode, RefreshCw, RotateCw, ShieldOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  buildTableQrUrl,
  getServiceRequestLabel,
  type RestaurantTableRow,
  type ServiceRequestRow,
  type TableSessionRow,
} from "@/lib/tableService";

export function AdminTablesAndServicePanel() {
  const { isAdmin } = useAuth();
  const [tables, setTables] = useState<RestaurantTableRow[]>([]);
  const [sessions, setSessions] = useState<TableSessionRow[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [selectedQrTable, setSelectedQrTable] = useState<RestaurantTableRow | null>(null);
  const [newTable, setNewTable] = useState({
    table_number: "",
    display_name: "",
    capacity: 4,
    area: "Main Dining",
  });

  const raw = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (k: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      update: (v: Record<string, unknown>) => {
        eq: (k: string, val: unknown) => Promise<{ error: { message?: string } | null }>;
      };
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const loadAll = useCallback(async () => {
    const [tRes, sRes, rRes] = await Promise.all([
      raw.from("restaurant_tables").select("*").order("table_number", { ascending: true }).limit(100),
      raw.from("table_sessions").select("*").order("opened_at", { ascending: false }).limit(60),
      raw.from("service_requests").select("*").order("created_at", { ascending: false }).limit(80),
    ]);
    if (!tRes.error && Array.isArray(tRes.data)) setTables(tRes.data as RestaurantTableRow[]);
    if (!sRes.error && Array.isArray(sRes.data)) setSessions(sRes.data as TableSessionRow[]);
    if (!rRes.error && Array.isArray(rRes.data)) setRequests(rRes.data as ServiceRequestRow[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll();
    const channel = supabase
      .channel("admin-floor-ops")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => void loadAll())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const openRequests = requests.filter((r) => r.status === "pending" || r.status === "acknowledged");
  const activeSessions = sessions.filter((s) => s.status === "active");

  const updateRequest = async (id: string, nextStatus: "acknowledged" | "completed") => {
    const { error } = await raw.rpc("update_service_request_status", {
      p_request_id: id,
      p_next_status: nextStatus,
    });
    if (error) {
      toast.error(error.message || "Could not update request");
      return;
    }
    toast.success(`Request ${nextStatus}`);
    void loadAll();
  };

  const createTable = async () => {
    if (!newTable.table_number.trim()) return;
    const { error } = await raw.rpc("create_restaurant_table", {
      p_table_number: newTable.table_number.trim(),
      p_display_name: newTable.display_name.trim() || `Table ${newTable.table_number.trim()}`,
      p_capacity: Number(newTable.capacity) || 4,
      p_area: newTable.area.trim() || "Main Dining",
    });
    if (error) {
      toast.error(error.message || "Could not create table (ensure Phase 4 SQL migration is applied).");
      return;
    }
    setNewTable({ table_number: "", display_name: "", capacity: 4, area: "Main Dining" });
    toast.success("Table & unique QR code created");
    void loadAll();
  };

  const toggleTableActive = async (t: RestaurantTableRow) => {
    const { error } = await raw
      .from("restaurant_tables")
      .update({ active: !t.active, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message || "Could not toggle table");
      return;
    }
    void loadAll();
  };

  const regenerateQr = async (tableId: string) => {
    const { error } = await raw.rpc("regenerate_table_qr_code", { p_table_id: tableId });
    if (error) {
      toast.error(error.message || "Could not rotate QR code");
      return;
    }
    toast.success("New QR code generated and prior active sessions closed");
    void loadAll();
  };

  const closeSession = async (sessionId: string) => {
    const { error } = await raw.rpc("close_table_session", { p_session_id: sessionId });
    if (error) {
      toast.error(error.message || "Could not close session");
      return;
    }
    toast.success("Table session closed");
    void loadAll();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Tables, QR Codes &amp; Waiter Calls</h2>
          <p className="text-xs text-muted-foreground">
            Live floor service requests, active QR table sessions, and printable table QR codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* 1. Live Waiter Service Queue */}
      <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BellRing className="h-4 w-4 text-primary" /> Open Waiter Requests ({openRequests.length})
          </h3>
        </div>
        {openRequests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No unresolved waiter calls right now.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {openRequests.map((req) => {
              const t = tableById.get(req.table_id);
              return (
                <div key={req.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {t?.display_name ?? "Table"} · {getServiceRequestLabel(req.request_type)}
                    </span>
                    <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {req.status}
                    </span>
                  </div>
                  {req.note && <p className="text-xs text-foreground/90">Note: {req.note}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Requested {new Date(req.created_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Windhoek", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="flex gap-2 pt-1">
                    {req.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void updateRequest(req.id, "acknowledged")}
                        className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void updateRequest(req.id, "completed")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-300"
                    >
                      <Check className="h-3.5 w-3.5" /> Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Active Table Sessions */}
      <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Active Table Sessions ({activeSessions.length})</h3>
        {activeSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active QR table sessions currently open.</p>
        ) : (
          <div className="space-y-1.5">
            {activeSessions.map((s) => {
              const t = tableById.get(s.table_id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                  <div>
                    <span className="font-bold text-foreground">{t?.display_name ?? s.table_id.slice(0, 6)}</span>
                    <span className="ml-2 text-muted-foreground">
                      Opened {new Date(s.opened_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Windhoek", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void closeSession(s.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <ShieldOff className="h-3 w-3" /> Close session
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Management: Create & Manage Tables + Printable QR Codes */}
      {isAdmin && (
        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <QrCode className="h-4 w-4 text-primary" /> Restaurant Tables &amp; QR Codes
          </h3>
          <div className="grid gap-2 sm:grid-cols-5">
            <input
              type="text"
              value={newTable.table_number}
              onChange={(e) => setNewTable((v) => ({ ...v, table_number: e.target.value }))}
              placeholder="No. (e.g. T04)"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <input
              type="text"
              value={newTable.display_name}
              onChange={(e) => setNewTable((v) => ({ ...v, display_name: e.target.value }))}
              placeholder="Display name"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <input
              type="text"
              value={newTable.area}
              onChange={(e) => setNewTable((v) => ({ ...v, area: e.target.value }))}
              placeholder="Area (Terrace / Main)"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <input
              type="number"
              min="1"
              max="30"
              value={newTable.capacity}
              onChange={(e) => setNewTable((v) => ({ ...v, capacity: Number(e.target.value) }))}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => void createTable()}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add table
            </button>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{t.display_name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.area} · Seats {t.capacity} · v{t.qr_version}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleTableActive(t)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      t.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.active ? "Active" : "Disabled"}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-primary">{t.table_code}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedQrTable(t)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/40"
                  >
                    <QrCode className="h-3.5 w-3.5" /> View / Print QR
                  </button>
                  <button
                    type="button"
                    onClick={() => void regenerateQr(t.id)}
                    title="Rotate QR code & close prior sessions"
                    className="inline-flex items-center justify-center rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-amber-300 hover:bg-amber-500/10"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedQrTable && (
            <div className="rounded-2xl border border-primary/40 bg-white p-6 text-center text-black max-w-xs mx-auto space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-600">Butcher Block Steakhouse</p>
              <h4 className="text-xl font-extrabold">{selectedQrTable.display_name}</h4>
              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={buildTableQrUrl(selectedQrTable.table_code)}
                  size={180}
                  level="M"
                />
              </div>
              <p className="font-mono text-xs text-neutral-700">{selectedQrTable.table_code}</p>
              <p className="text-xs text-neutral-600">Scan to order from your table or call your waiter</p>
              <div className="flex gap-2 print:hidden pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-black py-2 text-xs font-bold text-white"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Card
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedQrTable(null)}
                  className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
