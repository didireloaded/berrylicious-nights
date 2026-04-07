/** Lightweight route fallback — keeps first paint small on slow mobile networks */
const PageLoader = () => (
  <div
    className="min-h-[60dvh] flex flex-col items-center justify-center gap-3 px-6"
    aria-busy="true"
    aria-label="Loading"
  >
    <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <p className="text-muted-foreground text-sm">Loading…</p>
  </div>
);

export default PageLoader;
