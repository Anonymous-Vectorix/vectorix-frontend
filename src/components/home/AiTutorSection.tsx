// src/components/tutor/AiTutorSection.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom"; 
import { useVectorixStore } from "@/contexts/VectorixStore";
import { NeuralLogger } from "@/lib/neural-logger";
import { tracker } from "@/lib/BehavioralTracker"; 
import { QuizSetupModal, type QuizConfig } from "@/components/shared/QuizSetupModal";
import {
  Brain, Upload, FileText, CheckCircle2, XCircle, Zap, Target, Send, User,
  XCircle as CloseIcon, Loader2, MonitorPlay, Activity, Bot, Play, Pause,
  Maximize2, Volume2, Gauge, MessageSquare, Rewind, FastForward, GraduationCap, Check,
  Cpu, Radio, ArrowRight, BookOpen, Sparkles, MoreVertical, Keyboard, Wand2,
  Link as LinkIcon, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MarkDownText } from "@/components/ui/MarkDownText";
import { cn } from "@/lib/utils";

// API Handling
import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// 🧠 NEURAL ENGINE CONFIGURATION
const NEURAL_ENDPOINT = `${API_BASE}/tutor/neural/log`;
const INTERVENTION_ENDPOINT = `${API_BASE}/tutor/neural/intervention`;
const IDLE_THRESHOLD_MS = 180000; 
const DEEP_FOCUS_THRESHOLD_MS = 90000; 

