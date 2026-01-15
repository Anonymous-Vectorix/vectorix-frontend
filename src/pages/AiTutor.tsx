import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useVectorixStore } from "@/contexts/VectorixStore"; 
import { AiTutorSection } from "@/components/home/AiTutorSection";
import { VideoChatInterface } from "@/components/home/VideoChatInterface"; 
import { Layout } from "@/components/layout/Layout"; 
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NeuralLogger } from "@/lib/neural-logger"; 
import { tracker } from "@/lib/BehavioralTracker"; 
import { ArrowLeft, CheckCircle2, Timer, ChevronRight, RotateCcw, Bot, Brain } from 'lucide-react';
import { toast } from 'sonner';

// --- IMPORT ENGINES ---
import { NativeTutorView } from "@/components/home/NativeTutorView";
import { UrlTutorView } from "@/components/home/UrlTutorView";

const parseTime = (timeStr: string) => {
  if (!timeStr) return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return (min * 60) + sec;
};

const Background = () => (
  <div className="fixed inset-0 pointer-events-none z-0 bg-[#050505]">
     <div className="absolute top-[-10%] right-[20%] w-[600px] h-[600px] bg-emerald-500/10 blur-[150px] rounded-full opacity-40 mix-blend-screen animate-pulse-slow" />
     <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full opacity-40 mix-blend-screen" />
     <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] opacity-100" />
  </div>
);

