import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RestaurantChatPanel } from "@/components/RestaurantChatPanel";

const MessagesPage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: "/messages" }} />;
  }

  return (
    <div className="min-h-screen pb-safe-nav flex flex-col max-w-lg mx-auto bg-background">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-gradient-to-r from-primary/10 via-background to-background backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            to="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-foreground">Messages</h1>
              <p className="truncate text-xs text-muted-foreground">Same chat as the bubble on home — plans and team replies</p>
            </div>
          </div>
        </div>
      </header>

      <RestaurantChatPanel active realtimeScope="messages-page" className="min-h-[calc(100dvh-5.5rem)]" />
    </div>
  );
};

export default MessagesPage;
