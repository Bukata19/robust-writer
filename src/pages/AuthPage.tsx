import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Terminal, FileText, Bot } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password, rememberMe);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created! Check your email to confirm.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Terminal className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              RobAssister
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            AI-powered assignment editor
          </p>
        </div>

        {/* Features pills */}
        <div className="flex justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
            <FileText className="w-3 h-3" /> Templates
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
            <Bot className="w-3 h-3" /> AI Tools
          </span>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          {/* Tabs */}
          <div className="flex mb-6 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {isLogin && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-muted accent-primary"
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
      
