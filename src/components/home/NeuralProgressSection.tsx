import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
  Activity, Zap, AlertTriangle, TrendingUp,
  MonitorPlay, Layers,
  Calendar, CheckCircle2, BrainCircuit,
  Server,
  Youtube, MessageSquare, ScanFace, Focus, EyeOff, Waves,
  Hourglass, Fingerprint, ShieldCheck, BatteryWarning, Flame,
  Skull, Ghost, Crown, Anchor, MousePointerClick
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ✅ CRITICAL: Backend Connection Preserved
import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

interface ConceptData {
  id: string;
  name: string;
  score: number;
  status: "mastered" | "review" | "critical";
  source: string;
  insight: string; 
  last_updated: string;
  distraction_level?: string;
  flow_status?: string;       
  focus_type?: string;
  diagnosis?: string; 
}

interface CognitiveProfile {
  currentpersona: string;
  assimilation_rate: number;
  neural_focus: number;
  schedule_velocity: string;
  concepts: ConceptData[];
  predicted_quit_min: number; 
  current_persona: string;
  active_strategy: string;
  recommendedsessionlen?: number;
}

// Helper to define Persona Visuals
const getPersonaConfig = (type: string) => {
    const p = type.toLowerCase();
    
    // RED (Critical)
    if (p.includes("tiktok")) return { color: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10", icon: MousePointerClick, priority: 1 };
    if (p.includes("dopamine")) return { color: "text-rose-500", border: "border-rose-500/30", bg: "bg-rose-500/10", icon: Skull, priority: 1 };
    if (p.includes("distracted")) return { color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10", icon: EyeOff, priority: 2 };
    
    // YELLOW/BLUE (Mid)
    if (p.includes("drifter")) return { color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10", icon: Ghost, priority: 3 };
    if (p.includes("unproven")) return { color: "text-zinc-400", border: "border-zinc-500/30", bg: "bg-zinc-500/10", icon: ScanFace, priority: 4 };
    if (p.includes("grinder")) return { color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10", icon: Zap, priority: 3 };

    // GREEN (Elite)
    if (p.includes("deep diver")) return { color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", icon: Anchor, priority: 5 };
    if (p.includes("grandmaster")) return { color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", icon: Crown, priority: 5 };

    return { color: "text-zinc-400", border: "border-zinc-500/30", bg: "bg-zinc-500/10", icon: ScanFace, priority: 10 };
};

export function NeuralProgressSection() {
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<CognitiveProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState(12);

  // --- 🧠 1. INSIGHT MAPPING ENGINE ---
  const getInsightConfig = (insight: string = "", diagnosis?: string) => {
    if (diagnosis === "Deep Work") return {
        label: "DEEP WORK", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Focus,
        text: "High engagement zone. Maintain momentum."
    };
    if (diagnosis === "Good Work") return {
        label: "GOOD WORK", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: CheckCircle2,
        text: "Solid performance. Keep pushing."
    };
    if (diagnosis === "Low Work") return {
        label: "LOW WORK", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: AlertTriangle,
        text: "Engagement check required."
    };
    return {
        label: "MONITORING", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: BrainCircuit,
        text: "Analyzing behavioral baseline..."
    };
  };

  const getScoreColor = (score: number) => {
    if (score < 40) return "text-rose-500";     
    if (score >= 40 && score < 75) return "text-amber-400"; 
    return "text-emerald-400";                  
  };

  const getBarColor = (score: number) => {
    if (score < 40) return "bg-rose-500 shadow-[0_0_10px_#f43f5e]";
    if (score >= 40 && score < 75) return "bg-amber-500 shadow-[0_0_10px_#f59e0b]";
    return "bg-emerald-500 shadow-[0_0_10px_#10b981]";
  };

  // --- 🧠 2. MULTI-PERSONA LOGIC ---
  const getActivePersonas = () => {
    const personas = [];
    const concepts = profile?.concepts || [];
    
    // BASELINE STATS
    const recent = concepts.slice(0, 10);
    const avgScore = recent.length ? recent.reduce((a,b) => a + b.score, 0) / recent.length : 0;
    const distractedCount = recent.filter(s => s.distraction_level === "High" || s.diagnosis === "Low Work").length;
    const distractionRatio = recent.length ? distractedCount / recent.length : 0;
    const avgDuration = profile?.recommendedsessionlen || 30;
    const totalSessions = concepts.length;

    // 1. DURATION CONDITION -> "The TikTok Brain"
    if (avgDuration < 15 && totalSessions > 2) {
        personas.push({
            name: "The TikTok Brain",
            condition: "Attention Span Critical",
            metric: `${Math.round(avgDuration)}m Avg Session`,
            ...getPersonaConfig("tiktok")
        });
    }

    // 2. DISTRACTION CONDITION -> "The Dopamine Junkie"
    if (distractionRatio > 0.3) {
        personas.push({
            name: "The Dopamine Junkie",
            condition: "High Distraction Rate",
            metric: `${Math.round(distractionRatio * 100)}% Distracted`,
            ...getPersonaConfig("dopamine")
        });
    }

    // 3. SCORE CONDITION -> "The Distracted One" (Low Score)
    if (avgScore < 50 && totalSessions > 2) {
        personas.push({
            name: "The Distracted One",
            condition: "Low Concept Retention",
            metric: `${Math.round(avgScore)}% Avg Score`,
            ...getPersonaConfig("distracted")
        });
    }

    // 4. SESSION COUNT CONDITION -> "The Unproven"
    if (totalSessions < 5) {
        personas.push({
            name: "The Unproven",
            condition: "Insufficient Data Points",
            metric: `${totalSessions} Sessions`,
            ...getPersonaConfig("unproven")
        });
    }

    // 5. CONSISTENCY CONDITION -> "The Grinder"
    if (avgScore >= 70 && totalSessions > 5) {
        personas.push({
            name: "The Grinder",
            condition: "Consistent Effort",
            metric: "Solid Growth",
            ...getPersonaConfig("grinder")
        });
    }

    // 6. DEEP WORK CONDITION -> "The Deep Diver"
    if (avgDuration > 45 && avgScore > 80) {
        personas.push({
            name: "The Deep Diver",
            condition: "Flow State Master",
            metric: "Deep Focus",
            ...getPersonaConfig("deep diver")
        });
    }

    // Fallback if array empty
    if (personas.length === 0) {
        personas.push({
            name: "Calibrating...",
            condition: "Gathering telemetry",
            metric: "---",
            ...getPersonaConfig("unproven")
        });
    }

    // Sort by Priority (Critical/Red first)
    return personas.sort((a, b) => a.priority - b.priority);
  };

  // --- 🧠 3. TEMPORAL STATE LOGIC ---
  const getNeuralState = (quitMin: number, focus: number, latestDiagnosis?: string, latestScore?: number) => {
    if (quitMin <= 5) return { 
      label: "CRITICAL FATIGUE", color: "text-rose-500", bg: "from-rose-500/20", border: "border-rose-500/30", icon: BatteryWarning,
      desc: "Cognitive reserves depleted. Rest required immediately."
    };

    if (latestDiagnosis === "Low Work" || (latestScore !== undefined && latestScore < 35)) return {
       label: "ENGAGEMENT DROP", color: "text-rose-400", bg: "from-rose-500/20", border: "border-rose-500/30", icon: AlertTriangle,
       desc: "Performance below baseline. Reset focus and try again."
    };

    if (quitMin <= 15 || focus < 45) return { 
      label: "DIMINISHING RETURNS", color: "text-amber-500", bg: "from-amber-500/20", border: "border-amber-500/30", icon: TrendingUp,
      desc: "Focus integrity degrading. Wrap up current module."
    };

    if (focus > 85) return { 
      label: "SYNAPTIC FLOW", color: "text-blue-400", bg: "from-blue-500/20", border: "border-blue-500/30", icon: Zap,
      desc: "Maximum plasticity. Do not interrupt."
    };

    return { 
      label: "STABLE", color: "text-emerald-400", bg: "from-emerald-500/20", border: "border-emerald-500/30", icon: ShieldCheck,
      desc: "Behavioral baseline nominal. Continue."
    };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/tutor/neural/profile`);
        if (!res.ok) throw new Error("Connection failed");
        const data = await res.json();
        setProfile(data);
      } catch (e) {
        console.error("Neural Engine Sync Error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    const interval = setInterval(fetchProfile, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      setPing(Math.floor(Math.random() * (45 - 12 + 1)) + 12);
    }, 2000);
    return () => clearInterval(pingInterval);
  }, []);

  // --- CALCULATION HOOKS ---
  const activePersonas = getActivePersonas();
  const dominantPersona = activePersonas[0]; // The most critical one for the HUD

  const latestConcept = profile?.concepts?.length 
    ? [...profile.concepts].sort((a,b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())[0] 
    : null;
    
  const activeConfig = getInsightConfig(latestConcept?.insight || "", latestConcept?.diagnosis);
  const neuralState = getNeuralState(
      profile?.predicted_quit_min || 30, 
      profile?.neural_focus || 100,
      latestConcept?.diagnosis,
      latestConcept?.score
  );
  const isUrgent = (profile?.predicted_quit_min || 30) <= 5;

  if (loading) {
    return (
      <Layout>
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent">
          <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
             <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-t border-l border-emerald-500/20 animate-[spin_1s_linear_infinite]" />
                <div className="absolute inset-3 rounded-full border-b border-r border-blue-500/40 animate-[spin_1.5s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <BrainCircuit className="w-8 h-8 text-white/80 animate-pulse" />
                </div>
             </div>
             <p className="text-[10px] font-bold text-white/50 tracking-[0.4em] uppercase animate-pulse">Connecting to Cortex...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative w-full min-h-screen p-6 md:p-12 font-sans overflow-x-hidden text-white bg-transparent">
        
        <div className="relative z-10 max-w-[1600px] mx-auto flex flex-col gap-12">
          
          {/* --- TOP HUD BAR --- */}
          <div className="w-full bg-[#0A0A0A]/60 backdrop-blur-3xl border border-white/10 rounded-[30px] p-6 flex flex-col xl:flex-row items-center justify-between gap-8 shadow-2xl group/hud transition-all duration-700">
            {/* Identity (Shows Dominant/Most Urgent Persona) */}
            <div className="flex items-center gap-8 w-full xl:w-auto">
               <div className="relative h-16 w-16 flex items-center justify-center">
                  <div className={`absolute inset-0 bg-gradient-to-tr ${isUrgent ? 'from-rose-500/20 to-amber-500/20' : 'from-blue-500/20 to-emerald-500/20'} rounded-2xl blur-xl group-hover/hud:blur-2xl transition-all`} />
                  <div className="relative h-full w-full rounded-2xl bg-[#0F111A] border border-white/10 flex items-center justify-center shadow-lg">
                    <ScanFace className={`w-8 h-8 ${isUrgent ? 'text-rose-400 animate-pulse' : 'text-white'}`} />
                  </div>
               </div>
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <span className="flex h-1.5 w-1.5 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dominantPersona.priority <= 2 ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dominantPersona.priority <= 2 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                     </span>
                     <span className={`text-[9px] font-bold uppercase tracking-[0.4em] ${dominantPersona.color}`}>
                        {dominantPersona.name}
                     </span>
                  </div>
                  <h1 className="text-3xl font-light text-white tracking-tight">
                    Cognitive <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 drop-shadow-sm">Telemetry</span>
                  </h1>
               </div>
            </div>

            {/* Metrics */}
            <div className="flex gap-4 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
               {[
                 { label: "Retention Rate", val: profile?.assimilation_rate, unit: "%", icon: Layers, color: getScoreColor(profile?.assimilation_rate || 0) },
                 { label: "Cognitive Load", val: profile?.neural_focus, unit: "%", icon: BrainCircuit, color: (profile?.neural_focus || 0) > 60 ? "text-emerald-400" : "text-amber-400" },
                 { label: "Mental Battery", val: profile?.predicted_quit_min || "--", unit: "min", icon: isUrgent ? Hourglass : Flame, color: isUrgent ? "text-rose-400 animate-pulse" : "text-blue-400" },
               ].map((stat, i) => (
                 <div key={i} className={`flex-1 min-w-[160px] h-28 rounded-2xl bg-[#0F111A]/50 border ${isUrgent && stat.label === 'Mental Battery' ? 'border-rose-500/30 bg-rose-900/10' : 'border-white/5'} hover:border-white/10 transition-all flex flex-col justify-between p-5 relative overflow-hidden group hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]`}>
                    <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start">
                       <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                       <stat.icon className={`w-3.5 h-3.5 ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                    </div>
                    <span className={`text-4xl font-light tracking-tighter ${stat.label === 'Mental Battery' && isUrgent ? 'text-rose-400' : 'text-white'}`}>
                       {stat.val}<span className="text-sm font-normal text-zinc-600 ml-1">{stat.unit}</span>
                    </span>
                 </div>
               ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_420px] gap-8">
            
            {/* --- LEFT: MEMORY STREAM --- */}
            <div className="bg-[#0A0A0A]/60 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 flex flex-col relative shadow-2xl overflow-hidden min-h-[400px]">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-blue-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />
                <div className="flex items-center justify-between mb-10 relative z-10">
                   <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-3 uppercase tracking-wider">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5"><Activity className="w-4 h-4 text-blue-400" /></div>
                      Performance Insights
                   </h3>
                </div>
                <div className="flex-1 relative overflow-y-auto custom-scrollbar -mr-2 pr-2 space-y-4 z-10">
                   {(!profile?.concepts || profile.concepts.length === 0) && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center opacity-70">
                        <h2 className="text-xl font-light text-white tracking-[0.2em] uppercase mt-4">Awaiting Signal...</h2>
                     </div>
                   )}
                   {(profile?.concepts || []).sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()).map((concept) => {
                        const config = getInsightConfig(concept.insight, concept.diagnosis);
                        return (
                        <div key={concept.id} className="group relative w-full rounded-2xl transition-all duration-500 hover:translate-x-1">
                            <div className={`relative border rounded-2xl p-6 flex flex-col gap-6 transition-all bg-[#0F111A]/50 hover:bg-[#0F111A]/80 border-white/5 hover:border-white/10 shadow-lg`}>
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 overflow-hidden">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border backdrop-blur-md transition-all ${concept.source === 'test' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : concept.source === 'tutor' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-800/50 border-white/10 text-zinc-400'}`}>
                                            {concept.source === 'tutor' ? <MessageSquare className="w-5 h-5" /> : concept.source === 'test' ? <CheckCircle2 className="w-5 h-5" /> : concept.source === 'study_plan' ? <MonitorPlay className="w-5 h-5" /> : concept.source === 'url' ? <Youtube className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <h4 className="text-white font-bold text-lg truncate group-hover:text-blue-200 transition-colors tracking-tight">{concept.name}</h4>
                                            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">{concept.id.slice(0,8)}... <span className="w-1 h-1 rounded-full bg-zinc-700"/> {new Date(concept.last_updated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 pl-4 border-l border-white/5">
                                        <div className="text-right">
                                            <span className={`block text-3xl font-black ${getScoreColor(concept.score)}`}>{concept.score}</span>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Momentum Score</span>
                                        </div>
                                        <div className={`w-1.5 h-10 rounded-full bg-white/5 overflow-hidden`}>
                                            <div className={`w-full rounded-full transition-all duration-1000 ${getBarColor(concept.score)}`} style={{ height: `${concept.score}%`, marginTop: `${100 - concept.score}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                                    <div className={`p-3 rounded-xl border flex items-center gap-3 bg-white/[0.02] border-white/5`}>
                                        <EyeOff className="w-4 h-4 text-zinc-500" />
                                        <div>
                                            <span className="block text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Distraction</span>
                                            <span className="block text-xs font-bold text-zinc-300">{concept.distraction_level}</span>
                                        </div>
                                    </div>
                                    <div className={`p-3 rounded-xl border flex items-center gap-3 bg-white/[0.02] border-white/5`}>
                                        <Waves className="w-4 h-4 text-zinc-500" />
                                        <div>
                                            <span className="block text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Flow State</span>
                                            <span className="block text-xs font-bold text-zinc-300">{concept.flow_status}</span>
                                        </div>
                                    </div>
                                    <div className={`p-3 rounded-xl border flex items-center gap-3 ${config.bg} ${config.border}`}>
                                        <div className={config.color}>{(() => { const Icon = config.icon; return <Icon className="w-4 h-4" />; })()}</div>
                                        <div>
                                            <span className={`block text-[9px] uppercase tracking-wider font-bold opacity-60 ${config.color}`}>Diagnosis</span>
                                            <span className={`block text-xs font-bold ${config.color}`}>{config.label}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                     )})}
                </div>
            </div>

            {/* --- RIGHT: COMMAND CENTER --- */}
            <div className="flex flex-col gap-6">
              
              {/* 1. NEURAL STATE & TRENDS */}
              <div className={`relative overflow-hidden rounded-[32px] p-[1px] bg-gradient-to-b ${neuralState.bg} to-transparent transition-colors duration-500`}>
                 <div className={`bg-[#0A0A0A]/80 backdrop-blur-xl rounded-[31px] p-8 h-full relative overflow-hidden border ${neuralState.border} transition-all shadow-lg`}>
                    <div className="flex items-center justify-between mb-8">
                       <h3 className={`text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${neuralState.color}`}>
                         <neuralState.icon className="w-4 h-4" />
                         {neuralState.label}
                       </h3>
                       {isUrgent && <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping"/>}
                    </div>
                    <div className="space-y-4">
                       <p className="text-3xl font-light text-white leading-tight">{neuralState.desc.split('.')[0]}.</p>
                       <p className="text-xs text-zinc-400 leading-relaxed font-mono">{neuralState.desc.split('.')[1] || ""}</p>
                       <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                           <div className="flex items-center justify-between">
                               <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Live Optimization</span>
                               <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-mono">{profile?.active_strategy || "Adaptive"}</span>
                           </div>
                           <div className={`p-4 rounded-xl border border-white/5 bg-white/[0.02] flex gap-3 items-start`}>
                               <div className={`mt-0.5 ${activeConfig.color}`}><activeConfig.icon className="w-4 h-4" /></div>
                               <div>
                                   <span className={`block text-[10px] font-bold uppercase tracking-wide mb-1 ${activeConfig.color}`}>{activeConfig.label}</span>
                                   <p className="text-xs text-zinc-400 leading-relaxed">{latestConcept?.insight || "Waiting for session data..."}</p>
                               </div>
                           </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* 2. IDENTITY CARD - EXPANDING, NO SCROLL, NO BUTTON */}
              <div className="backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 flex flex-col shadow-lg relative bg-[#0A0A0A]/60 h-fit">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                    <Fingerprint className="w-4 h-4 text-white/40" /> Active Archetypes
                 </h3>

                 {/* No max-height, no overflow, just a natural stack */}
                 <div className="space-y-3">
                    {activePersonas.map((persona, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border bg-[#0F111A]/50 flex items-start gap-4 transition-all hover:translate-x-1 ${persona.border}`}>
                            <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center border border-white/5 ${persona.bg}`}>
                                <persona.icon className={`w-5 h-5 ${persona.color}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`text-sm font-bold ${persona.color}`}>{persona.name}</h4>
                                    {idx === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 uppercase tracking-wider">Dominant</span>}
                                </div>
                                <p className="text-[10px] text-zinc-400 font-mono mb-1">{persona.condition}</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-1 w-1 rounded-full bg-white/20"/>
                                    <span className="text-xs text-white font-bold">{persona.metric}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
              </div>

              {/* 3. METADATA FOOTER */}
              <div className="text-center py-2">
                 <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] flex items-center justify-center gap-4">
                    <Server className="w-3 h-3" /> 
                    <span>Nodes: {profile?.concepts?.length || 0}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="tabular-nums">Ping: {ping}ms</span>
                 </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}