const AiTutor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // 💎 IMPORT markSegmentAsCompleted & setActiveContext
  const { 
    videoUrl, setVideoUrl, mode: videoMode, plan, systemInstruction, 
    activeSegmentId, setActiveSegmentId, activeContext, setActiveContext, markSegmentAsCompleted 
  } = useVectorixStore();

  const [currentTime, setCurrentTime] = useState(0);
  const [isModuleComplete, setIsModuleComplete] = useState(false);
  const seekLockRef = useRef(false);

  // Fallback Lock (Secondary safety)
  const sessionLock = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    // 💎 LOCK UPDATE: Lock the ID from the strongest source available on mount
    const idToLock = plan?.video_title || activeContext?.sessionId;
    if (!sessionLock.current && idToLock) {
      sessionLock.current = idToLock;
    }
  }, [activeContext, plan]);

  // 💎 THE INDESTRUCTIBLE ID STRATEGY
  const urlSessionId = searchParams.get('sid');
  const effectiveSessionId = plan?.video_title || urlSessionId || sessionLock.current || activeContext?.sessionId || (location.state as any)?.sessionId;

  // DECIDE ENGINE
  const isNative = videoUrl?.startsWith('blob:');

  useEffect(() => {
    if (location.state?.segmentContext) {
        const targetId = location.state.segmentContext.id;
        setActiveSegmentId(targetId);
        // Log start with persistent ID
        NeuralLogger.log('tutor', location.state.segmentContext.title, 'session_start' as any, 0, undefined, { session_id: effectiveSessionId });
    }
  }, [location.state, setActiveSegmentId, effectiveSessionId]);

  const currentSegment = useMemo(() => {
    if (activeSegmentId && plan?.segments) {
      return plan.segments.find((s: any) => s.id === activeSegmentId) || plan.segments[0];
    }
    return plan?.segments?.[0] || null;
  }, [activeSegmentId, plan]);

  const hasNextModule = useMemo(() => {
      if (!plan?.segments || !currentSegment) return false;
      const idx = plan.segments.findIndex((s: any) => s.id === currentSegment.id);
      return idx !== -1 && idx < plan.segments.length - 1;
  }, [plan, currentSegment]);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    if (seekLockRef.current || isModuleComplete) return;

    if (currentSegment) {
       const endTime = parseTime(currentSegment.timestamp_end);
       // Tighter threshold (0.1s)
       if (time >= endTime - 0.1) {
           handleModuleComplete();
       }
    }
  };

  const handleModuleComplete = () => {
      if (!isModuleComplete) {
          setIsModuleComplete(true);
          tracker.log('video_pause', 'Module Complete Popup Shown');
      }
  };

  // 💎 NEW: POP QUIZ HANDLER
  const handleTakeQuiz = () => {
      if (!currentSegment) return;

      // 1. Set Context: Tell the store we are coming from the Tutor
      setActiveContext({
          source: 'tutor', // This triggers Path 2 in AiTestSection
          topic: currentSegment.title,
          sessionId: effectiveSessionId,
          returnPath: location.pathname + location.search
      });

      // 2. Mark current as complete (since they are leaving to quiz)
      if (currentSegment.id) {
          markSegmentAsCompleted(currentSegment.id);
      }

      // 3. Navigate with the segment's summary as the quiz material
      navigate(`/ai-test?sid=${encodeURIComponent(effectiveSessionId || '')}`, {
          state: {
              topic: `Quiz: ${currentSegment.title}`,
              textContext: currentSegment.summary, // 🧠 Generates questions from THIS video
              config: {
                  questionCount: 3, // Short pop quiz
                  difficulty: 'medium'
              }
          }
      });
  };

  const handleNext = () => {
      if (!hasNextModule || !plan) { toast.success("Course Complete!"); return; }
      
      // 💎 CRITICAL FIX: Mark current segment as complete BEFORE switching
      if (currentSegment?.id) {
          markSegmentAsCompleted(currentSegment.id);
      }

      const idx = plan.segments.findIndex((s: any) => s.id === currentSegment.id);
      const nextSegment = plan.segments[idx + 1];
      
      if (nextSegment) {
          // Log progress for CURRENT module before switching
          NeuralLogger.log('study_plan', currentSegment?.title, 'task_complete', 30, undefined, { session_id: effectiveSessionId });
          tracker.log('video_seek', `User clicked Next Module: ${nextSegment.title}`);

          seekLockRef.current = true;
          setActiveSegmentId(nextSegment.id);
          setIsModuleComplete(false); 
          
          setTimeout(() => { seekLockRef.current = false; }, 2000);
      }
  };

  const handleFinish = () => {
      // 💎 CRITICAL FIX: Mark final segment as complete
      if (currentSegment?.id) {
          markSegmentAsCompleted(currentSegment.id);
      }

      NeuralLogger.log('study_plan', currentSegment?.title, 'task_complete', 30, undefined, { session_id: effectiveSessionId });
      
      const report = tracker.endSession();
      // 💎 CRITICAL: Stamp the report with the Plan Title (Session ID)
      if (effectiveSessionId) {
          (report as any).session_id = effectiveSessionId;
      }
      NeuralLogger.sendTelemetry(report);

      toast.success("Course Completed!");
      setTimeout(() => {
          navigate('/study-plan');
      }, 1000);
  };

  const handleReplay = () => {
      setIsModuleComplete(false);
      tracker.log('video_seek', 'User clicked Replay Segment');
  };

  if (!videoUrl) return <Layout><AiTutorSection segmentId={currentSegment?.id} /></Layout>;

  return (
    <div className="h-screen w-full flex flex-col bg-transparent text-white overflow-hidden font-sans selection:bg-emerald-500/30 relative">
      <Background />

      {/* HEADER */}
      <div className="h-16 border-b border-white/10 flex items-center px-6 justify-between bg-black/20 backdrop-blur-xl z-50 fixed top-0 w-full lg:w-[60%]">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/study-plan')} className="hover:bg-white/10 rounded-full text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-wide text-zinc-100 truncate max-w-[300px]">{plan?.video_title || "Lecture Mode"}</h2>
          </div>
        </div>
        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] tracking-widest uppercase backdrop-blur-md">
            {isNative ? "Native Engine" : "Cloud Engine"}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row pt-16 h-full relative z-10">
        
        {/* === LEFT: VIDEO PLAYER === */}
        <div className="w-full lg:w-[60%] flex flex-col relative bg-black">
            
            <div className="flex-1 relative overflow-hidden">
                {isNative ? (
                    <NativeTutorView 
                        key={currentSegment?.id || "native-view"} 
                        videoUrl={videoUrl} 
                        setVideoUrl={setVideoUrl} 
                        onTimeUpdate={handleTimeUpdate}
                        onComplete={handleModuleComplete}
                        isModuleComplete={isModuleComplete} 
                        currentSegment={currentSegment} 
                        topic={plan?.video_title || "Video Lecture"}
                        sessionId={effectiveSessionId} 
                    />
                ) : (
                    <UrlTutorView 
                        key={currentSegment?.id || "url-view"} 
                        videoUrl={videoUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onComplete={handleModuleComplete}
                        isModuleComplete={isModuleComplete} 
                        currentSegment={currentSegment} 
                        topic={plan?.video_title || "Web Lecture"}
                        sessionId={effectiveSessionId} 
                    />
                )}

                {/* MODULE COMPLETION POPUP */}
                {isModuleComplete && (
                    <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
                       <div className="text-center space-y-8 p-10 rounded-[32px] border border-white/10 bg-[#0A0A0A] shadow-2xl max-w-md w-full relative overflow-hidden">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-500/20 blur-[50px] rounded-full pointer-events-none" />
                          
                          <div className="relative z-10">
                              <div className="inline-flex p-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                              </div>
                              <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Module Complete</h3>
                              <p className="text-zinc-400 text-sm font-medium">You've covered the theory. Ready to move on?</p>
                          </div>

                          <div className="flex flex-col gap-3 relative z-10">
                              {hasNextModule ? (
                                  <Button 
                                    onClick={handleNext} 
                                    className="h-14 w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-2xl shadow-lg transition-all hover:scale-[1.02] text-sm uppercase tracking-widest"
                                  >
                                    Next Module <ChevronRight className="w-4 h-4 ml-2" />
                                  </Button>
                              ) : (
                                  <Button 
                                    onClick={handleFinish}
                                    className="h-14 w-full bg-emerald-500 text-black hover:bg-emerald-400 font-bold rounded-2xl shadow-lg transition-all hover:scale-[1.02] text-sm uppercase tracking-widest"
                                  >
                                    Finish & Return (+30%)
                                  </Button>
                              )}
                              
                              {/* 💎 NEW: POP QUIZ BUTTON */}
                              <Button 
                                onClick={handleTakeQuiz}
                                className="h-14 w-full bg-indigo-600 text-white hover:bg-indigo-500 font-bold rounded-2xl shadow-lg transition-all hover:scale-[1.02] text-sm uppercase tracking-widest border border-indigo-400/30"
                              >
                                Take Quick Quiz <Brain className="w-4 h-4 ml-2" />
                              </Button>
                              
                              <Button 
                                variant="ghost" 
                                onClick={handleReplay} 
                                className="h-12 w-full text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl font-semibold transition-colors"
                              >
                                <RotateCcw className="w-4 h-4 mr-2" /> Replay Segment
                              </Button>
                          </div>
                       </div>
                    </div>
                )}
            </div>

            {/* BOTTOM INFO BAR */}
            <div className="bg-[#050505]/90 backdrop-blur-xl border-t border-white/10 p-6 flex justify-between items-center gap-4 z-50">
               <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Current Module</span>
                     <span className="text-xs text-zinc-500 font-mono flex items-center gap-1"><Timer className="w-3 h-3" /> {currentSegment?.timestamp_start} - {currentSegment?.timestamp_end}</span>
                  </div>
                  <h1 className="text-xl font-bold text-white">{currentSegment?.title || "Overview"}</h1>
               </div>
               
               {hasNextModule && (
                  <Button onClick={handleNext} className="hidden md:flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-emerald-500/50 transition-all duration-300 h-12 px-6 rounded-xl shrink-0 group backdrop-blur-md">
                     <span className="text-sm font-semibold group-hover:text-emerald-400 transition-colors">Next Module</span>
                     <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                  </Button>
               )}
            </div>
        </div>

        {/* === RIGHT: AI CHAT === */}
        <div className="hidden lg:flex w-[40%] flex-col bg-[#0A0A0A]/40 backdrop-blur-3xl border-l border-white/10 relative z-40">
           <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-indigo-400" /></div>
                 <span className="text-xs font-bold text-white uppercase tracking-[0.2em] drop-shadow-md">AI Professor</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                 <span className="text-[10px] text-zinc-500 font-bold uppercase">Online</span>
              </div>
           </div>
           <div className="flex-1 overflow-hidden relative">
              <VideoChatInterface 
                 key={`persistent-chat-interface-${effectiveSessionId}`} // 💎 Force reset if ID changes
                 systemInstruction={systemInstruction} 
                 initialContext={currentSegment}
                 currentSegment={currentSegment} 
                 mode="embedded"
                 getCurrentTime={() => currentTime}
                 sessionId={effectiveSessionId} // 💎 PASS THE ID
              />
           </div>
        </div>

      </div>
    </div>
  );
};

export default AiTutor;