const SkeletonCard = () => (
  <div className="rounded-lg overflow-hidden">
    <div className="skeleton-shimmer h-40 w-full rounded-lg" />
    <div className="pt-3 space-y-2">
      <div className="skeleton-shimmer h-4 w-3/4 rounded" />
      <div className="skeleton-shimmer h-3 w-1/2 rounded" />
      <div className="skeleton-shimmer h-4 w-1/4 rounded" />
    </div>
  </div>
);

export default SkeletonCard;
