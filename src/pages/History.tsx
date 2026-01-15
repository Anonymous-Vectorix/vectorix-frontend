import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Clock, Search, Trash2, FileText, CheckCircle2, Calendar, Filter, Activity, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || "https://wellington-required-provides-tiffany.trycloudflare.com";

interface HistoryItem {
  id: string;
  filename: string;
  type: string;
  date: string;
  status: string;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 3. RE-FETCH WHEN USER CHANGES
  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]); // Reset logic: No user = No history
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/history`, {
        // 4. SEND USER ID IN HEADERS
        headers: {
          'X-User-Id': user?.email || 'default_user'
        }
      });
      if (res.ok) setHistory(await res.json());
    } catch (e) {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/history/${id}`, { 
        method: "DELETE",
        // 5. SECURE DELETE
        headers: {
          'X-User-Id': user?.email || 'default_user'
        }
      });
      setHistory(history.filter(h => h.id !== id));
      toast.success("Removed from history");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const filteredHistory = history.filter(item => 
    item.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="relative min-h-[90vh] px-4 py-12 md:px-12 max-w-6xl mx-auto overflow-hidden">
        
        {/* === SYSTEM UPDATE POPUP (Standard Backdrop) === */}
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-500">
            <div className="relative w-full max-w-md p-1 rounded-[32px] bg-gradient-to-b from-white/10 to-white/5 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-black/90 rounded-[30px] m-[1px]" />
                <div className="relative z-10 p-8 md:p-10 text-center flex flex-col items-center gap-6">
                    
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-[#151720] border border-white/5 flex items-center justify-center shadow-inner">
                        <Activity className="w-8 h-8 text-zinc-500" />
                    </div>

                    {/* Text */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white tracking-tight">System Update</h2>
                        <p className="text-sm text-zinc-400 font-medium">
                            The <span className="text-white">Activity History</span> module is currently under development with the new Neural Engine v3.0 architecture.
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full space-y-2">
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[72%] shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                            <span>Migration Status</span>
                            <span>72%</span>
                        </div>
                    </div>

                    {/* Action */}
                    <Button 
                        onClick={() => navigate('/')}
                        variant="outline" 
                        className="h-12 px-8 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-zinc-300 transition-all w-full mt-2"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
                    </Button>
                </div>
            </div>
        </div>

        {/* Background Ambience */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
           <div className="absolute top-[-20%] right-[10%] w-[700px] h-[700px] bg-purple-600/10 blur-[150px] rounded-full mix-blend-screen" />
           <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen" />
        </div>

        {/* 💎 FIX: Removed 'filter blur-sm', 'opacity', 'pointer-events-none' */}
        {/* The content now looks crisp and normal behind the backdrop */}
        <div className="relative z-10 space-y-10">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
                <Activity className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Activity Log</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                Recent <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">History</span>
              </h1>
              <p className="text-zinc-400 max-w-lg text-lg">
                A timeline of your uploaded documents, generated tests, and AI sessions.
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group w-full md:w-80">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-2xl blur opacity-20 group-focus-within:opacity-100 transition duration-500" />
                <div className="relative flex items-center bg-[#0f1016] border border-white/10 rounded-2xl shadow-xl">
                  <Search className="absolute left-4 h-5 w-5 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                  <Input 
                    placeholder="Search logs..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-14 pl-12 bg-transparent border-none text-white placeholder:text-zinc-600 focus-visible:ring-0 text-base" 
                  />
                </div>
              </div>
              <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-white/10 bg-[#0f1016] hover:bg-white/5 hover:text-white shadow-lg">
                <Filter className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* List Content */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <p className="text-zinc-500 animate-pulse">Retrieving records...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center rounded-[32px] border border-dashed border-white/5 bg-white/[0.02]">
                <div className="h-24 w-24 rounded-full bg-[#181820] flex items-center justify-center mb-6 ring-1 ring-white/5">
                  <Clock className="h-10 w-10 text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  {user ? "No history found" : "Please log in"}
                </h3>
                <p className="text-zinc-500 mt-2 max-w-sm">
                  {user ? "Documents you upload or interact with will appear here." : "Access your secure timeline."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {filteredHistory.map((item) => (
                  <div 
                    key={item.id} 
                    className="group relative flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-[#181820]/40 hover:bg-[#181820] hover:border-white/10 hover:shadow-lg hover:shadow-black/50 transition-all duration-300"
                  >
                    {/* Hover Highlight */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-blue-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Left: Icon & Info */}
                    <div className="flex items-center gap-6 overflow-hidden pl-2">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center shrink-0 border border-white/5 group-hover:scale-105 transition-transform">
                        <FileText className="h-6 w-6 text-blue-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="min-w-0 flex flex-col gap-1.5">
                        <p className="font-bold text-white text-lg truncate group-hover:text-blue-200 transition-colors">{item.filename}</p>
                        <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 uppercase tracking-wider text-[10px]">
                            {item.type}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" /> {item.date}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Status & Actions */}
                    <div className="flex items-center gap-6 pl-4">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)] uppercase tracking-wide">
                          <CheckCircle2 className="h-3 w-3" /> {item.status}
                        </span>
                      </div>
                      
                      <div className="h-8 w-[1px] bg-white/5 hidden sm:block" />

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(item.id)} 
                        className="h-10 w-10 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}