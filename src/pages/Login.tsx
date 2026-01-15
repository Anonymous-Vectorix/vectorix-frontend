import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!email || !password) return toast.warning("Please fill in all fields");

    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);

    if (success) {
      toast.success('Welcome back to Vectorix!');
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      {/* Left Artwork */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0B0C15] items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.8))]" />
        <div className="relative z-10 p-12 text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-primary/10 mb-4 animate-pulse">
             <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 blur-md" />
          </div>
          <h2 className="text-5xl font-bold tracking-tighter text-white">Vectorix AI</h2>
          <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
            The neural operating system for your learning journey.
          </p>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 bg-[#020204]">
        <div className="w-full max-w-sm mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="text-zinc-400">Enter your credentials to access the Neural Engine.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-zinc-300">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-[#12121A] border-white/10 text-white focus:border-primary/50 rounded-xl" 
                  placeholder="name@example.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">Password</Label>
                <Link to="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-[#12121A] border-white/10 text-white focus:border-primary/50 rounded-xl" 
                  placeholder="••••••••" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-500 hover:text-white">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-transform active:scale-95">
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Don't have an account? <Link to="/signup" className="text-white hover:underline font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}