import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Cpu, Zap, ShieldCheck, Activity, Terminal, Globe, ChevronRight } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING KERNEL...");
  const [isReady, setIsReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // --- 1. SESSION CHECK ---
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem("vectorix_intro_seen");
    if (hasSeenIntro === "true") {
      navigate("/home", { replace: true });
    } else {
      setCheckingSession(false);
    }
  }, [navigate]);

  // --- 2. BOOT SEQUENCE ---
  useEffect(() => {
    if (checkingSession) return;

    const steps = [
      { pct: 15, text: "ALLOCATING NEURAL BUFFERS" },
      { pct: 35, text: "SYNCHRONIZING VECTORIX AI DB" },
      { pct: 55, text: "CALIBRATING AI LEARNING WEIGHTS" },
      { pct: 75, text: "ENCRYPTING DATA STREAM" },
      { pct: 90, text: "OPTIMIZING AI ENGINE" },
      { pct: 100, text: "AI SYSTEM ONLINE" }
    ];

    let currentStep = 0;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        
        if (currentStep < steps.length - 1 && prev > steps[currentStep + 1].pct) {
          currentStep++;
          setStatusText(steps[currentStep].text);
        }
        return prev + 0.8; 
      });
    }, 30);

    return () => clearInterval(timer);
  }, [checkingSession]);

  const handleEnter = () => {
    sessionStorage.setItem("vectorix_intro_seen", "true");
    navigate("/home"); 
  };

  if (checkingSession) return <div className="h-screen w-full bg-[#050505]" />;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#050505] text-white flex flex-col items-center justify-center font-sans selection:bg-blue-500/30">
      
      {/* --- LAYER 1: CINEMATIC BACKGROUND --- */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#1a1b26_0%,_#000000_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 transform perspective-[1000px] rotate-x-60 scale-150 bottom-[-20%] pointer-events-none" />

      {/* Floating Particles */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-700" />
      </div>

      {/* Scanlines Overlay (Subtler) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_3px,3px_100%] pointer-events-none z-50 opacity-20" />

      {/* --- LAYER 2: HUD ELEMENTS --- */}
      <div className="absolute top-10 left-10 hidden md:flex flex-col gap-2 z-20 opacity-50 font-mono text-[10px] tracking-[0.2em] text-blue-200/60 animate-in slide-in-from-left-4 duration-1000">
        <div className="flex items-center gap-2"><Globe className="w-3 h-3" /> US-EAST-1 // CONNECTED</div>
        <div>MEM_USAGE: 34% // OPTIMAL</div>
      </div>

      <div className="absolute top-10 right-10 hidden md:flex flex-col items-end gap-2 z-20 opacity-50 font-mono text-[10px] tracking-[0.2em] text-blue-200/60 animate-in slide-in-from-right-4 duration-1000">
        <div className="flex items-center gap-2">SECURE_CHANNEL <ShieldCheck className="w-3 h-3 text-emerald-500" /></div>
        <div>VECTORIX_OS v2.0</div>
      </div>

      {/* --- LAYER 3: MAIN CONTENT --- */}
      <div className="relative z-30 flex flex-col items-center justify-center w-full max-w-4xl px-4">
        
        {/* THE CORE: Rotating Reactor */}
        <div className="relative mb-16 group cursor-default scale-110">
          {/* Rings */}
          <div className={`absolute inset-0 rounded-full border border-blue-500/20 transition-all duration-[3s] ease-in-out ${isReady ? "scale-150 opacity-0" : "scale-100 opacity-100"}`} />
          <div className={`absolute inset-0 rounded-full border border-purple-500/20 transition-all duration-[3s] delay-100 ease-in-out ${isReady ? "scale-[2] opacity-0" : "scale-90 opacity-100"}`} />
          
          {/* Central Glow */}
          <div className={`absolute inset-0 bg-blue-500/30 blur-[60px] rounded-full transition-all duration-1000 ${isReady ? "bg-blue-400/40 scale-125" : "scale-75"}`} />

          {/* Icon Box */}
          <div className="relative w-32 h-32 bg-[#0a0a0f] border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_60px_-15px_rgba(59,130,246,0.6)] backdrop-blur-md">
            {isReady ? (
              <Zap className="w-14 h-14 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-in zoom-in duration-300" />
            ) : (
              <Loader2 className="w-14 h-14 text-zinc-500 animate-spin duration-[3s]" />
            )}
          </div>
        </div>

        {/* STATUS TEXT: Clean Transition (No Glitch) */}
        <div className="h-32 text-center space-y-4">
          {isReady ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
                SYSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">READY</span>
              </h1>
              <p className="text-zinc-400 text-sm md:text-base tracking-widest font-medium mt-4 uppercase opacity-70">
                Neural AI Engine Established
              </p>
            </div>
          ) : (
            <div className="space-y-4">
               {/* Fixed Height to prevent jumping */}
               <div className="h-16 flex items-center justify-center">
                 <h1 
                   key={statusText} // Triggers animation on change
                   className="text-3xl md:text-5xl font-bold tracking-tight text-white/90 animate-in fade-in slide-in-from-bottom-2 duration-300"
                 >
                   {statusText}
                 </h1>
               </div>
               
               <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-blue-400/60 uppercase tracking-wider">
                 <Terminal className="w-3 h-3" />
                 Process_ID: {Math.random().toString(36).substring(7)}
               </div>
            </div>
          )}
        </div>

        {/* INTERACTION AREA */}
        <div className="w-full max-w-md h-24 flex items-center justify-center mt-6">
           {!isReady ? (
             <div className="w-72 space-y-3">
               <div className="flex justify-between text-[10px] font-mono text-zinc-500 tracking-wider">
                 <span>PROGRESS</span>
                 <span>{Math.round(progress)}%</span>
               </div>
               {/* High-end Progress Bar */}
               <div className="h-1 w-full bg-[#1a1b26] rounded-full overflow-hidden border border-white/5">
                 <div 
                   className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-white transition-all duration-100 ease-out shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                   style={{ width: `${progress}%` }}
                 />
               </div>
             </div>
           ) : (
             <Button
               onClick={handleEnter}
               className="group relative h-14 px-10 bg-white text-black text-lg font-bold tracking-widest rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] animate-in zoom-in fade-in duration-500"
             >
               <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent z-20" />
               <div className="relative z-10 flex items-center gap-3">
                 <Cpu className="w-5 h-5" />
                 INITIALIZE
                 <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </div>
             </Button>
           )}
        </div>

      </div>

      {/* --- LAYER 4: BOTTOM DECOR --- */}
      <div className="absolute bottom-10 w-full flex justify-between px-12 text-[9px] font-mono text-zinc-600 tracking-[0.3em] uppercase">
        <div>ID: 8X-929-ALPHA</div>
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> Stable</span>
          <span>Encrypted</span>
        </div>
      </div>

    </div>
  );
}