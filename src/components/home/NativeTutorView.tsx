import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, FastForward, Rewind, Upload, FileWarning, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { NeuralLogger } from "@/lib/neural-logger"; 
import { tracker } from "@/lib/BehavioralTracker"; 
// 💎 IMPORT STORE
import { useVectorixStore } from "@/contexts/VectorixStore";

// API Handling
import { API_BASE_URL } from "@/lib/config";
const NEURAL_ENDPOINT = `${API_BASE_URL}/tutor/neural/log`;
const INTERVENTION_ENDPOINT = `${API_BASE_URL}/tutor/neural/intervention`;

const FLOW_THRESHOLD_MS = 180000; // 3 minutes for Deep Flow
const CONFUSION_WINDOW_MS = 60000; // 60s window for rewind clustering
const CONFUSION_THRESHOLD = 3;     // 3 rewinds = Confusion

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const parseTime = (timeStr: string) => {
  if (!timeStr) return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return (min * 60) + sec;
};

interface NativeTutorProps {
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  onTimeUpdate: (time: number) => void;
  onComplete: () => void;
  isModuleComplete?: boolean;
  currentSegment?: any;
  topic?: string;
  sessionId?: string; 
  
  // 50:50 Protocol Context
  modulesCompleted?: number;
  totalModules?: number;
  isExamComplete?: boolean;
}

