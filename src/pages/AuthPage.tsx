import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Welcome back 👋");
        navigate("/");
      }
    } else {
      if (!name.trim()) {
        toast.error("Please enter your name");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, name);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Account created! Check your email to verify 📧");
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">
        {isLogin ? "Welcome back" : "Join Berrylicious"}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        {isLogin ? "Sign in to your account" : "Create your account to get started"}
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {!isLogin && (
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}
        <div>
          <label className="text-sm text-muted-foreground font-medium mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground font-medium mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-lg hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
        </button>
      </form>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="text-muted-foreground text-sm mt-6 hover:text-foreground transition-colors"
      >
        {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
};

export default AuthPage;
