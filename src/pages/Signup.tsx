import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Mail, Lock, User, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!email || !password || !name) return toast.warning("All fields are required");

    setIsSubmitting(true);
    const success = await signup(email, password, name);
    setIsSubmitting(false);

    if (success) {
      toast.success('Identity Created. Welcome to Vectorix.');
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      {/* Form Section */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 bg-[#020204]">
        <div className="w-full max-w-sm mx-auto space-y-8 animate-in fade-in slide-in-from-left-8 duration-500">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Initialize Identity</h1>
            <p className="text-zinc-400">Create your secure profile to begin.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-zinc-300">Full Name</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-11 bg-[#12121A] border-white/10 text-white focus:border-primary/50 rounded-xl" placeholder="John Doe" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-[#12121A] border-white/10 text-white focus:border-primary/50 rounded-xl" placeholder="name@example.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 bg-[#12121A] border-white/10 text-white focus:border-primary/50 rounded-xl" placeholder="••••••••" />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20">
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Already have an account? <Link to="/login" className="text-white hover:underline font-medium">Log in</Link>
          </p>
        </div>
      </div>

      {/* Artwork Section */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0B0C15] items-center justify-center overflow-hidden border-l border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black" />
        <div className="relative z-10 text-center space-y-4">
           <div className="w-64 h-64 bg-gradient-to-b from-primary/20 to-transparent rounded-full blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
           <h2 className="text-4xl font-bold relative z-10">Join the Network</h2>
        </div>
      </div>
    </div>
  );
}