export function AiTutorSection({ segmentId }: { segmentId?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- STORE ACCESS ---
  const {
    tutorStatus, setTutorStatus,
    tutorSessionId, setTutorSessionId,
    tutorTopic, setTutorTopic,
    tutorFile, setTutorFile,
    tutorRawText, setTutorRawText,
    tutorStepData, setTutorStepData,
    tutorChatHistory, setTutorChatHistory,
    tutorInputType, setTutorInputType,
    systemInstruction,
    setActiveContext 
  } = useVectorixStore();

  const [tutorUrl, setTutorUrl] = useState("");
  const isVideoMode = location.state?.sessionType === 'video_lecture';
  const videoSegment = location.state?.segmentContext;

  const lectureInputRef = useRef<HTMLInputElement>(null);
  
  // --- UI STATE ---
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [loadingText, setLoadingText] = useState("Initializing...");
  
  // --- PLAYBACK STATE ---
  const [displayedContent, setDisplayedContent] = useState(""); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [totalTime, setTotalTime] = useState("--:--"); 
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [userHasScrolled, setUserHasScrolled] = useState(false); 
  const [isDragging, setIsDragging] = useState(false); 
  
  // --- INTERACTION STATE ---
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isNextLoading, setIsNextLoading] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  
  // --- REFS ---
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lectureScrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();
  const contentRef = useRef<string>(""); 
  const milestonesReached = useRef<Set<number>>(new Set());
  const activeAudioUrl = useRef<string | null>(null);

  // FLAGS: Session Safety Guards
  const isTransitioningRef = useRef(false);
  const isSessionFinishedRef = useRef(false);
  
  // 🧠 BEHAVIORAL STATE REFS
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const focusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const lastPromptTimeRef = useRef<number>(0);
  const hasLoggedIdleRef = useRef<boolean>(false);
  const hasLoggedFocusRef = useRef<boolean>(false);
  const skipCountRef = useRef(0); 
  
  // 🧠 INTERVENTION STATE
  const [activeIntervention, setActiveIntervention] = useState<any>(null);
  const lastAcknowledgedRef = useRef<string | null>(null);
  const lastInterventionToastRef = useRef<number>(0); 

  // 🧠 STABLE IDENTITY GENERATOR
  const getStableUserId = useCallback(() => {
    try {
      let uid = localStorage.getItem("vectorix_uid");
      if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem("vectorix_uid", uid);
      }
      return uid;
    } catch {
      return "anonymous_session_" + Date.now();
    }
  }, []);
  const userId = useRef(getStableUserId()).current;

  // --- 🧠 NEURAL TELEMETRY SENDER ---
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    if (!tutorTopic && eventType !== "session_start") return;

    const payload = {
      source: "ai_tutor",
      topic: tutorTopic || "Uninitialized Session",
      event_type: eventType,
      timestamp: Date.now() / 1000,
      session_id: tutorSessionId || "pending_session",
      metadata: metadata
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(err => console.debug("[Neural] Telemetry drop:", err));
  }, [tutorTopic, tutorSessionId, userId]);

  // --- 🧠 1. SESSION LIFECYCLE ---
  useEffect(() => {
    sendNeuralSignal("session_start", { mode: isVideoMode ? "video" : "tutor" });

    // ✅ CLEANUP ON MOUNT (Unless resuming active session)
    if (tutorStatus === "setup" || !tutorSessionId) {
        setTutorFile(null);
        setTutorRawText("");
        setTutorTopic("");
    }

    return () => {
      sendNeuralSignal("session_end", { 
        duration: (Date.now() - lastInteractionRef.current) / 1000 
      });

      if (
          tutorStatus === "active" && 
          tutorSessionId && 
          !isTransitioningRef.current && 
          !isSessionFinishedRef.current
      ) {
         console.log("[TutorSection] Unmounting & Ending Session");
         const report = tracker.endSession();
         if (report.events.length > 0) {
            (report as any).session_id = tutorSessionId; 
            NeuralLogger.sendTelemetry(report);
         }
      }
    };
  }, []); 

  // --- 🧠 2. IDLE & DEEP FOCUS TRACKING ---
  useEffect(() => {
    const resetTimers = () => {
      lastInteractionRef.current = Date.now();
      hasLoggedIdleRef.current = false;
      
      // Reset Idle Timer
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!hasLoggedIdleRef.current) {
          sendNeuralSignal("idle", { duration_ms: IDLE_THRESHOLD_MS });
          hasLoggedIdleRef.current = true;
        }
      }, IDLE_THRESHOLD_MS);

      // Deep Focus: If typing continues without long breaks
      if (!hasLoggedFocusRef.current && chatInput.length > 20) {
          if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
          focusTimerRef.current = setTimeout(() => {
              sendNeuralSignal("deep_focus", { duration_ms: DEEP_FOCUS_THRESHOLD_MS });
              hasLoggedFocusRef.current = true; 
          }, DEEP_FOCUS_THRESHOLD_MS);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) sendNeuralSignal("tab_hidden", { timestamp: Date.now() });
      else {
          sendNeuralSignal("tab_visible", { time_away_ms: Date.now() - lastInteractionRef.current });
          resetTimers();
      }
    };

    window.addEventListener("click", resetTimers);
    window.addEventListener("keydown", resetTimers);
    document.addEventListener("visibilitychange", handleVisibility);
    resetTimers();

    return () => {
      window.removeEventListener("click", resetTimers);
      window.removeEventListener("keydown", resetTimers);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [sendNeuralSignal, chatInput]);

  // --- 🧠 3. INTERVENTION POLLING ---
  useEffect(() => {
    if (!tutorSessionId) return;
    const pollIntervention = async () => {
        try {
            const res = await fetch(INTERVENTION_ENDPOINT, {
                headers: { "X-User-Id": userId }
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
        } catch (e) { /* silent */ }
    };
    const interval = setInterval(pollIntervention, 15000); 
    return () => clearInterval(interval);
  }, [tutorSessionId, userId]);

  // --- 🧠 4. INTERVENTION HANDLER ---
  useEffect(() => {
    if (!activeIntervention?.should_intervene) return;
    if (lastAcknowledgedRef.current === activeIntervention.strategy) return;
    
    lastAcknowledgedRef.current = activeIntervention.strategy;
    sendNeuralSignal("intervention_acknowledged", { strategy: activeIntervention.strategy });

    // Soft Nudge (Toast only, no blocking)
    const now = Date.now();
    if (activeIntervention.urgency > 60 && (now - lastInterventionToastRef.current > 120000)) {
        toast.info("AI Coach: " + activeIntervention.reasoning, {
            icon: <Sparkles className="w-4 h-4 text-purple-400" />,
            duration: 6000
        });
        lastInterventionToastRef.current = now;
    }
  }, [activeIntervention, sendNeuralSignal]);

  // --- 🧠 5. CONTENT CONSUMPTION ---
  useEffect(() => {
    if (displayedContent) {
      sendNeuralSignal("content_rendered", { 
        length: displayedContent.length,
        is_audio_active: isPlaying 
      });
    }
  }, [displayedContent, isPlaying, sendNeuralSignal]);

  const handleGlobalClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    const input = target.closest("input, textarea");

    if (button || input) {
      const label = button?.textContent || button?.getAttribute("aria-label") || input?.getAttribute("placeholder") || "interaction";
      sendNeuralSignal("click", { 
        target: label.substring(0, 30), 
        type: button ? "button" : "input"
      });
    }
  };

  useEffect(() => {
    if (isVideoMode && videoSegment) {
      setTutorStatus("active");
      setTutorTopic(videoSegment.title);
      setTutorStepData({
        type: 'lecture',
        title: videoSegment.title,
        content: `### ${videoSegment.title}\n\n${videoSegment.summary}`,
        mastery: 0
      } as any);
      
      const vidSessionId = (location.state as any)?.sessionId;
      if (vidSessionId) setTutorSessionId(vidSessionId);
    }
  }, [isVideoMode, videoSegment]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [tutorChatHistory]);

  const handleLectureScroll = () => {
    if (!lectureScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = lectureScrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (!userHasScrolled && scrollTop > 100) {
      sendNeuralSignal("scroll_engage", { position: scrollTop });
    }
    
    setUserHasScrolled(!isAtBottom);
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (activeAudioUrl.current) { URL.revokeObjectURL(activeAudioUrl.current); activeAudioUrl.current = null; }
    
    setIsAudioReady(false);
    setIsPlaying(false);
    setUserHasScrolled(false); 
    milestonesReached.current.clear();
    setPlaybackProgress(0);
    setCurrentTime("00:00");

    const currentStep = tutorStepData as any;
    if (currentStep) tracker.startSegment(currentStep.title || "Lecture Segment");

    if (currentStep && currentStep.type === 'lecture' && currentStep.content && !isVideoMode) {
      const fullText = currentStep.content;
      contentRef.current = fullText;
      setDisplayedContent(fullText.slice(0, 100) + "..."); 
      
      const fetchAudio = async () => {
        try {
          const cleanText = fullText.replace(/[#*`_]/g, ''); 
          const res = await fetch(`${API_BASE}/tutor/speak`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
            body: JSON.stringify({ text: cleanText }) 
          });
          
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            activeAudioUrl.current = url;
            if (audioRef.current) {
              audioRef.current.src = url;
              audioRef.current.playbackRate = playbackSpeed;
              audioRef.current.onloadedmetadata = () => {
                 const d = audioRef.current?.duration || 0;
                 setTotalTime(formatTime(Number.isFinite(d) ? d : 0)); 
                 setIsAudioReady(true);
                 audioRef.current?.play().then(() => {
                    setIsPlaying(true);
                    tracker.log('video_play', 'Auto-play start'); 
                    sendNeuralSignal("audio_autoplay"); 
                 }).catch(() => {});
                 setDisplayedContent(""); 
              };
            }
          }
        } catch (e) { 
          console.error("Audio failed", e); 
          setDisplayedContent(fullText); 
        }
      };
      fetchAudio();
    } else if (isVideoMode && currentStep?.content) {
        contentRef.current = currentStep.content;
        setDisplayedContent(currentStep.content);
        setIsAudioReady(false); 
    } else if ((tutorStepData as any)?.type === 'quiz') {
       setIsPlaying(false);
    }
    
    return () => { if (activeAudioUrl.current) URL.revokeObjectURL(activeAudioUrl.current); };
  }, [tutorStepData, isVideoMode, sendNeuralSignal, userId]);

  useEffect(() => {
    let lastCharIndex = 0;
    const syncLoop = () => {
      const audio = audioRef.current;
      if (audio && isAudioReady) {
        const duration = (Number.isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 1;
        const current = audio.currentTime;
        const percent = (current / duration) * 100;
        if (!isDragging) setPlaybackProgress(Number.isFinite(percent) ? percent : 0);
        setCurrentTime(formatTime(current));
        if (contentRef.current && !isVideoMode) {
            const totalChars = contentRef.current.length;
            const rawIndex = Math.ceil((current / duration) * totalChars);
            const charIndex = Math.min(totalChars, rawIndex + 20); 
            if (charIndex > lastCharIndex) {
                 setDisplayedContent(contentRef.current.slice(0, charIndex));
                 lastCharIndex = charIndex;
            }
        }
      }
      if (isPlaying) animationFrameRef.current = requestAnimationFrame(syncLoop);
    };
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(syncLoop);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying, isAudioReady, isDragging, isVideoMode]);

  const formatTime = (t: number) => {
    if (!Number.isFinite(t)) return "00:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
  };

  const togglePlay = () => {
    if (!audioRef.current || !isAudioReady) return;
    if (isPlaying) { 
      audioRef.current.pause(); 
      setIsPlaying(false); 
      tracker.log('video_pause', currentTime);
      sendNeuralSignal("pause", { timestamp: currentTime });
    } 
    else { 
      audioRef.current.play(); 
      setIsPlaying(true); 
      tracker.log('video_play', currentTime); 
      sendNeuralSignal("play", { timestamp: currentTime });
    }
  };

  const handleSeekChange = (vals: number[]) => { 
    setIsDragging(true); 
    setPlaybackProgress(vals[0]); 
    sendNeuralSignal("seek_start", { from: playbackProgress });
  };

  const handleSeekCommit = (vals: number[]) => {
      if (audioRef.current && isAudioReady) {
          const duration = audioRef.current.duration || 1;
          const newTime = (vals[0] / 100) * duration;
          const oldTime = audioRef.current.currentTime; 
          audioRef.current.currentTime = newTime;
          tracker.logSeek(oldTime, newTime); 
          sendNeuralSignal(newTime < oldTime ? "seek_back" : "seek_forward", { 
            delta: newTime - oldTime 
          });
      }
      setIsDragging(false);
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const newSpeed = speeds[speeds.indexOf(playbackSpeed) + 1] || speeds[0];
    setPlaybackSpeed(newSpeed);
    tracker.log('video_speed', newSpeed); 
    
    if (newSpeed > 1.5) {
        sendNeuralSignal("cognitive_overload", { speed: newSpeed, type: "high_speed_audio" });
    } else {
        sendNeuralSignal("speed_change", { speed: newSpeed });
    }
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current || !isAudioReady) return;
    const oldTime = audioRef.current.currentTime;
    const newTime = Math.max(0, Math.min(audioRef.current.duration, oldTime + seconds));
    audioRef.current.currentTime = newTime;
    tracker.logSeek(oldTime, newTime); 
    
    skipCountRef.current += 1;
    if (skipCountRef.current > 2) {
        sendNeuralSignal("cognitive_overload", { type: "rapid_skipping" });
        skipCountRef.current = 0;
    } else {
        sendNeuralSignal("skip_forward", { seconds });
    }
    setTimeout(() => { skipCountRef.current = Math.max(0, skipCountRef.current - 1); }, 5000);
  };

  // --- CORE LOGIC ---

  const completeSession = () => {
    const effectiveId = tutorSessionId || segmentId || tutorTopic || "General";
    isSessionFinishedRef.current = true; 

    NeuralLogger.log('tutor', tutorTopic, 'task_complete', 100, undefined, { session_id: effectiveId });
    tracker.log('video_complete', 'Session Finished Manually');
    
    setActiveIntervention(null);
    hasLoggedFocusRef.current = false;
    sendNeuralSignal("intervention_resolved", { reason: "session_complete" });
    sendNeuralSignal("session_complete_manual");

    const report = tracker.endSession({ modulesCompleted: 1, totalModules: 1 });
    (report as any).session_id = effectiveId;
    NeuralLogger.sendTelemetry(report);

    setTutorStatus("complete");
  };

  const fetchNext = async (sid: string) => {
    if (isVideoMode) return;
    setIsNextLoading(true);
    hasLoggedFocusRef.current = false; 
    sendNeuralSignal("fetch_next_start"); 
    try {
      const res = await fetch(`${API_BASE}/tutor/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
        body: JSON.stringify({ session_id: sid }),
      });
      const data = await res.json();
      if (data.type === "completion") { completeSession(); } 
      else {
        setTutorStepData(data);
        setTutorStatus("active");
        setSelectedOption(null);
        setFeedback(null);
        sendNeuralSignal("step_loaded", { type: data.type });
      }
    } catch (e) { toast.error("Failed to load content."); } 
    finally { setIsNextLoading(false); }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    tracker.log('video_pause', 'Audio Ended Naturally'); 
    sendNeuralSignal("audio_complete"); 
    if (contentRef.current) setDisplayedContent(contentRef.current);
  };

  const handleStart = async (mode: 'lecture' | 'mastery' = 'lecture') => {
    let currentTopic = tutorTopic;
    const currentFile = tutorFile;

    if (!currentTopic.trim()) {
      if (currentFile) { currentTopic = `Lecture: ${currentFile.name}`; setTutorTopic(currentTopic); } 
      else if (tutorUrl) { currentTopic = `Lecture: Web Resource`; setTutorTopic(currentTopic); } 
      else if (tutorRawText.trim()) { currentTopic = "Lecture: Custom Notes"; setTutorTopic(currentTopic); } 
      else { return toast.error("Please enter a learning goal."); }
    }
    
    if (tutorInputType === "pdf" && !currentFile) return toast.error("Please upload a PDF file.");
    if (tutorInputType === "text" && !tutorRawText.trim()) return toast.error("Please enter some text.");

    setTutorStatus("loading");
    setLoadingText("Initializing Neural Stream...");
    sendNeuralSignal("generation_start", { mode });

    try {
      if (tutorInputType === "pdf" && currentFile) {
        const formData = new FormData();
        formData.append("file", currentFile);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => setLoadingText("Deep Scanning OCR (Heavy Document)..."), 15000);
        const ocrTimeout = setTimeout(() => controller.abort(), 300000);

        const upRes = await fetch(`${API_BASE}/upload-pdf`, { method: "POST", body: formData, signal: controller.signal, headers: { "X-User-Id": userId } }); 
        clearTimeout(timeoutId); clearTimeout(ocrTimeout);
        if (!upRes.ok) throw new Error("Upload failed");
      } else {
        // ✅ FIX: Robust Text Upload Handling
        const textPayload = tutorRawText.trim(); 
        
        const upRes = await fetch(`${API_BASE}/upload-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
          body: JSON.stringify({ text: textPayload }),
        });
        
        if (!upRes.ok) throw new Error("Text Upload failed");
        
        // Parse response to detect actual topic and avoid "Custom Notes" collision
        try {
            const data = await upRes.json();
            const detectedTitle = data.title || data.topic;

            if (detectedTitle && detectedTitle !== "Raw Text Upload") {
                currentTopic = detectedTitle;
                setTutorTopic(currentTopic); 
                toast.success(`Topic Detected: ${currentTopic}`);
            } else if (currentTopic === "Lecture: Custom Notes") {
                // Fallback: If AI didn't name it, extract from first line to force relevant context
                const fallbackTitle = textPayload.split('\n')[0].substring(0, 50).replace(/[#*]/g, '').trim();
                if (fallbackTitle.length > 5) {
                   currentTopic = fallbackTitle;
                   setTutorTopic(currentTopic);
                }
            }
        } catch (e) {
            console.warn("Could not parse text response", e);
        }
      }

      setLoadingText("Generating Lecture Script...");
      const startRes = await fetch(`${API_BASE}/tutor/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
        body: JSON.stringify({ topic: currentTopic, mode: 'lecture' }),
      });
      if (!startRes.ok) throw new Error("Failed to start session");
      
      const { session_id } = await startRes.json();
      
      setTutorSessionId(session_id);
      tracker.startSession(`AI Tutor: ${currentTopic}`, session_id);
      sendNeuralSignal("session_initialized", { session_id });
      await fetchNext(session_id);
      
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Connection failed.");
      setTutorStatus("setup");
      sendNeuralSignal("generation_fail", { error: e.message });
    }
  };

  const handleTeachMeMore = async () => {
    if (!tutorSessionId) return;
    setIsExtending(true);
    hasLoggedFocusRef.current = false; 
    tracker.log('video_seek', 'Extend Lecture'); 
    sendNeuralSignal("extend_request");
    try {
        const res = await fetch(`${API_BASE}/tutor/extend`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
            body: JSON.stringify({ session_id: tutorSessionId }),
        });
        if (!res.ok) throw new Error("Failed to extend");
        const data = await res.json();
        if (data.success) {
            toast.success("Lecture Extended");
            setTutorStatus("active"); 
            await fetchNext(tutorSessionId); 
        }
    } catch (e) { toast.error("Error extending lecture."); } 
    finally { setIsExtending(false); }
  };

  const handleAnswer = async (option: string) => {
    if (feedback || !tutorStepData || !tutorSessionId) return;
    setSelectedOption(option);
    const isCorrect = option === (tutorStepData as any).answer;
    setFeedback(isCorrect ? "correct" : "wrong");
    
    hasLoggedFocusRef.current = false;

    NeuralLogger.log('tutor', tutorTopic, isCorrect ? 'correct_answer' : 'wrong_answer', isCorrect ? 10 : 0, segmentId || tutorTopic, { session_id: tutorSessionId });
    tracker.log(isCorrect ? 'quiz_answer_select' : 'quiz_answer_select', `Option: ${option} (${isCorrect ? 'Correct' : 'Wrong'})`);
    sendNeuralSignal("quiz_answer", { correct: isCorrect, option });

    await fetch(`${API_BASE}/tutor/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId }, 
      body: JSON.stringify({ session_id: tutorSessionId, is_correct: isCorrect }),
    });
    setTimeout(() => { setTutorStepData(null); fetchNext(tutorSessionId); }, isCorrect ? 1200 : 2000);
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    if (!tutorSessionId && !isVideoMode) return;
    
    const message = chatInput;
    
    const now = Date.now();
    const interval = (now - lastPromptTimeRef.current) / 1000;
    
    if (interval < 10) {
        sendNeuralSignal("rapid_retry", { interval_sec: interval });
    }
    
    const confusionKeywords = ["explain again", "confused", "didn't understand", "one more time", "still don't get"];
    const isPanicTyping = message.length < 15 || (message.match(/\?/g) || []).length > 2; 
    
    if (isPanicTyping || confusionKeywords.some(k => message.toLowerCase().includes(k))) {
        sendNeuralSignal("confusion_signal", { 
            phrase: isPanicTyping ? "panic_typing" : "keyword_match",
            length: message.length
        });
    }

    lastPromptTimeRef.current = now;
    setChatInput("");
    hasLoggedFocusRef.current = false; 
    tracker.log('doubt_query', message); 
    sendNeuralSignal("chat_query", { length: message.length });

    const newHistory = [...tutorChatHistory, { role: "user" as const, text: message }];
    setTutorChatHistory(newHistory);
    setChatLoading(true);
    try {
      let endpoint = `${API_BASE}/tutor/chat`;
      let body: any = { session_id: tutorSessionId, message };
      if (isVideoMode) {
        endpoint = `${API_BASE}/chat/video-tutor`;
        body = { message: message, system_instruction: systemInstruction || "You are a helpful tutor.", history: tutorChatHistory.map(m => ({ role: m.role, text: m.text })) };
      }
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-User-Id": userId }, body: JSON.stringify(body) }); 
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      const aiReply = data.answer || data.response || data.message || data.text || JSON.stringify(data); 
      setTutorChatHistory([...newHistory, { role: "ai", text: typeof aiReply === 'string' ? aiReply : JSON.stringify(aiReply) }]);
    } catch (err) { setTutorChatHistory([...newHistory, { role: "ai", text: "Connection lost." }]); } 
    finally { setChatLoading(false); }
  };

  const handleReset = () => {
    // ✅ FIX: Strict Memory Wipe
    if (tutorStatus === "active") {
        const report = tracker.endSession();
        if (tutorSessionId) (report as any).session_id = tutorSessionId;
        NeuralLogger.sendTelemetry(report);
    }
    sendNeuralSignal("session_reset"); 
    setTutorStatus("setup");
    setTutorSessionId(null);
    setTutorStepData(null);
    setTutorChatHistory([]);
    setTutorFile(null); // Explicit clear
    setTutorRawText(""); // Explicit clear
    setTutorTopic("");   // Explicit clear
    
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (activeAudioUrl.current) { URL.revokeObjectURL(activeAudioUrl.current); activeAudioUrl.current = null; }
  };

  // ✅ FIX: Helper to ensure mutual exclusivity
  const handleInputSwitch = (type: 'pdf' | 'text') => {
      setTutorInputType(type);
      if (type === 'pdf') setTutorRawText(""); // Clear text if switching to PDF
      if (type === 'text') setTutorFile(null); // Clear file if switching to Text
  };

  const handleQuizStart = (config: QuizConfig) => {
    isTransitioningRef.current = true;
    sendNeuralSignal("quiz_transition"); 

    setActiveContext({
        source: 'tutor',
        topic: tutorTopic,
        sessionId: tutorSessionId || undefined, 
        returnPath: '/ai-tutor'
    });

    tracker.log('quiz_view', 'User started quiz from Tutor');
    setShowQuizModal(false);
    
    navigate("/tutor-test", {
      state: {
        sourceType: "tutor",
        topic: tutorTopic,
        config: config,
        sessionId: tutorSessionId 
      }
    });
  };

  // --- RENDER ---
  if (tutorStatus === "setup" && !isVideoMode) return (
      <div onClick={handleGlobalClick} className="relative min-h-[85vh] w-full flex flex-col items-center justify-center py-10 px-4 font-sans overflow-hidden">
        <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-12 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center space-y-6">
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9]">Vectorix <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 animate-pulse-glow">Tutor Engine</span></h1>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed font-light">Transform static documents into dynamic, voice-narrated lectures. The AI becomes your personal professor.</p>
          </div>
          <div className="w-full max-w-2xl flex flex-col gap-8">
            <Card className="p-1 bg-[#0A0A0A]/60 border border-white/10 backdrop-blur-3xl rounded-[32px] shadow-2xl relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 opacity-50" />
                <div className="p-8 md:p-12 flex flex-col gap-10">
                    <div className="space-y-1 relative z-10 text-center">
                      <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2 uppercase tracking-wider"><Upload className="w-5 h-5 text-emerald-400" /> Upload Material</h3>
                      <p className="text-xs text-zinc-500 font-medium">Select source material for analysis</p>
                    </div>
                    <div className="p-1.5 bg-black/40 rounded-xl border border-white/5 flex gap-2 w-full max-w-md mx-auto">
                      <button onClick={() => handleInputSwitch('pdf')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", tutorInputType === 'pdf' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white hover:bg-white/5")}><FileText className="w-3 h-3" /> PDF</button>
                      <button onClick={() => handleInputSwitch('text')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", tutorInputType === 'text' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white hover:bg-white/5")}><Keyboard className="w-3 h-3" /> Text</button>
                    </div>
                    <div className="relative min-h-[256px] flex flex-col">
                        {tutorInputType === 'pdf' && (
                            <div onClick={() => lectureInputRef.current?.click()} className="h-64 border-2 border-dashed border-white/10 bg-white/[0.01] rounded-[24px] flex flex-col items-center justify-center hover:bg-white/[0.03] hover:border-emerald-500/30 transition-all cursor-pointer group/zone overflow-hidden w-full">
                              <input ref={lectureInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setTutorFile(file); }} />
                              {tutorFile ? (
                                <div className="text-center space-y-4 animate-in fade-in zoom-in">
                                  <div className="mx-auto h-20 w-20 rounded-[20px] bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]"><CheckCircle2 className="h-10 w-10 text-emerald-500" /></div>
                                  <div><h3 className="text-xl font-bold text-white">{tutorFile.name}</h3><p className="text-xs font-bold text-emerald-400 mt-1 uppercase tracking-wider">Ready for Analysis</p></div>
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setTutorFile(null); }} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10">Remove File</Button>
                                </div>
                              ) : (
                                <>
                                  <div className="w-24 h-24 bg-[#0B0C15] rounded-full flex items-center justify-center mb-6 group-hover/zone:scale-110 transition-all duration-300 border border-white/5 relative z-10"><Upload className="w-10 h-10 text-zinc-500 group-hover/zone:text-emerald-400 transition-colors" /></div>
                                  <p className="text-sm font-bold text-white tracking-wide relative z-10">Click to Upload PDF</p>
                                  <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest font-medium relative z-10">Max Size 50MB</p>
                                </>
                              )}
                            </div>
                        )}
                        {tutorInputType === 'text' && (
                            <div className="h-64 flex flex-col gap-4 animate-in fade-in">
                                <textarea value={tutorRawText} onChange={(e) => setTutorRawText(e.target.value)} placeholder="Paste your lecture notes..." className="w-full h-full bg-white/[0.03] border border-white/10 rounded-[24px] p-6 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-all font-mono leading-relaxed" />
                            </div>
                        )}
                    </div>
                </div>
            </Card>
            <Button onClick={() => handleStart('lecture')} disabled={(tutorInputType === 'pdf' && !tutorFile) || (tutorInputType === 'text' && !tutorRawText.trim())} className="w-full h-16 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-sm uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_40px_-5px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              <div className="flex items-center gap-3"><Wand2 className="w-5 h-5" /><span>Generate Lecture</span></div>
            </Button>
          </div>
        </div>
      </div>
  );

  if (tutorStatus === "loading") return ( 
      <div className="h-full flex flex-col items-center justify-center space-y-8 relative overflow-hidden font-sans min-h-[60vh]">
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
           <div className="relative"><div className="w-24 h-24 border-2 border-white/5 rounded-full" /><div className="absolute inset-0 w-24 h-24 border-2 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_50px_rgba(16,185,129,0.4)]" /></div>
           <div className="mt-10 text-center space-y-3"><p className="text-white font-bold text-lg tracking-[0.2em] uppercase animate-pulse">{loadingText}</p><div className="flex items-center justify-center gap-2 text-xs text-zinc-500 font-mono"><Cpu className="w-3 h-3" /><span>Syncing Pathways...</span></div></div>
        </div>
      </div>
  );

  if ((tutorStatus === "active" && tutorStepData) || isVideoMode) return (
    <section onClick={handleGlobalClick} className="fixed inset-0 z-50 flex flex-col overflow-hidden font-sans bg-transparent selection:bg-emerald-500/30">
      <audio ref={audioRef} className="hidden" onEnded={handleAudioEnd} />
      <header className="h-20 flex items-center justify-between px-8 shrink-0 z-50">
        <div className="flex items-center gap-5 bg-black/20 backdrop-blur-xl border border-white/5 px-4 py-2 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600/20 to-blue-600/20 border border-white/10 flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-emerald-300" /></div>
          <div><span className="text-sm font-bold text-white block tracking-wide">{isVideoMode ? "AI Professor (Video Mode)" : "AI Tutor Stream"}</span><div className="flex items-center gap-2 mt-0.5"><span className={`w-1.5 h-1.5 rounded-full ${isAudioReady ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-yellow-500"}`} /><span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.15em]">{isAudioReady ? "Live Audio" : (isVideoMode ? "Audio Disabled" : "Buffering...")}</span></div></div>
        </div>
        <div className="flex items-center gap-3">
            <Button onClick={completeSession} variant="outline" className="h-10 px-5 border-white/10 bg-black/20 backdrop-blur-md text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-[10px] font-bold uppercase tracking-widest hidden md:flex rounded-xl transition-all hover:border-emerald-500/30"><Check className="w-4 h-4 mr-2" /> Finish</Button>
            <Button variant="ghost" size="icon" onClick={handleReset} className="hover:bg-red-500/10 hover:text-red-400 rounded-xl w-10 h-10 transition-colors bg-black/20 backdrop-blur-md border border-white/5"><CloseIcon className="w-5 h-5" /></Button>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative z-10 px-6 pb-6 gap-6">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-[#0A0A0A]/60 backdrop-blur-3xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="flex-1 relative overflow-hidden flex flex-col">
             <div ref={lectureScrollRef} onScroll={handleLectureScroll} className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar scroll-smooth">
                <div className="max-w-4xl mx-auto space-y-8 pb-40"> 
                   {(tutorStepData as any)?.type === "quiz" ? (
                      <div className="py-12 flex flex-col items-center justify-center">
                        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[40px] p-12 shadow-2xl relative overflow-hidden w-full text-center group">
                            <h3 className="text-4xl font-black text-white mb-6 tracking-tight">Checkpoint</h3>
                            <p className="text-zinc-300 text-xl mb-10 font-light leading-relaxed">{(tutorStepData as any).question}</p>
                            <div className="grid grid-cols-1 gap-4 w-full max-w-2xl mx-auto">
                              {(tutorStepData as any).options?.map((opt: string, i: number) => {
                                let style = "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300";
                                if (selectedOption === opt) {
                                   if (feedback === "correct") style = "border-emerald-500/50 bg-emerald-500/10 text-white shadow-[0_0_30px_rgba(16,185,129,0.2)]";
                                   else if (feedback === "wrong") style = "border-red-500/50 bg-red-500/10 text-white shadow-[0_0_30px_rgba(239,68,68,0.2)]";
                                   else style = "border-blue-500/50 bg-blue-500/10 text-white shadow-[0_0_30px_rgba(59,130,246,0.2)]";
                                }
                                return (<button key={i} onClick={() => handleAnswer(opt)} disabled={!!feedback} className={`p-6 rounded-2xl border text-base font-medium transition-all flex justify-between items-center group ${style}`}><span>{opt}</span>{selectedOption === opt && feedback === "correct" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}{selectedOption === opt && feedback === "wrong" && <XCircle className="w-5 h-5 text-red-400" />}</button>);
                              })}
                            </div>
                        </div>
                      </div>
                   ) : (
                      <div className="relative">
                         <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-200 prose-headings:text-white prose-strong:text-emerald-300 prose-li:text-zinc-300 leading-loose tracking-wide mix-blend-plus-lighter"><MarkDownText content={displayedContent} /></div>
                         {!isAudioReady && !isVideoMode && (<div className="mt-8 flex items-center gap-3 text-xs text-emerald-300 font-mono animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full w-fit"><Loader2 className="w-4 h-4 animate-spin" /> <span className="uppercase tracking-widest">Generating Voice...</span></div>)}
                      </div>
                   )}
                </div>
             </div>
             {!isVideoMode && (
               <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-30">
                   <div className="bg-[#0E1016]/80 backdrop-blur-2xl border border-white/10 rounded-[30px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-6 pr-4 hover:border-white/20 transition-all ring-1 ring-white/5">
                       <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] shrink-0">{isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}</button>
                       <div className="flex-1 flex flex-col justify-center gap-2"><Slider value={[playbackProgress]} max={100} step={0.1} onValueChange={handleSeekChange} onValueCommit={handleSeekCommit} className="cursor-pointer py-1" /><div className="flex justify-between px-1"><span className="text-[10px] font-bold text-zinc-400 font-mono">{currentTime}</span><span className="text-[10px] font-bold text-zinc-500 font-mono">{totalTime}</span></div></div>
                       <div className="flex items-center gap-3">
                           <button onClick={cycleSpeed} className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all">{playbackSpeed}x</button>
                           <button onClick={() => skipTime(10)} className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all"><FastForward className="w-5 h-5" /></button>
                           <Button onClick={() => tutorSessionId && fetchNext(tutorSessionId)} disabled={isNextLoading} size="sm" className="h-10 px-5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-xl shadow-lg font-bold uppercase text-[10px] tracking-widest border border-white/10">{isNextLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Next"}</Button>
                       </div>
                   </div>
               </div>
             )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-[420px] bg-[#0A0A0A]/60 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.3)] rounded-r-[32px] overflow-hidden shrink-0">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.01]">
             <div className="flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"><MessageSquare className="w-4 h-4 text-emerald-400" /></div><span className="text-xs font-bold text-white uppercase tracking-[0.2em]">Vectorix Chat</span></div><MoreVertical className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar" ref={chatScrollRef}>
              {tutorChatHistory.map((msg, i) => (<div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-lg ${msg.role === 'ai' ? 'bg-gradient-to-br from-emerald-600/20 to-blue-600/20 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800/50 border-white/10 text-zinc-400'}`}>{msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}</div><div className={`px-5 py-4 text-sm max-w-[85%] leading-relaxed shadow-lg backdrop-blur-md ${msg.role === 'user' ? 'bg-gradient-to-br from-emerald-600/80 to-blue-600/80 text-white rounded-2xl rounded-tr-sm border border-white/10' : 'bg-white/[0.03] border border-white/5 text-zinc-200 rounded-2xl rounded-tl-sm hover:bg-white/[0.05] transition-colors'}`}><MarkDownText content={msg.text} /></div></div>))}
              {chatLoading && <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>}
          </div>
          <div className="p-5 border-t border-white/5 bg-white/[0.01]"><form onSubmit={handleChatSubmit} className="relative group"><div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl opacity-0 group-hover:opacity-40 blur transition duration-500" /><Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask a doubt..." className="relative bg-[#0B0C15]/60 border-white/10 pr-12 h-14 text-white rounded-2xl focus-visible:ring-emerald-500/50 shadow-inner text-sm placeholder:text-zinc-600 transition-all backdrop-blur-xl" /><Button type="submit" size="icon" className="absolute right-2 top-2 h-10 w-10 bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-xl transition-all" disabled={chatLoading}><Send className="w-4 h-4" /></Button></form></div>
        </div>
      </div>
    </section>
  );
  if (tutorStatus === "complete") {
  return (
    <div className="h-screen bg-transparent flex flex-col items-center justify-center text-center p-6 animate-in zoom-in-95 duration-700 font-sans">
      <div className="w-32 h-32 bg-[#0E1016] rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_60px_-10px_rgba(16,185,129,0.3)] mb-10 relative z-10 animate-float">
        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
      </div>
      <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter relative z-10">
        Session Complete
      </h2>
      <div className="flex flex-col sm:flex-row gap-5 relative z-10">
        <Button
          variant="outline"
          onClick={handleReset}
          className="h-14 px-8 border-white/10 bg-black/40 text-zinc-300 hover:text-white hover:bg-white/5 rounded-2xl transition-all font-bold tracking-wide backdrop-blur-md uppercase text-xs"
        >
          <MonitorPlay className="w-4 h-4 mr-2" /> New Session
        </Button>
        <Button
          onClick={handleTeachMeMore}
          disabled={isExtending}
          className="h-14 px-10 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg transition-transform hover:scale-105 uppercase text-xs tracking-widest"
        >
          {isExtending ? "Processing..." : "Teach Me More"}
        </Button>
        <Button
          onClick={() => setShowQuizModal(true)}
          className="h-14 px-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg transition-transform hover:scale-105 uppercase text-xs tracking-widest"
        >
          <GraduationCap className="w-5 h-5 mr-2" /> Take Quiz
        </Button>
      </div>
      <QuizSetupModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        onStart={handleQuizStart}
        onSkip={() => {
          setShowQuizModal(false);
          handleReset();
        }}
        sourceType="tutor"
      />
    </div>
  );
  }
  return null;
}