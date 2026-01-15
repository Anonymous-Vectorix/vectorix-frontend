import { Layout } from '@/components/layout/Layout';
import { Search, Sparkles, Activity, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function LibraryPage() {
  return (
    <Layout>
      <div className="relative min-h-[90vh] w-full font-sans overflow-hidden">
        
        {/* === 💎 SYSTEM UPDATE POPUP (Backdrop Overlay) === */}
        {/* Standard overlay pattern: z-50 on top of everything, semi-transparent bg */}
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
           <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4">
               <div className="bg-[#09090B] border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden text-center ring-1 ring-white/5 backdrop-blur-xl">
                  
                  {/* Subtle Grid Pattern on Card */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                  {/* Icon Container */}
                  <div className="relative mx-auto w-16 h-16 bg-[#18181B] rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-inner z-10">
                     <Activity className="w-7 h-7 text-blue-500 opacity-80" />
                  </div>

                  {/* Title & Description */}
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">System Update</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                      The <strong className="text-zinc-200">Library</strong> module is currently under development with the new Neural Engine v3.0 architecture.
                    </p>
                  </div>

                  {/* Migration Progress */}
                  <div className="relative z-10 space-y-3 mb-8 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                     <div className="w-full h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 w-[72%] rounded-full shadow-[0_0_12px_rgba(37,99,235,0.6)] animate-pulse" />
                     </div>
                     <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Migration Status</span>
                        <span className="text-[10px] font-bold text-zinc-500 font-mono">72%</span>
                     </div>
                  </div>

                  {/* Action Button */}
                  <Link to="/home" className="relative z-10 block">
                     <Button className="w-full h-12 bg-[#18181B] hover:bg-[#27272A] text-zinc-200 hover:text-white border border-white/5 rounded-xl font-medium transition-all duration-300 group shadow-lg">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform text-zinc-500 group-hover:text-zinc-300" /> 
                        Return to Dashboard
                     </Button>
                  </Link>

               </div>
            </div>
        </div>

        {/* --- MAIN CONTENT (Clean & Crisp) --- */}
        <div className="relative min-h-[90vh] px-4 py-12 md:px-12 max-w-7xl mx-auto flex flex-col gap-12">
           
           {/* Background Blobs */}
           <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
              <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/20 blur-[150px] rounded-full mix-blend-screen" />
              <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen" />
           </div>

           {/* Header Section */}
           <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
             <div className="space-y-4">
               <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
                 <Sparkles className="h-3.5 w-3.5 text-primary" />
                 <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Neural Vault</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                 Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Library</span>
               </h1>
               <p className="text-zinc-400 max-w-lg text-lg">
                 Manage your saved lectures, generated notes, and archived study materials.
               </p>
             </div>

             {/* Search Bar */}
             <div className="relative w-full md:w-96">
               <div className="relative flex items-center bg-[#0f1016] border border-white/10 rounded-2xl shadow-xl">
                 <Search className="absolute left-4 h-5 w-5 text-zinc-500" />
                 <Input 
                   placeholder="Search library..." 
                   className="h-14 pl-12 bg-transparent border-none text-white placeholder:text-zinc-600 text-base" 
                   disabled
                 />
               </div>
             </div>
           </div>

           {/* Placeholder Grid */}
           <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-50">
              <div className="h-64 rounded-3xl bg-white/5 border border-white/5" />
              <div className="h-64 rounded-3xl bg-white/5 border border-white/5" />
              <div className="h-64 rounded-3xl bg-white/5 border border-white/5" />
           </div>
        </div>

      </div>
    </Layout>
  );
}