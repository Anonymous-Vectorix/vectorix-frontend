import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, FastForward, Rewind, RefreshCcw, AlertCircle, Sparkles } from 'lucide-react';
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

// Declare global types for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

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

// 💎 ROBUST ID EXTRACTOR
const extractVideoId = (url: string): string | null => {
  try {
    if (!url) return null;
    if (url.includes('youtu.be')) return url.split('/').pop()?.split('?')[0] || null;
    const urlObj = new URL(url);
    if (urlObj.searchParams.has('v')) return urlObj.searchParams.get('v');
    const pathSegments = urlObj.pathname.split('/');
    const liveIndex = pathSegments.indexOf('live');
    const embedIndex = pathSegments.indexOf('embed');
    if (liveIndex !== -1 && liveIndex < pathSegments.length - 1) return pathSegments[liveIndex + 1];
    if (embedIndex !== -1 && embedIndex < pathSegments.length - 1) return pathSegments[embedIndex + 1];
    return null;
  } catch (e) {
    return null;
  }
};

interface UrlTutorProps {
  videoUrl: string;
  onTimeUpdate: (time: number) => void;
  onComplete: () => void;
  currentSegment?: any;
  topic?: string;
  isModuleComplete?: boolean;
  sessionId?: string; 
  
  // 50:50 Protocol Context
  modulesCompleted?: number;
  totalModules?: number;
  isExamComplete?: boolean;
}

