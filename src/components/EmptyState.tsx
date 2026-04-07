import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon?: string;
  message: string;
  actionLabel?: string;
  actionTo?: string;
}

const EmptyState = ({ icon = "🍽️", message, actionLabel, actionTo }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
    <span className="text-5xl mb-4">{icon}</span>
    <p className="text-muted-foreground text-lg mb-6">{message}</p>
    {actionLabel && actionTo && (
      <Link
        to={actionTo}
        className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        {actionLabel}
      </Link>
    )}
  </div>
);

export default EmptyState;
