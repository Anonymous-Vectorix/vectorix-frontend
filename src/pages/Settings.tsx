import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Trash2, Database, User, Save, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_BASE || "https://wellington-required-provides-tiffany.trycloudflare.com";

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const [clearing, setClearing] = useState(false);
  
  // Local state for form
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");

  const handleSaveProfile = async () => {
    if (!name.trim()) return toast.error("Name cannot be empty");
    
    await updateProfile({ name, ...(password ? { password } : {}) }); // Only send password if changed
    setPassword(""); // Clear password field
  };

  const handleClearMemory = async () => {
    if (!confirm("Are you sure? This will wipe all uploaded documents from the AI's short-term memory.")) return;
    
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/tutor/neural/reset`, { method: "POST" });
      if (res.ok) toast.success("AI Memory Wiped Successfully");
      else throw new Error("Failed");
    } catch (e) {
      toast.error("Could not clear memory.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Layout>
      <div className="relative min-h-[90vh] px-6 py-10 md:px-12 max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl">
              <SettingsIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">Settings</h1>
              <p className="text-zinc-400 mt-1">Manage your Vectorix identity.</p>
            </div>
          </div>
          <Button onClick={logout} variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="grid gap-8">
          
          {/* Section: Profile */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Identity</h2>
            </div>
            
            <Card className="rounded-3xl border border-white/5 bg-[#12121A]/60 p-8 space-y-6">
               <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label>Display Name</Label>
                   <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-black/20 border-white/10" />
                 </div>
                 <div className="space-y-2">
                   <Label>Update Password</Label>
                   <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" className="bg-black/20 border-white/10" />
                 </div>
               </div>
               <div className="flex justify-end">
                 <Button onClick={handleSaveProfile} className="bg-white text-black hover:bg-zinc-200 font-bold rounded-xl">
                   <Save className="w-4 h-4 mr-2" /> Save Changes
                 </Button>
               </div>
            </Card>
          </section>

          {/* Section: Data */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Database className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Danger Zone</h2>
            </div>
            
            <Card className="rounded-3xl border border-red-500/10 bg-red-500/5 p-8 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg">Format Vectorix Memory</h3>
                  <p className="text-zinc-400 text-sm mt-1">Irreversibly wipes all learning data.</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleClearMemory} 
                  disabled={clearing}
                  className="rounded-xl font-semibold shadow-lg hover:shadow-red-500/20"
                >
                  {clearing ? "Wiping..." : <><Trash2 className="h-4 w-4 mr-2" /> Wipe Data</>}
                </Button>
            </Card>
          </section>

        </div>
      </div>
    </Layout>
  );
}