export function UrlTutorView({ 
  videoUrl, 
  onTimeUpdate, 
  onComplete, 
  currentSegment,
  topic = "Web Video",
  isModuleComplete,
  sessionId,
  
  // New Metrics
  modulesCompleted = 0,
  totalModules = 1,
  isExamComplete = false
}: UrlTutorProps) {
  // 💎 ACCESS GLOBAL STORE
  const { markSegmentAsCompleted, completedSegmentIds, plan } = useVectorixStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const segmentRef = useRef(currentSegment);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isError, setIsError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

  // 🧠 BEHAVIORAL REFS
  const exitReason = useRef<"completed" | "midway_exit" | "error_exit">("midway_exit");
  const flowTimer = useRef<NodeJS.Timeout | null>(null);
  const rewindBuffer = useRef<number[]>([]);
  
  // 🧠 INTERVENTION STATE (Fix #2)
  const [activeIntervention, setActiveIntervention] = useState<any>(null);
  const lastAcknowledgedRef = useRef<string | null>(null);

  // --- 🧠 NEURAL TELEMETRY SENDER ---
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    const payload = {
      source: "url_tutor", // Distinct source for YouTube
      topic: topic,
      event_type: eventType,
      timestamp: Date.now() / 1000,
      session_id: sessionId || "url_video_pending",
      metadata: { ...metadata, video_time: currentTime }
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      // 💎 FIX 1: Identity Isolation
      headers: { "Content-Type": "application/json", "X-User-Id": sessionId || "anonymous" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }, [topic, sessionId, currentTime]);

  // --- 🧠 1. INTERVENTION POLLING (Fix #2) ---
  useEffect(() => {
    if (!sessionId) return;

    const pollIntervention = async () => {
        try {
            const res = await fetch(INTERVENTION_ENDPOINT, {
                headers: { "X-User-Id": sessionId || "anonymous" }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.should_intervene) {
                    setActiveIntervention(data);
                } else {
                    setActiveIntervention(null);
                    lastAcknowledgedRef.current = null;
                }
            }
        } catch (e) { /* silent fail */ }
    };

    const interval = setInterval(pollIntervention, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // --- 🧠 2. INTERVENTION HANDLER (Fix #2) ---
  useEffect(() => {
    if (!activeIntervention?.should_intervene) return;

    if (lastAcknowledgedRef.current === activeIntervention.strategy) return;
    lastAcknowledgedRef.current = activeIntervention.strategy;

    sendNeuralSignal("intervention_acknowledged", {
        strategy: activeIntervention.strategy,
        urgency: activeIntervention.urgency
    });

    if (
        activeIntervention.strategy.includes("Pause") || 
        activeIntervention.strategy.includes("Break")
    ) {
        // Auto-Pause for YouTube or Native
        if (isYouTube && ytPlayerRef.current?.pauseVideo) {
            ytPlayerRef.current.pauseVideo();
            setIsPlaying(false);
        } else if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

        sendNeuralSignal("auto_pause", {
            reason: "neural_intervention",
            strategy: activeIntervention.strategy
        });
        
        if (activeIntervention.urgency > 60) {
            toast.info(activeIntervention.reasoning, {
                icon: <Sparkles className="w-4 h-4 text-purple-400" />,
                duration: 5000
            });
        }
    }
  }, [activeIntervention, sendNeuralSignal, isYouTube]);

  useEffect(() => {
    segmentRef.current = currentSegment;
  }, [currentSegment]);

  // --- 🧠 FLOW STATE MANAGER ---
  const resetFlowState = () => {
    if (flowTimer.current) clearTimeout(flowTimer.current);
    if (isPlaying) {
        flowTimer.current = setTimeout(() => {
            sendNeuralSignal("deep_flow", { duration_sec: FLOW_THRESHOLD_MS / 1000 });
            resetFlowState(); 
        }, FLOW_THRESHOLD_MS);
    }
  };

  useEffect(() => {
    resetFlowState();
    return () => { if (flowTimer.current) clearTimeout(flowTimer.current); };
  }, [isPlaying]);

  // 🧠 SESSION TRACKING
  useEffect(() => {
    console.log(`🟢 [UrlTutor] MOUNTED. Session ID: "${sessionId}"`);
    if (videoUrl && !isError) {
        tracker.startSession(topic, sessionId);
        sendNeuralSignal("session_start", { video_url: videoUrl, provider: isYouTube ? "youtube" : "native" });
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
        
        console.log(`🔴 [UrlTutor] UNMOUNTING. Exit: ${exitReason.current}`);
        if (report.events.length > 0) {
            if (sessionId) { (report as any).session_id = sessionId; } 
            NeuralLogger.sendTelemetry(report);
        }

        sendNeuralSignal("session_end", { 
            exit_type: exitReason.current,
            progress: duration > 0 ? (currentTime / duration) : 0
        });
    };
  }, [videoUrl, topic, sessionId, modulesCompleted, totalModules, isExamComplete, completedSegmentIds, plan, sendNeuralSignal]); 

  // --- YOUTUBE LOGIC ---
  useEffect(() => {
    if (!isYouTube) return;
    
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { setIsError(true); return; }

    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
        if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e) {} }

        ytPlayerRef.current = new window.YT.Player('yt-player-frame', {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1 },
            events: {
                'onReady': (e: any) => {
                    setDuration(e.target.getDuration());
                    const latest = segmentRef.current;
                    if (latest) {
                        const start = parseTime(latest.timestamp_start);
                        if (start > 0) e.target.seekTo(start, true);
                    }
                },
                'onStateChange': (e: any) => {
                    const state = e.data;
                    const playing = state === window.YT.PlayerState.PLAYING;
                    setIsPlaying(playing);
                    
                    if (playing) {
                        tracker.log('video_play', 'YouTube Native Play');
                        sendNeuralSignal("play");
                    } else if (state === window.YT.PlayerState.PAUSED) {
                        tracker.log('video_pause', 'YouTube Native Pause');
                        sendNeuralSignal("pause");
                        // Fix #4: Flow break on pause
                        sendNeuralSignal("flow_break", { reason: "manual_pause" });
                    }
                    
                    if (state === 0) { // ENDED
                         exitReason.current = "completed";
                         tracker.log('video_complete', 'YouTube Finished');
                         
                         // Fix #3: Intervention Resolution
                         setActiveIntervention(null);
                         sendNeuralSignal("intervention_resolved", { reason: "session_complete" });
                         sendNeuralSignal("playback_complete");
                         
                         if (segmentRef.current?.id) markSegmentAsCompleted(segmentRef.current.id);
                         onComplete();
                    }
                },
                'onError': (e: any) => {
                    exitReason.current = "error_exit";
                    setIsError(true);
                    sendNeuralSignal("video_error", { code: e.data });
                }
            }
        });
    };

    if (window.YT && window.YT.Player) {
        window.onYouTubeIframeAPIReady();
    }
    
    return () => { 
        window.onYouTubeIframeAPIReady = undefined; 
        if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e) {} } 
    };
  }, [videoUrl, isYouTube]); 

  // Auto-Seek Logic
  useEffect(() => {
    if (currentSegment) {
        const start = parseTime(currentSegment.timestamp_start);
        
        if (Math.abs(currentTime - start) > 2) {
            tracker.log('video_seek', `Auto-Jump to Module: ${currentSegment.title}`);
            sendNeuralSignal("module_switch", { from: currentTime, to: start, module: currentSegment.title });

            if (isYouTube && ytPlayerRef.current?.seekTo) {
                ytPlayerRef.current.seekTo(start, true);
            } else if (!isYouTube && videoRef.current) {
                videoRef.current.currentTime = start;
            }
            tracker.startSegment(currentSegment.title);
        }
    }
  }, [currentSegment?.id, topic]);

  // Auto-Pause (Module Complete)
  useEffect(() => {
    if (isModuleComplete) {
        if (isYouTube && ytPlayerRef.current?.pauseVideo) {
            ytPlayerRef.current.pauseVideo();
            setIsPlaying(false);
        } else if (!isYouTube && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        sendNeuralSignal("auto_pause", { reason: "module_complete" });
    }
  }, [isModuleComplete, isYouTube]);

  // Sync Loop
  useEffect(() => {
    const interval = setInterval(() => {
      let curr = 0;
      let dur = 0;

      if (isYouTube && ytPlayerRef.current?.getCurrentTime) {
          curr = ytPlayerRef.current.getCurrentTime();
          dur = ytPlayerRef.current.getDuration();
      } else if (!isYouTube && videoRef.current) {
          curr = videoRef.current.currentTime;
          dur = videoRef.current.duration;
      }

      if (dur > 0) {
          setCurrentTime(curr);
          setDuration(dur);
          onTimeUpdate(curr);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isYouTube]);

  const togglePlay = () => {
    if (isYouTube && ytPlayerRef.current) {
        isPlaying ? ytPlayerRef.current.pauseVideo() : ytPlayerRef.current.playVideo();
    } else if (videoRef.current) {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
            sendNeuralSignal("play");
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            sendNeuralSignal("pause");
            // Fix #4: Flow break on pause
            sendNeuralSignal("flow_break", { reason: "manual_pause" });
        }
    }
  };

  const handleSeek = (vals: number[]) => {
    // 💎 SAFETY GUARD: Prevent seek on empty duration
    if (!duration || duration === 0) return;

    const newTime = (vals[0] / 100) * duration;
    tracker.logSeek(currentTime, newTime);

    // 🧠 CONFUSION LOGIC
    if (newTime < currentTime) {
        const now = Date.now();
        rewindBuffer.current = [...rewindBuffer.current, now].filter(t => now - t < CONFUSION_WINDOW_MS);
        if (rewindBuffer.current.length >= CONFUSION_THRESHOLD) {
            sendNeuralSignal("confusion_cluster", { rewinds: rewindBuffer.current.length });
            rewindBuffer.current = [];
        }
        sendNeuralSignal("rewind", { delta: newTime - currentTime });
    } else {
        sendNeuralSignal("seek_forward", { delta: newTime - currentTime });
    }

    if (isYouTube && ytPlayerRef.current) ytPlayerRef.current.seekTo(newTime, true);
    else if (videoRef.current) videoRef.current.currentTime = newTime;
    
    setCurrentTime(newTime);
  };

  return (
    <div className="w-full h-full relative bg-black group flex flex-col justify-center overflow-hidden"
         onMouseMove={() => setShowControls(true)}
         onMouseLeave={() => isPlaying && setShowControls(false)}>
      
      {isYouTube ? (
          <div id="yt-player-frame" className="w-full h-full pointer-events-none" />
      ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
            onClick={togglePlay}
            onEnded={() => {
                exitReason.current = "completed";
                tracker.log('video_complete', 'Video Finished');
                
                // Fix #3: Resolution Signal
                setActiveIntervention(null);
                sendNeuralSignal("intervention_resolved", { reason: "session_complete" });
                sendNeuralSignal("playback_complete");
                
                if (segmentRef.current?.id) markSegmentAsCompleted(segmentRef.current.id);
                onComplete();
            }}
            onError={(e) => {
                exitReason.current = "error_exit";
                setIsError(true);
                sendNeuralSignal("video_error", { code: "native_error" });
            }}
          />
      )}

      {isError && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
           <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
           <h3 className="text-xl font-bold text-white mb-2">Video Unavailable</h3>
           <Button variant="outline" onClick={() => { setIsError(false); if(videoRef.current) videoRef.current.load(); }}>
             <RefreshCcw className="w-4 h-4 mr-2" /> Retry
           </Button>
        </div>
      )}

      {!isModuleComplete && (
        <div className={cn("absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-40 transition-opacity duration-300", showControls ? "opacity-100" : "opacity-0")}>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs font-mono text-zinc-300 w-10 text-right">{formatTime(currentTime)}</span>
            <Slider value={[duration ? (currentTime/duration)*100 : 0]} max={100} step={0.1} onValueCommit={handleSeek} className="flex-1" />
            <span className="text-xs font-mono text-zinc-300 w-10">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-6">
             <Button variant="ghost" size="icon" onClick={() => { 
                 if (!duration) return; // 💎 Guard
                 const t = Math.max(0, currentTime - 10);
                 handleSeek([(t/duration)*100]); 
             }}><Rewind className="w-5 h-5 text-zinc-300" /></Button>
             
             <Button size="icon" className="bg-white text-black hover:bg-zinc-200 rounded-full h-12 w-12" onClick={togglePlay}>
               {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
             </Button>
             
             <Button variant="ghost" size="icon" onClick={() => { 
                 if (!duration) return; // 💎 Guard
                 const t = Math.min(duration, currentTime + 10);
                 handleSeek([(t/duration)*100]); 
             }}><FastForward className="w-5 h-5 text-zinc-300" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}