import { useState, useEffect, useRef, useCallback } from 'react';
import { useVectorixStore, type VideoSegment, type LecturePlan } from "@/contexts/VectorixStore"; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Upload, Link as LinkIcon, FileVideo, 
  Clock, Loader2, Timer, AlertCircle, Zap, CheckCircle2,
  RefreshCw, ChevronRight, Layers, Wand2, Sparkles, Youtube, BookOpen, GraduationCap,
  Trophy,
  Construction
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { NeuralLogger } from "@/lib/neural-logger"; 
import { tracker } from "@/lib/BehavioralTracker"; 
import { QuizSetupModal, type QuizConfig } from "@/components/shared/QuizSetupModal";
import { cn } from "@/lib/utils";

// 💎 Dynamic Base URL
import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// 🧠 NEURAL ENGINE CONFIGURATION
const NEURAL_ENDPOINT = `${API_BASE}/tutor/neural/log`;
const IDLE_THRESHOLD_MS = 20000; // 20s for planning view (more time allowed for reading)

// --- HELPER: Combine summaries for the Final Exam ---
const getAggregatedSummaries = (plan: LecturePlan): string => {
  return plan.segments.map(s => 
    `Chapter: ${s.title}\nSummary: ${s.summary}\nKey Concepts: ${s.importance === 'high' ? 'Critical' : 'Standard'}`
  ).join("\n\n");
};