export function NativeTutorView({ 
  videoUrl, 
  setVideoUrl, 
  onTimeUpdate, 
  onComplete, 
  isModuleComplete,
  currentSegment,
  topic = "Video Lecture",
  sessionId,
  
  // New Metrics
  modulesCompleted = 0,
  totalModules = 1,
  isExamComplete = false
}: NativeTutorProps) {
  // 💎 ACCESS GLOBAL STORE
  const { markSegmentAsCompleted, completedSegmentIds, plan } = useVectorixStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const reuploadRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isError, setIsError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // 🧠 BEHAVIORAL REFS
  const exitReason = useRef<"completed" | "midway_exit" | "error_exit">("midway_exit");
  const flowTimer = useRef<NodeJS.Timeout | null>(null);
  const rewindBuffer = useRef<number[]>([]); // Stores timestamps of recent rewinds
  
  // 🧠 INTERVENTION STATE
  const [activeIntervention, setActiveIntervention] = useState<any>(null);
  const lastAcknowledgedRef = useRef<string | null>(null); 

  // --- 🧠 NEURAL TELEMETRY SENDER ---
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    // Fire-and-forget logging
    const payload = {
      source: "native_tutor",
      topic: topic,
      event_type: eventType,
      timestamp: Date.now() / 1000,
      session_id: sessionId || "video_pending",
      metadata: { ...metadata, video_time: videoRef.current?.currentTime || 0 }
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      // 💎 FIX 1: Identity Isolation (Prevent user bleed)
      headers: { "Content-Type": "application/json", "X-User-Id": sessionId || "anonymous" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }, [topic, sessionId]);

  // --- 🧠 1. INTERVENTION POLLING LOOP ---
  useEffect(() => {
    if (!sessionId) return;

    const pollIntervention = async () => {
        try {
            const res = await fetch(INTERVENTION_ENDPOINT, {
                // 💎 FIX 1: Identity Isolation here too
                headers: { "X-User-Id": sessionId || "anonymous" }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.should_intervene) {
                    setActiveIntervention(data);
                } else {
                    // 💎 FIX 2: State Cleanup (Clear intervention if backend resolves it)
                    setActiveIntervention(null);
                    lastAcknowledgedRef.current = null;
                }
            }
        } catch (e) { /* silent fail */ }
    };

    const interval = setInterval(pollIntervention, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [sessionId]);

  // --- 🧠 2. INTERVENTION HANDLER ---
  useEffect(() => {
    if (!activeIntervention?.should_intervene) return;

    // Prevent duplicate acknowledgments
    if (lastAcknowledgedRef.current === activeIntervention.strategy) return;
    lastAcknowledgedRef.current = activeIntervention.strategy;

    sendNeuralSignal("intervention_acknowledged", {
        strategy: activeIntervention.strategy,
        urgency: activeIntervention.urgency
    });

    // Auto-Pause logic for High Urgency Interventions
    if (
        activeIntervention.strategy.includes("Pause") || 
        activeIntervention.strategy.includes("Break")
    ) {
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
            sendNeuralSignal("auto_pause", {
                reason: "neural_intervention",
                strategy: activeIntervention.strategy
            });
            
            // 💎 UX IMPROVEMENT: Urgency Gate for Toasts
            if (activeIntervention.urgency > 60) {
                toast.info(activeIntervention.reasoning, {
                    icon: <Sparkles className="w-4 h-4 text-purple-400" />,
                    duration: 5000
                });
            }
        }
    }
  }, [activeIntervention, sendNeuralSignal]);

  // --- 🧠 3. FLOW STATE MANAGER ---
  const resetFlowState = () => {
    if (flowTimer.current) clearTimeout(flowTimer.current);
    // Only start flow timer if playing
    if (isPlaying && !isDragging) {
        flowTimer.current = setTimeout(() => {
            sendNeuralSignal("deep_flow", { duration_sec: FLOW_THRESHOLD_MS / 1000 });
            resetFlowState(); 
        }, FLOW_THRESHOLD_MS);
    }
  };

  // Detect Flow Breaks (Dragging)
  useEffect(() => {
    resetFlowState();
    if (isDragging) {
        sendNeuralSignal("flow_break", { reason: "seeking" });
    }
    return () => { if (flowTimer.current) clearTimeout(flowTimer.current); };
  }, [isPlaying, isDragging]); 

  // 🧠 SESSION TRACKING
  useEffect(() => {
    console.log(`🟢 [NativeTutor] MOUNTED. Session ID: "${sessionId}"`);

    if (videoUrl && !isError) {
        tracker.startSession(topic, sessionId);
        sendNeuralSignal("session_start", { video_url: videoUrl });
    }
    
    return () => {
        const effectiveCount = Math.max(modulesCompleted, completedSegmentIds.size);
        const effectiveTotal = plan?.segments?.length || totalModules || 1;
        
        const metrics = {
            modulesCompleted: effectiveCount, 
            totalModules: effectiveTotal, 
            isExamComplete
        };

        const report = tracker.endSession(metrics);
        
        console.log(`🔴 [NativeTutor] UNMOUNTING. Exit: ${exitReason.current}`);

        if (report.events.length > 0) {
            if (sessionId) { (report as any).session_id = sessionId; } 
            NeuralLogger.sendTelemetry(report);
        }

        // 🧠 LOG GRANULAR EXIT
        sendNeuralSignal("session_end", { 
            exit_type: exitReason.current,
            progress: duration > 0 ? (currentTime / duration) : 0
        });
    };
  }, [videoUrl, topic, sessionId, modulesCompleted, totalModules, isExamComplete, completedSegmentIds, plan, sendNeuralSignal]); 

  // 1. Reset state when URL changes
  useEffect(() => {
    setIsError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    exitReason.current = "midway_exit"; 
    setActiveIntervention(null); // Clear interventions on new video
    lastAcknowledgedRef.current = null;
    if (videoRef.current) {
        videoRef.current.load();
    }
  }, [videoUrl]);

  // 2. Auto-Seek when Module Changes
  useEffect(() => {
    if (currentSegment && videoRef.current) {
        const start = parseTime(currentSegment.timestamp_start);
        if (Math.abs(videoRef.current.currentTime - start) > 2) {
            tracker.log('video_seek', `Auto-Jump to Module: ${currentSegment.title}`);
            sendNeuralSignal("module_switch", { 
                from: currentTime, 
                to: start, 
                module_title: currentSegment.title // 💎 Context Tagging
            });
            videoRef.current.currentTime = start;
            setCurrentTime(start); 
        }
        tracker.startSegment(currentSegment.title);
    }
  }, [currentSegment?.id, topic]);

  // 3. Recovery Logic
  const handleReupload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    const newUrl = URL.createObjectURL(file);
    setVideoUrl(newUrl);
    e.target.value = ''; 
    toast.success("Session Restored");
    tracker.log('video_play', 'Session Restored via Re-upload'); 
    sendNeuralSignal("session_restored");
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      NeuralLogger.log('tutor', topic, 'play', currentTime, undefined, { session_id: sessionId });
      tracker.log('video_play', currentTime); 
      sendNeuralSignal("play");
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      NeuralLogger.log('tutor', topic, 'pause', currentTime, undefined, { session_id: sessionId });
      tracker.log('video_pause', currentTime); 
      
      // Explicit flow break on manual pause
      sendNeuralSignal("pause"); 
      sendNeuralSignal("flow_break", { reason: "manual_pause" });
    }
  };

  const handleLoadedMetadata = () => {
      if (videoRef.current) { setDuration(videoRef.current.duration); }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    if (duration === 0 && videoRef.current.duration) setDuration(videoRef.current.duration);
    setCurrentTime(curr);
    onTimeUpdate(curr);
  };

  const handleSeek = (vals: number[]) => {
    // Safety: Guard against zero duration
    if (!duration || duration === 0) return;
    if (!videoRef.current) return;

    const newTime = (vals[0] / 100) * duration;
    const oldTime = videoRef.current.currentTime;
    
    // 🧠 CONFUSION DETECTION
    if (newTime < oldTime) { // Rewind
        const now = Date.now();
        rewindBuffer.current = [...rewindBuffer.current, now].filter(t => now - t < CONFUSION_WINDOW_MS);
        
        if (rewindBuffer.current.length >= CONFUSION_THRESHOLD) {
            sendNeuralSignal("confusion_cluster", { 
                rewinds: rewindBuffer.current.length, 
                window_sec: CONFUSION_WINDOW_MS / 1000 
            });
            rewindBuffer.current = []; 
        }
        sendNeuralSignal("rewind", { delta: newTime - oldTime });
    } else {
        sendNeuralSignal("seek_forward", { delta: newTime - oldTime });
    }

    tracker.logSeek(oldTime, newTime);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full relative bg-black group flex flex-col justify-center overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { 
            setIsPlaying(false); 
            exitReason.current = "completed"; 
            tracker.log('video_complete', 'Video Finished'); 
            
            // Clear Intervention on Completion
            setActiveIntervention(null);
            sendNeuralSignal("intervention_resolved", { reason: "session_complete" });
            sendNeuralSignal("playback_complete");

            if (currentSegment?.id) {
                markSegmentAsCompleted(currentSegment.id);
            }
            onComplete(); 
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => { 
            setIsError(true); 
            exitReason.current = "error_exit"; 
            tracker.log('idle', 'Video Error / Expiry'); 
            sendNeuralSignal("video_error");
        }}
        playsInline
      />
      
      {/* Error UI */}
      {isError && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-center p-8 animate-in fade-in">
          <FileWarning className="w-16 h-16 text-amber-500 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Video Session Expired</h3>
          <p className="text-zinc-400 text-sm max-w-md mb-8">Browser security cleared the video from memory. <br />Please re-select the file.</p>
          <input type="file" ref={reuploadRef} className="hidden" accept="video/*" onChange={handleReupload} />
          <Button onClick={() => reuploadRef.current?.click()} className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 px-8 rounded-full">
            <Upload className="w-4 h-4 mr-2" /> Select File Again
          </Button>
        </div>
      )}
      
      {/* Play Button Overlay */}
      {!isPlaying && !isError && !isModuleComplete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:scale-105 transition-transform">
            <Play className="w-8 h-8 fill-white text-white ml-1" />
          </div>
        </div>
      )}
      
      {/* Controls Overlay */}
      <div className={cn("absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-50 transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0")}>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-xs font-mono text-zinc-300 w-10 text-right">{formatTime(currentTime)}</span>
          <Slider 
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]} 
            max={100} step={0.1}
            onPointerDown={() => setIsDragging(true)}
            onValueCommit={handleSeek}
            onValueChange={(v) => { if(isDragging) setCurrentTime((v[0]/100)*duration); }}
            className="flex-1 cursor-pointer"
          />
          <span className="text-xs font-mono text-zinc-300 w-10">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => {if(videoRef.current) { 
                  const newTime = Math.max(0, videoRef.current.currentTime - 10);
                  handleSeek([(newTime / duration) * 100]);
              }}}><Rewind className="w-5 h-5 text-zinc-300" /></Button>
              <Button size="icon" className="bg-white text-black hover:bg-zinc-200 rounded-full" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => {if(videoRef.current) { 
                  const t = Math.min(duration, videoRef.current.currentTime + 10);
                  handleSeek([(t/duration)*100]); 
              }}}><FastForward className="w-5 h-5 text-zinc-300" /></Button>
           </div>
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => { 
                  const newMuted = !isMuted; 
                  setIsMuted(newMuted); 
                  if(videoRef.current) videoRef.current.muted = newMuted; 
                  tracker.log('video_seek', newMuted ? 'Muted' : 'Unmuted');
                  sendNeuralSignal(newMuted ? "mute" : "unmute");
              }}>
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}