export function StudyPlanSection() {
  const navigate = useNavigate();
  
  // --- GLOBAL STORE ---
  const { 
    plan, setPlan,
    videoFile, setVideoFile,
    videoUrl, setVideoUrl,
    inputType, setInputType,
    mode, setMode,
    setSystemInstruction,
    setActiveContext,
    
    // 💎 FIX: Use Global State for Synchronization
    completedSegmentIds,
    markSegmentAsCompleted,
    setCompletedSegmentIds,
    
    // 50:50 Protocol State
    isExamComplete, 
    resetStudyPlan 
  } = useVectorixStore();

  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'config' | 'plan'>('config');
  const [showQuizModal, setShowQuizModal] = useState(false);

  // 🧠 NEURAL STATE
  const planSessionId = useRef<string>(`plan_${Date.now()}`);
  const sessionStartTime = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedIdleRef = useRef<boolean>(false);

  // 🧠 NEURAL TELEMETRY SENDER (Fire-and-Forget)
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    // Only log if we have a plan context or are in setup
    const topic = plan?.video_title || "Setup Phase";
    
    const payload = {
      source: "study_plan",
      topic: topic,
      event_type: eventType,
      timestamp: Date.now() / 1000,
      session_id: planSessionId.current,
      metadata: {
        ...metadata,
        view_mode: view
      }
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(err => console.debug("[Neural] Telemetry drop:", err));
  }, [plan, view]);

  // 🧠 LIFECYCLE & IDLE TRACKING (Active only in Plan View)
  useEffect(() => {
    if (view !== 'plan') return;

    // Log Session Start
    sendNeuralSignal("session_start", { 
        total_modules: plan?.segments.length,
        completed_modules: completedSegmentIds.size 
    });
    sessionStartTime.current = Date.now();

    const resetIdleTimer = () => {
      lastInteractionRef.current = Date.now();
      hasLoggedIdleRef.current = false;
      
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        if (!hasLoggedIdleRef.current) {
          // Log IDLE (Procrastination Detection)
          sendNeuralSignal("idle", { duration_ms: IDLE_THRESHOLD_MS, context: "planning_paralysis" });
          hasLoggedIdleRef.current = true;
        }
      }, IDLE_THRESHOLD_MS);
    };

    const handleVisibilityChange = () => {
        if (document.hidden) {
            sendNeuralSignal("tab_hidden", { timestamp: Date.now() });
        } else {
            sendNeuralSignal("tab_visible", { time_away_ms: Date.now() - lastInteractionRef.current });
            resetIdleTimer();
        }
    };

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetIdleTimer();

    return () => {
        // Log Session End
        sendNeuralSignal("session_end", { 
            duration_sec: (Date.now() - sessionStartTime.current) / 1000,
            modules_completed_session: completedSegmentIds.size
        });
        
        window.removeEventListener("mousemove", resetIdleTimer);
        window.removeEventListener("click", resetIdleTimer);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [view, plan, sendNeuralSignal]);

  // 💎 SYNC LOGIC: Merge LocalStorage (Persistence) with Global Store (Live Data)
  useEffect(() => {
    if (plan?.video_title) {
        const key = `vectorix_progress_${plan.video_title}`;
        
        // 1. Load from Disk
        const savedRaw = localStorage.getItem(key);
        let savedSet = new Set<string>();
        if (savedRaw) {
            try { savedSet = new Set(JSON.parse(savedRaw)); } catch (e) {}
        }

        // 2. Load from Memory (Global Store might have updates from Tutor)
        // Union the two sets to get the most complete truth
        const mergedSet = new Set([...savedSet, ...completedSegmentIds]);
        
        // 3. Update Global Store if different
        if (mergedSet.size > completedSegmentIds.size) {
            setCompletedSegmentIds(mergedSet);
        }
    }
  }, [plan?.video_title]); // Run once when plan loads

  // 💎 PERSISTENCE LOGIC: Save Global Store changes to Disk
  useEffect(() => {
    if (plan?.video_title && completedSegmentIds.size > 0) {
        const key = `vectorix_progress_${plan.video_title}`;
        localStorage.setItem(key, JSON.stringify(Array.from(completedSegmentIds)));
    }
  }, [completedSegmentIds, plan?.video_title]);

  // Track when entering Plan View
  useEffect(() => {
    if (view === 'plan' && plan) {
      tracker.startSession(`Study Plan: ${plan.video_title}`);
    }
  }, [view, plan]);

  useEffect(() => {
    if (plan) {
      setView('plan');
    }
  }, [plan]);

  // Force default to URL if file is somehow selected but disabled
  useEffect(() => {
    if (inputType === 'file') {
      setInputType('url');
    }
  }, []);

  // --- ACTIONS ---
  const handleGenerate = async () => {
    if (inputType === 'url' && !videoUrl) return toast.error("Please enter a valid YouTube URL.");
    if (inputType === 'file' && !videoFile) return toast.error("Please select a file first.");
    
    setLoading(true);
    sendNeuralSignal("generation_start", { mode }); // 🧠 Log

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        toast.warning("Deep analysis in progress... this might take a moment.");
    }, 15000); 
    
    const safetyCutoff = setTimeout(() => controller.abort(), 600000);

    try {
      const formData = new FormData();
      formData.append('mode', mode);
      
      if (inputType === 'file' && videoFile) {
        formData.append('file', videoFile);
      } else if (inputType === 'url' && videoUrl) {
        formData.append('url', videoUrl);
      }

      const res = await fetch(`${API_BASE}/study-plan/generate-lecture`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      clearTimeout(safetyCutoff);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.detail && errData.detail.includes("LecturePlanResponse")) {
             throw new Error("Backend Schema Mismatch. Please check main.py line 418.");
        }
        throw new Error(errData.detail || `Analysis failed: ${res.status}`);
      }

      const data = await res.json();

      // 💎 SANITIZE TITLE (This becomes the Session ID)
      if (data.video_title) {
          data.video_title = data.video_title
              .replace(/\.[^/.]+$/, "") // Remove extension
              .replace(/[_-]/g, " ")    // Clean separators
              .trim();
      }

      // Reset local progress for new plan
      localStorage.removeItem(`vectorix_progress_${data.video_title}`);
      setCompletedSegmentIds(new Set()); // Clear global too

      setPlan(data);
      
      if (inputType === 'file' && videoFile) {
        const blobUrl = URL.createObjectURL(videoFile);
        setVideoUrl(blobUrl);
      } 

      NeuralLogger.log("study_plan", data.video_title, "plan_generated", data.segments.length);
      tracker.startSession(`Study Plan: ${data.video_title}`);
      
      sendNeuralSignal("plan_generated", { segments: data.segments.length }); // 🧠 Log

      setView('plan');
      toast.success("Structure Generated Successfully");

    } catch (e: any) {
      console.error(e);
      if (e.name === 'AbortError') {
         toast.error("Analysis Timeout: Content too large.");
      } else {
         toast.error(e.message || "Failed to analyze lecture");
      }
      sendNeuralSignal("generation_fail", { error: e.message }); // 🧠 Log
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
      clearTimeout(safetyCutoff);
    }
  };

  const startLearningSession = (segment: VideoSegment) => {
    if (!videoUrl) {
        if (inputType === 'file' && videoFile) {
            const recoveredUrl = URL.createObjectURL(videoFile);
            setVideoUrl(recoveredUrl);
        } else {
            return toast.error("Video source lost. Please re-upload.");
        }
    }

    const isRevisit = completedSegmentIds.has(segment.id);
    const decisionTime = (Date.now() - sessionStartTime.current) / 1000;

    // 🧠 BEHAVIORAL SIGNALS
    if (isRevisit) {
        sendNeuralSignal("segment_revisit", { segment_id: segment.id, importance: segment.importance });
    } else {
        sendNeuralSignal("segment_start", { 
            segment_id: segment.id, 
            importance: segment.importance,
            decision_delay: decisionTime 
        });
    }

    // 💎 TRACK PROGRESS: Mark this module as visited globally
    markSegmentAsCompleted(segment.id);

    tracker.log('video_play', `Starting Segment: ${segment.title}`);

    // 💎 GENERATE INDESTRUCTIBLE ID
    const sessionKey = plan?.video_title || "Unknown Plan";
    console.log(`🚀 [StudyPlan] Launching Session: "${sessionKey}"`);

    setActiveContext({
        source: 'study_plan',
        topic: sessionKey,
        sessionId: sessionKey, 
        returnPath: '/study-plan'
    });

    const instruction = mode === 'balanced' 
      ? `You are a patient professor teaching the concept: "${segment.title}". The student is watching a video segment (Time: ${segment.timestamp_start} to ${segment.timestamp_end}). Summary of context: ${segment.summary}. Explain things deeply and clearly.`
      : `You are an intense exam coach. The student is cramming "${segment.title}". Focus ONLY on high-yield facts, previous year questions (PYQs), and potential traps related to this video segment. Be concise.`;
    
    setSystemInstruction(instruction);

    // Pass via URL
    navigate(`/ai-tutor?sid=${encodeURIComponent(sessionKey)}`, { 
      state: { sessionType: 'video_lecture', segmentContext: segment } 
    });
  };

  // 💎 THE "FINISH" BUTTON LOGIC (Final Handshake)
  const handleReset = () => {
    sendNeuralSignal("plan_reset_manual"); // 🧠 Log

    if (plan) {
        // 1. Prepare 50:50 Metrics from GLOBAL STORE
        const metrics = {
            modulesCompleted: completedSegmentIds.size, // 💎 FIX: Use global size
            totalModules: plan.segments.length,
            isExamComplete: isExamComplete // 💎 CRITICAL: Send Exam Pass/Fail Status
        };

        // 2. Send to Tracker -> Backend (Neural Engine)
        const report = tracker.endSession(metrics);
        if (report.events.length > 0) NeuralLogger.sendTelemetry(report);
        
        // 3. Clean up local persistence
        localStorage.removeItem(`vectorix_progress_${plan.video_title}`);
        localStorage.removeItem(`vectorix_exam_${plan.video_title}`);
    }
    
    // 4. Hard Reset
    resetStudyPlan(); 
    
    // 5. Reset UI
    setView('config');
  };

  const handleFinalExamStart = (config: QuizConfig) => {
    if (!plan) return;
    
    tracker.log('quiz_view', 'Starting Final Exam');
    sendNeuralSignal("exam_start_attempt"); // 🧠 Log

    const sessionKey = plan.video_title;
    console.log(`🚀 [StudyPlan] Launching Exam: "${sessionKey}"`);

    setActiveContext({
        source: 'study_plan',
        topic: sessionKey,
        sessionId: sessionKey, 
        returnPath: '/study-plan'
    });

    const fullContext = getAggregatedSummaries(plan);
    const allSegmentIds = plan.segments.map(s => s.id);
    setShowQuizModal(false);
    
    navigate(`/ai-test?sid=${encodeURIComponent(sessionKey)}`, {
      state: {
        sourceType: "study_plan",
        topic: `Final Exam: ${plan.video_title}`,
        textContext: fullContext,
        relatedIds: allSegmentIds,
        config: config
      }
    });
  };

  // --- RENDER: CONFIGURATION VIEW ---
  if (view === 'config') {
    return (
      <div className="relative min-h-[90vh] w-full flex flex-col items-center justify-center py-20 px-6 font-sans">
        <div className="relative z-10 w-full max-w-6xl flex flex-col items-center gap-14 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0F111A] border border-white/10 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Study Architect v3.0</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9]">
              Architect Your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-cyan-400 animate-pulse-glow">
                Knowledge Path
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed font-light">
              Upload lectures. We deconstruct them into colorful, interactive learning modules tailored to your exam timeline.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 w-full">
            <Card className="p-8 bg-[#0E1016]/90 border border-white/5 backdrop-blur-3xl rounded-[32px] shadow-2xl flex flex-col gap-8 relative group overflow-hidden hover:border-white/10 transition-all">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-600 via-emerald-500 to-cyan-500 opacity-50" />
              <div className="space-y-1 relative z-10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Upload className="w-5 h-5 text-emerald-400" /> Source Material
                </h3>
                <p className="text-xs text-zinc-500 font-medium">Select lecture data for processing</p>
              </div>
              <div className="p-1.5 bg-[#0B0C15] rounded-xl border border-white/5 flex gap-2">
                {/* 💎 UPDATED: File Upload Disabled for Development */}
                <button 
                    disabled
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-not-allowed opacity-50",
                        "text-zinc-500 bg-white/5 border border-white/5" // Force disabled style
                    )}
                >
                  <FileVideo className="w-3 h-3" /> File Upload <span className="ml-1 text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">DEV</span>
                </button>
                <button 
                    onClick={() => setInputType('url')} 
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        inputType === 'url' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white hover:bg-white/5"
                    )}
                >
                  <LinkIcon className="w-3 h-3" /> Web Link
                </button>
              </div>
              <div className="flex-1 min-h-[240px]">
                {inputType === 'url' ? (
                  <div className="h-full flex flex-col justify-center gap-5">
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur opacity-20 transition duration-500 group-hover:opacity-40" />
                      <div className="relative flex items-center bg-[#0B0C15] border border-white/10 rounded-2xl px-4 h-16">
                        <Youtube className="w-5 h-5 text-zinc-600 mr-3" />
                        <Input placeholder="Paste YouTube Link..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-700 h-full p-0 focus-visible:ring-0 text-base" />
                      </div>
                    </div>
                    <div className="flex justify-center">
                        <span className="px-3 py-1 rounded border border-white/5 bg-white/[0.02] text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Ready for Processing</span>
                    </div>
                  </div>
                ) : (
                  // 💎 UPDATED: Disabled State View
                  <div className="h-full border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center bg-white/[0.01] opacity-50 cursor-not-allowed relative group overflow-hidden">
                    <div className="w-20 h-20 rounded-full bg-[#0B0C15] flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/5">
                      <Construction className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-sm font-bold text-zinc-500 tracking-wide">Under Construction</p>
                    <p className="text-[10px] text-zinc-700 mt-2 uppercase tracking-widest font-medium">Coming Soon in v3.0</p>
                  </div>
                )}
              </div>
            </Card>
            <div className="flex flex-col gap-5">
               <div onClick={() => setMode('balanced')} className={cn("flex-1 cursor-pointer p-8 rounded-[32px] border transition-all duration-500 relative overflow-hidden group flex flex-col justify-center", mode === 'balanced' ? "bg-[#0E1016]/90 border-emerald-500/40 shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)]" : "bg-[#0E1016]/40 border-white/5 hover:border-emerald-500/20 hover:bg-[#0E1016]/60")}>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
                 <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className={cn("p-3.5 rounded-2xl transition-all duration-300", mode === 'balanced' ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-[#151722] text-zinc-600")}><GraduationCap className="w-6 h-6" /></div>
                    {mode === 'balanced' && (<div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">Active</div>)}
                 </div>
                 <h3 className={cn("font-bold text-xl tracking-tight relative z-10", mode === 'balanced' ? "text-white" : "text-zinc-500")}>Deep Learning</h3>
                 <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-[90%] relative z-10">Full conceptual breakdown with analogies. Ideal for mastery.</p>
               </div>
               <div onClick={() => setMode('exam')} className={cn("flex-1 cursor-pointer p-8 rounded-[32px] border transition-all duration-500 relative overflow-hidden group flex flex-col justify-center", mode === 'exam' ? "bg-[#0E1016]/90 border-orange-500/40 shadow-[0_0_40px_-10px_rgba(249,115,22,0.15)]" : "bg-[#0E1016]/40 border-white/5 hover:border-orange-500/20 hover:bg-[#0E1016]/60")}>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none" />
                 <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className={cn("p-3.5 rounded-2xl transition-all duration-300", mode === 'exam' ? "bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "bg-[#151722] text-zinc-600")}><Zap className="w-6 h-6" /></div>
                    {mode === 'exam' && (<div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-[10px] font-bold text-orange-400 uppercase tracking-widest animate-pulse">Active</div>)}
                 </div>
                 <h3 className={cn("font-bold text-xl tracking-tight relative z-10", mode === 'exam' ? "text-white" : "text-zinc-500")}>Exam Cram</h3>
                 <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-[90%] relative z-10">High-yield facts and PYQ focus. Optimized for speed.</p>
               </div>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="w-full h-16 bg-white text-black hover:bg-zinc-200 font-bold text-sm uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_40px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] max-w-sm">
            {loading ? (<div className="flex items-center gap-3"><Loader2 className="animate-spin h-5 w-5" /> <span>Analyzing Structure...</span></div>) : (<div className="flex items-center gap-3"><Wand2 className="w-5 h-5" /><span>Generate Plan</span></div>)}
          </Button>
        </div>
      </div>
    );
  }

  // --- RENDER: PLAN VIEW ---
  return (
    <div className="relative min-h-screen w-full font-sans pb-32 pt-12">
      <div className="relative z-20 max-w-6xl mx-auto px-6 space-y-16 animate-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col md:flex-row items-end justify-between gap-8 border-b border-white/5 pb-8 relative">
          <div className="space-y-4">
            <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest backdrop-blur-md", plan?.mode === 'balanced' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-orange-500/20 bg-orange-500/10 text-orange-400")}>
              {plan?.mode === 'balanced' ? <BookOpen className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {plan?.mode === 'balanced' ? 'Deep Learning Protocol' : 'Cram Protocol'}
            </div>
            <h1 className="text-44xl md:text-6xl font-black text-white leading-[0.9] tracking-tight max-w-3xl">{plan?.video_title}</h1>
            <div className="flex items-center gap-6 text-zinc-500 text-xs font-mono uppercase tracking-wider">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> {plan?.total_duration}</span>
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-400" /> {plan?.segments.length} Modules</span>
            </div>
          </div>
          <div className="flex gap-3">
              {/* 💎 UPDATED FINISH BUTTON */}
              <Button onClick={handleReset} variant="ghost" className="h-10 px-4 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all text-xs font-bold uppercase tracking-widest"><RefreshCw className="w-3 h-3 mr-2" /> Finish</Button>
              
              {/* 💎 UPDATED EXAM BUTTON: Changes color if Exam Passed */}
              <Button 
                onClick={() => setShowQuizModal(true)} 
                className={cn(
                    "h-10 px-6 font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-xs uppercase tracking-widest",
                    isExamComplete ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white text-black hover:bg-zinc-200"
                )}
              >
                {isExamComplete ? (
                    <div className="flex items-center gap-2"><Trophy className="w-4 h-4 fill-black" /> Exam Completed</div>
                ) : (
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Final Exam</div>
                )}
              </Button>
          </div>
        </div>
        <div className="relative pl-4 md:pl-10 max-w-5xl mx-auto">
          <div className="absolute left-[1.9rem] md:left-[2.9rem] top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500/50 via-purple-500/20 to-transparent" />
          <div className="space-y-12">
            {plan?.segments.map((segment, index) => {
              // 💎 VISUAL FEEDBACK: Check GLOBAL STORE for completion
              const isVisited = completedSegmentIds.has(segment.id);
              
              return (
                <div key={segment.id} className="relative group">
                  <div className={cn("absolute left-[1.65rem] md:left-[2.65rem] top-8 w-3 h-3 rounded-full ring-4 ring-[#0B0C15] z-10 transition-all duration-500", 
                      isVisited ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-125" : 
                      segment.importance === 'high' ? "bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.6)]" : "bg-zinc-700 group-hover:bg-zinc-400")} 
                  />
                  <div className="pl-16 md:pl-24">
                    <div className={cn("relative overflow-hidden rounded-[24px] border transition-all duration-500 group-hover:-translate-y-1 backdrop-blur-xl", 
                        isVisited ? "bg-[#0E1016]/95 border-emerald-500/30" : 
                        segment.importance === 'high' ? "bg-[#0E1016]/90 border-blue-500/30 shadow-[0_0_40px_-10px_rgba(59,130,246,0.1)]" : "bg-[#0E1016]/60 border-white/5 hover:border-white/10 hover:shadow-2xl")}>
                      {segment.importance === 'high' && !isVisited && (<div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />)}
                      {isVisited && (<div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />)}
                      
                      <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-start">
                         <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-3">
                               <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] bg-white/[0.03] px-2 py-1 rounded border border-white/5">Module {String(index + 1).padStart(2, '0')}</span>
                               {segment.importance === 'high' && (<span className="flex items-center gap-1.5 text-[9px] font-bold text-blue-300 uppercase tracking-[0.2em] bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><AlertCircle className="w-3 h-3" /> Core Concept</span>)}
                               {isVisited && (<span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-300 uppercase tracking-[0.2em] bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Completed</span>)}
                            </div>
                            <h3 className={cn("text-2xl font-bold transition-colors leading-tight", isVisited ? "text-emerald-50" : segment.importance === 'high' ? "text-white group-hover:text-blue-200" : "text-white group-hover:text-zinc-200")}>{segment.title}</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">{segment.summary}</p>
                         </div>
                         <div className="flex flex-row md:flex-col items-center md:items-end gap-5 shrink-0 w-full md:w-auto justify-between md:justify-start border-t md:border-t-0 md:border-l border-white/5 pt-5 md:pt-0 md:pl-8">
                            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 bg-black/50 px-3 py-1.5 rounded-lg border border-white/5"><Timer className="w-3 h-3 text-indigo-500" />{segment.timestamp_start} — {segment.timestamp_end}</div>
                            <Button onClick={() => startLearningSession(segment)} className={cn("h-10 px-6 font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 text-[10px] uppercase tracking-widest w-full md:w-auto", isVisited ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white text-black hover:bg-zinc-200")}>
                                {isVisited ? "Review" : "Start Session"} <ChevronRight className="w-3 h-3 ml-2" />
                            </Button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <QuizSetupModal isOpen={showQuizModal} onClose={() => setShowQuizModal(false)} onStart={handleFinalExamStart} onSkip={() => setShowQuizModal(false)} sourceType="study_plan" moduleCount={plan?.segments.length || 0} />
    </div>
  );
}