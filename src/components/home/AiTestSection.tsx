import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVectorixStore } from "@/contexts/VectorixStore";
import { NeuralLogger } from "@/lib/neural-logger";
import { tracker } from "@/lib/BehavioralTracker"; 
import {
  Upload, Link as LinkIcon, FileText, Loader2,
  CheckCircle2, ChevronRight, RotateCcw, Settings2, Play,
  Trophy, Target, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// 🧠 NEURAL ENGINE CONFIGURATION
const NEURAL_ENDPOINT = `${API_BASE}/tutor/neural/log`;
const IDLE_THRESHOLD_MS = 15000; // 15 seconds for "Test Freeze/Anxiety" detection

/* --- Text Cleaning & Rendering --- */
const cleanText = (text: string) => {
  if (!text) return "";
  try {
    let clean = text.replace(/\\n/g, "\n");
    clean = clean.replace(/\\u([0-9A-F]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    return clean;
  } catch (e) {
    return text;
  }
};

const MathRenderer = ({
  content,
  isOption = false,
}: {
  content: string;
  isOption?: boolean;
}) => {
  const cleaned = cleanText(content);
  return (
    <div
      className={`prose prose-invert max-w-none ${
        isOption ? "prose-p:my-0 prose-p:leading-tight" : ""
      }`}
    >
      <ReactMarkdown
        children={cleaned}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ ...props }) => (
            <p
              className={`text-zinc-200 leading-relaxed ${
                isOption ? "text-base m-0" : "text-xl md:text-2xl font-medium mb-6"
              }`}
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <strong className="text-emerald-300 font-bold" {...props} />
          ),
          code: ({ ...props }) => (
            <code
              className="bg-white/10 px-1.5 py-0.5 rounded text-sm text-emerald-300 font-mono"
              {...props}
            />
          ),
        }}
      />
    </div>
  );
};

const inputMethods = [
  {
    id: "upload",
    icon: Upload,
    title: "Upload Data",
    description: "PDF / PPTX",
  },
  {
    id: "link",
    icon: LinkIcon,
    title: "Connect URL",
    description: "Web Page",
  },
  {
    id: "paste",
    icon: FileText,
    title: "Input Text",
    description: "Raw Notes",
  },
];

export function AiTestSection() {
  const location = useLocation();
  const navigate = useNavigate();

  // --- GLOBAL STATE ---
  const { 
    quizData, setQuizData, 
    testFile, setTestFile,
    activeContext, setActiveContext,
    setIsExamComplete, 
    completedSegmentIds, 
    plan 
  } = useVectorixStore();

  // --- LOCAL STATE ---
  const [selectedMethod, setSelectedMethod] = useState("upload");
  const [isGenerating, setIsGenerating] = useState(false);
  const [testTopic, setTestTopic] = useState("General Test"); 

  // Config
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState<string>("5");
  const [questionType, setQuestionType] = useState("mcq");

  // Inputs
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState(""); 

  // Quiz Interaction State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🧠 BEHAVIORAL TIMERS & REFS
  const questionStartTime = useRef<number>(Date.now());
  const sessionStartTime = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const hasLoggedIdleRef = useRef<boolean>(false);
  const testSessionId = useRef<string>(`test_${Date.now()}`);
  
  // 💎 NEW: Behavioral Metrics
  const answerSwitchCount = useRef(0); 
  const initialAnswerRef = useRef<string | null>(null);

  // -- AI Simulation State --
  const [aiStep, setAiStep] = useState("");
  const [progress, setProgress] = useState(0);

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
      return "anonymous_test_" + Date.now();
    }
  }, []);
  const userId = useRef(getStableUserId()).current;

  // --- 🧠 NEURAL TELEMETRY SENDER ---
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    const payload = {
      source: "test",
      topic: testTopic,
      event_type: eventType,
      timestamp: Date.now() / 1000, 
      session_id: testSessionId.current,
      metadata: metadata
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify(payload),
      keepalive: true 
    }).catch(err => console.debug("[Neural] Telemetry drop:", err));
  }, [testTopic, userId]);

  // --- 🧠 1. SESSION LIFECYCLE & IDLE TRACKING ---
  useEffect(() => {
    sendNeuralSignal("session_start", { mode: "test_setup" });
    sendNeuralSignal("intervention_context", { mode: "test" });
    sessionStartTime.current = Date.now();

    const resetIdleTimer = () => {
      lastInteractionRef.current = Date.now();
      hasLoggedIdleRef.current = false;
      
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        if (!hasLoggedIdleRef.current && quizData) { 
          sendNeuralSignal("idle", { duration_ms: IDLE_THRESHOLD_MS, context: "test_freeze" });
          hasLoggedIdleRef.current = true;
        }
      }, IDLE_THRESHOLD_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendNeuralSignal("tab_hidden", { timestamp: Date.now() });
      } else {
        const timeAway = Date.now() - lastInteractionRef.current;
        sendNeuralSignal("tab_visible", { time_away_ms: timeAway });
        resetIdleTimer();
      }
    };

    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetIdleTimer();

    return () => {
      sendNeuralSignal("session_end", { 
        duration_sec: (Date.now() - sessionStartTime.current) / 1000 
      });
      
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("click", resetIdleTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [sendNeuralSignal, quizData]);

  // --- 1. AUTO-PREFILL HANDLER ---
  useEffect(() => {
    const state = location.state as any;
    if (
      state &&
      (state.textContext || state.file) &&
      !quizData &&
      !isGenerating
    ) {
      if (state.config) {
        setDifficulty(state.config.difficulty || "medium");
        setQuestionCount(String(state.config.questionCount || "5"));
      }
      if (state.file) {
        setTestFile(state.file);
        setSelectedMethod("upload");
        toast.info("File loaded from session.");
      } else if (state.textContext) {
        setPasteText(state.textContext);
        setSelectedMethod("paste");
        toast.info("Context loaded from session.");
      }
      if (state.topic) {
        setTestTopic(state.topic); 
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      return;
    }
    setProgress(5);
    setAiStep("Initializing Neural Matrix...");

    const steps = [
      "Scanning Knowledge Base...",
      "Identifying Critical Gaps...",
      "Drafting High-Yield Questions...",
      "Calibrating Difficulty...",
      "Finalizing Exam Protocol...",
    ];
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setAiStep(steps[stepIdx]);
    }, 1200);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 92));
    }, 400);
    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isGenerating]);

  // 🧠 RESET TIMERS ON QUESTION CHANGE
  useEffect(() => {
    questionStartTime.current = Date.now();
    answerSwitchCount.current = 0;
    initialAnswerRef.current = null;
  }, [currentQuestionIndex, quizData]);

  // -- Handlers --
  const handleMethodClick = (id: string) => {
    setSelectedMethod(id);
    setTestFile(null);
    setPasteText("");
    setUrlInput("");
    sendNeuralSignal("input_method_change", { method: id }); 
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setTestFile(e.target.files[0]);
      toast.success("File attached");
    }
  };

  // --- CORE GENERATION LOGIC ---
  const handleGenerate = async () => {
    setQuizData(null); 
    setShowScore(false);
    setScore(0);
    setCurrentQuestionIndex(0);
    setIsAnswered(false);
    
    setIsGenerating(true);
    sendNeuralSignal("generation_start", { method: selectedMethod }); 

    try {
      let activeTopic = "Custom Notes";

      // 1. Upload Phase
      if (selectedMethod === "upload") {
        if (!testFile) throw new Error("Please select a file first.");
        activeTopic = testFile.name;
        
        const formData = new FormData();
        formData.append("file", testFile);
        
        const res = await fetch(`${API_BASE}/upload-pdf`, {
          method: "POST",
          headers: { "X-User-Id": userId }, 
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed. Backend error.");
        
      } else if (selectedMethod === "paste") {
        if (!pasteText.trim()) throw new Error("Please paste some text.");
        
        // --- 💎 FIX: Parse title from backend response instead of using default ---
        activeTopic = (location.state as any)?.topic || "Study Session";
        
        const res = await fetch(`${API_BASE}/upload-text`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId
          },
          body: JSON.stringify({ text: pasteText }),
        });
        if (!res.ok) throw new Error("Text processing failed.");
        
        // Parse response to find detected topic
        try {
            const data = await res.json();
            if (data.title && data.title !== "Raw Text Upload") {
                activeTopic = data.title;
                toast.success(`Topic Detected: ${activeTopic}`);
            }
        } catch (e) {
            console.warn("Could not parse text upload response title", e);
        }
      
      } else if (selectedMethod === "link") {
        if (!urlInput.trim()) throw new Error("Please enter a valid URL.");
        
        const res = await fetch(`${API_BASE}/upload-url`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId
          },
          body: JSON.stringify({ url: urlInput }),
        });
        
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "URL processing failed. Check URL Engine.");
        }

        const data = await res.json();
        activeTopic = data.title || "Web Resource";
        toast.success(`Source: ${activeTopic}`);
      }

      setTestTopic(activeTopic); 

      // 2. Generation Phase
      const qCount = parseInt(questionCount, 10) || 5;

      const quizRes = await fetch(`${API_BASE}/generate-quiz`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId // Ensure context carries over
        },
        body: JSON.stringify({
          topic: activeTopic,
          difficulty,
          question_count: qCount,
          question_type: questionType,
          persona: "The Grinder" 
        }),
      });

      if (!quizRes.ok) throw new Error("Failed to generate quiz (Server Error).");
      
      // ✅ Handle Robust JSON (Object or Array)
      const data = await quizRes.json();
      let finalQuestions = [];

      // Check for New Backend Format { quiz_id, questions: [] }
      if (data.questions && Array.isArray(data.questions)) {
          finalQuestions = data.questions;
      } 
      // Check for Legacy/Fallback Format []
      else if (Array.isArray(data)) {
          finalQuestions = data;
      }

      setProgress(100);
      setAiStep("Done!");
      await new Promise((r) => setTimeout(r, 500));

      if (finalQuestions.length > 0) {
        setQuizData(finalQuestions);
        toast.success("Exam Ready", { icon: "🏁" });
        NeuralLogger.log("test", activeTopic, "plan_generated" as any, finalQuestions.length);
        
        sendNeuralSignal("test_initialized", { 
          question_count: finalQuestions.length, 
          difficulty: difficulty,
          topic: activeTopic
        });

        tracker.startSession(`AI Test: ${activeTopic}`);
        tracker.startSegment("Question 1");
      } else {
        throw new Error("AI returned no questions. Please try a different topic.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Generation Failed");
      sendNeuralSignal("generation_fail", { error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (isAnswered) return;
    
    // 🧠 BEHAVIORAL: Thinking Time Analysis
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    
    // Indecision detection
    if (!initialAnswerRef.current) {
        initialAnswerRef.current = option;
    } else if (initialAnswerRef.current !== option) {
        answerSwitchCount.current += 1;
    }
    
    setSelectedOption(option);
    setIsAnswered(true);

    const currentQ = quizData![currentQuestionIndex];
    const isCorrect = option === currentQ.correctAnswerId || option === currentQ.answer; 
    
    // Check match against Option Text OR Option ID (Robustness)
    let isCorrectCheck = false;
    
    // Case 1: Option is the full text match
    if (option === currentQ.answer) isCorrectCheck = true;
    
    // Case 2: Option is an ID (e.g., 'a', 'b')
    if (currentQ.correctAnswerId && option === currentQ.correctAnswerId) isCorrectCheck = true;
    
    // Case 3: Match via Option Object if input is ID
    if (!isCorrectCheck && Array.isArray(currentQ.options)) {
        // If 'option' passed here is text, find its ID
        const matchedOpt = currentQ.options.find((o: any) => o.text === option || o === option);
        if (matchedOpt && (matchedOpt.id === currentQ.correctAnswerId)) {
            isCorrectCheck = true;
        }
    }

    tracker.log('quiz_answer_select', `Selected: ${option} (${isCorrectCheck ? 'Correct' : 'Wrong'})`);

    sendNeuralSignal("answer_select", {
      option: option,
      correct: isCorrectCheck,
      time_taken_sec: timeTaken,
      question_index: currentQuestionIndex,
      is_guess: timeTaken < 3,
      is_hesitation: timeTaken > 20,
      answer_switches: answerSwitchCount.current
    });

    if (isCorrectCheck) {
      setScore((s) => s + 1);
      toast.success("Correct Answer", {
        duration: 1000,
        icon: "✨",
        style: { background: "#064e3b", color: "#34d399", border: "none" },
      });
    } else {
      toast.error("Incorrect", {
        duration: 1000,
        icon: "❌",
        style: { background: "#450a0a", color: "#f87171", border: "none" },
      });
    }
  };

  const handleNext = () => {
    if (!quizData) return;

    // 💎 Fatigue Probe
    const avgTime = (Date.now() - sessionStartTime.current) / 1000 / Math.max(1, currentQuestionIndex + 1);
    const currentAccuracy = score / Math.max(1, currentQuestionIndex + 1);
    
    sendNeuralSignal("fatigue_probe", {
        question_index: currentQuestionIndex,
        accuracy_so_far: currentAccuracy,
        time_avg_sec: avgTime
    });

    if (currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex((p) => p + 1);
      setIsAnswered(false);
      setSelectedOption(null);
      
      tracker.startSegment(`Question ${currentQuestionIndex + 2}`);
    } else {
      // --- FINISH EXAM ---
      setShowScore(true);
      
      const finalPercentage = Math.round((score / quizData.length) * 100);
      const sessionId = activeContext?.sessionId || testSessionId.current; 

      sendNeuralSignal("test_complete", {
        final_score: finalPercentage,
        total_questions: quizData.length,
        duration_sec: (Date.now() - sessionStartTime.current) / 1000,
        exit_type: "completed"
      });

      if (activeContext?.source === 'study_plan') {
          setIsExamComplete(true); 
          NeuralLogger.log('study_plan', activeContext.topic, 'exam_complete' as any, finalPercentage, undefined, { session_id: sessionId });
          
          const fullMetrics = {
              modulesCompleted: completedSegmentIds.size,
              totalModules: plan?.segments?.length || 1,
              isExamComplete: true,
              examScore: finalPercentage
          };

          const report = tracker.endSession(fullMetrics); 
          (report as any).session_id = sessionId; 
          NeuralLogger.sendTelemetry(report);
      
      } else if (activeContext?.source === 'tutor') {
          NeuralLogger.log('tutor', activeContext.topic, 'quiz_complete' as any, finalPercentage, undefined, { session_id: sessionId });
          
          const report = tracker.endSession();
          (report as any).session_id = sessionId;
          NeuralLogger.sendTelemetry(report);

      } else {
          NeuralLogger.log('test', (location.state as any)?.topic || "Test", 'task_complete', finalPercentage, undefined, { session_id: sessionId });
          
          const report = tracker.endSession({
              examScore: finalPercentage,
              isExamComplete: true 
          });
          NeuralLogger.sendTelemetry(report);
      }
    }
  };

  const handleReturn = () => {
    if (!showScore && quizData) {
       sendNeuralSignal("early_exit", { 
         questions_answered: currentQuestionIndex,
         total_questions: quizData.length,
         exit_type: "abandoned"
       });
    } else if (showScore) {
       sendNeuralSignal("session_return", { dest: activeContext ? activeContext.source : "home" });
    }

    if (activeContext) {
        const path = activeContext.returnPath;
        const sourceName = activeContext.source === 'study_plan' ? 'Plan' : 'Tutor';
        setActiveContext(null); 
        navigate(path);
        toast.info(`Returned to ${sourceName}`);
    } else {
        if (showScore) {
            sendNeuralSignal("retry_attempt", { score_before_retry: score });
        }
        
        setShowScore(false);
        setScore(0);
        setCurrentQuestionIndex(0);
        setIsAnswered(false);
        setSelectedOption(null);
        setQuizData(null);
        navigate(location.pathname, { replace: true, state: {} });
    }
  };

  // HELPER: render Options correctly (Handling String vs Object)
  const renderOption = (option: any) => {
      // If object {id, text}, return text. If string, return string.
      return typeof option === 'object' ? option.text : option;
  };
  
  const getOptionValue = (option: any) => {
      return typeof option === 'object' ? option.id : option;
  };

  return (
    <section className="relative min-h-screen w-full font-sans selection:bg-emerald-500/30 overflow-hidden bg-transparent">
      
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col gap-12 min-h-[90vh] justify-center">
        
        {/* --- VIEW 1: SETUP SCREEN --- */}
        {!quizData && (
          <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl">
               <div className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </div>
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Test Protocol v3.0</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-tight">
              Test Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Mastery</span>
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-2xl font-light leading-relaxed">
              Transform your notes into a dynamic examination. Validates retention and updates your Neural Profile in real-time.
            </p>
          </div>
        )}

        {/* --- VIEW 1 CONT: INPUT FORMS --- */}
        {!quizData && (
          <div className="w-full max-w-4xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500 delay-200">
            {/* Input Method Selectors */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isGenerating ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              {inputMethods.map((method) => {
                const isActive = selectedMethod === method.id;
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => handleMethodClick(method.id)}
                    className={`group relative flex flex-col items-center justify-center gap-4 p-6 rounded-[24px] border transition-all duration-300 overflow-hidden ${
                      isActive 
                        ? "bg-[#0A0A0A]/60 border-emerald-500/50 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)] scale-[1.02] backdrop-blur-xl" 
                        : "bg-[#0A0A0A]/30 border-white/5 hover:border-white/10 hover:bg-[#0A0A0A]/50 hover:scale-[1.01] backdrop-blur-md"
                    }`}
                  >
                    {isActive && <div className="absolute inset-0 bg-emerald-500/5 blur-xl" />}
                    <div className={`relative p-4 rounded-2xl transition-all duration-300 ${
                      isActive ? "bg-emerald-500 text-black shadow-lg" : "bg-white/5 text-zinc-400 group-hover:text-zinc-200 group-hover:bg-white/10"
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="relative text-center space-y-1">
                      <span className={`block text-base font-bold tracking-tight ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`}>
                        {method.title}
                      </span>
                      <span className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest group-hover:text-zinc-500 transition-colors">
                        {method.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Input Card */}
            <Card className="relative rounded-[32px] border border-white/10 bg-[#0A0A0A]/60 backdrop-blur-3xl overflow-hidden shadow-2xl group">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 opacity-50" />
              
              <div className="relative p-8 md:p-12 min-h-[350px] flex flex-col items-center justify-center">
                {selectedMethod === "upload" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative w-full h-72 border-2 border-dashed rounded-[24px] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group/drop ${
                      testFile 
                        ? "border-emerald-500/50 bg-emerald-500/5" 
                        : "border-white/10 hover:border-emerald-500/30 hover:bg-[#151722]"
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                    {testFile ? (
                      <div className="text-center space-y-4 animate-in fade-in zoom-in">
                        <div className="mx-auto h-20 w-20 rounded-[20px] bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{testFile.name}</h3>
                          <p className="text-xs font-bold text-emerald-400 mt-1 uppercase tracking-wider">Ready for Analysis</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="mx-auto h-20 w-20 rounded-[20px] bg-[#0B0C15] flex items-center justify-center group-hover/drop:scale-110 transition-transform border border-white/5 group-hover/drop:border-emerald-500/30 shadow-xl relative z-10">
                          <Upload className="h-8 w-8 text-zinc-500 group-hover/drop:text-emerald-400 transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover/drop:text-emerald-200 transition-colors">Click to Upload Document</h3>
                          <p className="text-xs font-bold text-zinc-600 mt-2 uppercase tracking-wide">PDF or PPTX • Max 20MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedMethod === "paste" && (
                  <Textarea
                    placeholder="Paste your study notes, article content, or summaries here..."
                    className="w-full h-72 resize-none bg-transparent border-white/10 text-zinc-300 placeholder:text-zinc-700 text-lg leading-relaxed focus-visible:ring-emerald-500/50 rounded-2xl p-6 font-mono"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                )}
                
                {selectedMethod === "link" && (
                   <div className="flex flex-col gap-6 items-center justify-center w-full max-w-lg">
                     <div className="w-full relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                        <div className="relative flex items-center bg-[#0B0C15] border border-white/10 rounded-2xl px-5 h-16">
                          <LinkIcon className="w-6 h-6 text-zinc-500 mr-4" />
                          <Input 
                            placeholder="Paste Article or Website URL..." 
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-600 h-full p-0 focus-visible:ring-0 text-base"
                          />
                        </div>
                     </div>
                     <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        Vectorix will scrape and generate questions
                     </p>
                   </div>
                )}
              </div>
            </Card>

            {/* Config & Action Bar */}
            <div className="sticky bottom-8 z-20 mx-auto max-w-3xl animate-in slide-in-from-bottom-4 duration-700">
              <div className="rounded-[24px] border border-white/10 bg-[#0A0A0A]/80 p-4 shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-white/5">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center">
                    <Select value={questionType} onValueChange={setQuestionType} disabled={isGenerating}>
                      <SelectTrigger className="w-[140px] bg-[#151722] border-white/10 text-zinc-300 h-12 rounded-xl focus:ring-emerald-500/50 text-xs font-bold uppercase tracking-wider hover:bg-white/5"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#151722] border-white/10 text-zinc-300"><SelectItem value="mcq">Multiple Choice</SelectItem><SelectItem value="boolean">True / False</SelectItem></SelectContent>
                    </Select>
                    <Select value={difficulty} onValueChange={setDifficulty} disabled={isGenerating}>
                      <SelectTrigger className="w-[120px] bg-[#151722] border-white/10 text-zinc-300 h-12 rounded-xl focus:ring-emerald-500/50 text-xs font-bold uppercase tracking-wider hover:bg-white/5"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#151722] border-white/10 text-zinc-300"><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                    </Select>
                    <Select value={questionCount} onValueChange={setQuestionCount} disabled={isGenerating}>
                      <SelectTrigger className="w-[100px] bg-[#151722] border-white/10 text-zinc-300 h-12 rounded-xl focus:ring-emerald-500/50 text-xs font-bold uppercase tracking-wider hover:bg-white/5"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#151722] border-white/10 text-zinc-300">
                        <SelectItem value="3">3 Qs</SelectItem>
                        <SelectItem value="5">5 Qs</SelectItem>
                        <SelectItem value="10">10 Qs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="hidden md:block w-px h-8 bg-white/10" />

                  <Button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || (selectedMethod === "upload" && !testFile) || (selectedMethod === "paste" && !pasteText) || (selectedMethod === "link" && !urlInput)}
                    className="w-full md:w-auto h-12 px-8 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95"
                  >
                    {isGenerating ? <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Neural Engine Processing...</span></div> : <div className="flex items-center gap-2"><Play className="h-4 w-4 fill-white" /><span>Initiate Exam</span></div>}
                  </Button>
                </div>

                {isGenerating && (
                  <div className="mt-4 px-2 space-y-2 animate-in fade-in">
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin text-emerald-500" /> {aiStep}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1 w-full bg-[#151722] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-300 ease-out rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: ACTIVE QUIZ --- */}
        {quizData && !showScore && (
          <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header: Progress & Info */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Question {currentQuestionIndex + 1} / {quizData.length}
              </span>
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Assessment
              </span>
            </div>

            {/* Question Card */}
            <Card className="relative overflow-hidden border-white/10 bg-[#0A0A0A]/90 p-8 md:p-12 backdrop-blur-3xl shadow-2xl rounded-[32px]">
              {/* Top Progress Line */}
              <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" 
                   style={{ width: `${((currentQuestionIndex + 1) / quizData.length) * 100}%` }} />
              
              {/* Question Text */}
              <div className="mb-10 min-h-[100px]">
                <MathRenderer content={quizData[currentQuestionIndex].question} />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 gap-4 mb-10">
                {quizData[currentQuestionIndex].options.map((option: any, idx: number) => {
                  const optionValue = getOptionValue(option);
                  const optionText = renderOption(option);
                  
                  const isSelected = selectedOption === optionValue;
                  const currentQ = quizData[currentQuestionIndex];
                  
                  // Safe Correctness Check
                  let isCorrect = false;
                  if (currentQ.correctAnswerId) {
                      isCorrect = optionValue === currentQ.correctAnswerId;
                  } else {
                      isCorrect = optionText === currentQ.answer; // Fallback to text match
                  }
                  
                  // Dynamic Styles based on State
                  let stateStyles = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
                  
                  if (isAnswered) {
                     if (isSelected && isCorrect) stateStyles = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                     else if (isSelected && !isCorrect) stateStyles = "border-red-500 bg-red-500/10 text-red-400";
                     else if (!isSelected && isCorrect) stateStyles = "border-emerald-500 bg-emerald-500/10 text-emerald-400 opacity-50"; 
                     else stateStyles = "opacity-40 border-transparent";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(optionValue)}
                      disabled={isAnswered}
                      className={`group relative flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-200 ${stateStyles}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                         isSelected || (isAnswered && isCorrect) ? "border-current" : "border-white/20 text-zinc-500"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="w-full">
                        <MathRenderer content={optionText} isOption />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer / Next Button */}
              <div className="flex justify-end pt-6 border-t border-white/5">
                <Button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="h-12 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all disabled:opacity-0 disabled:translate-y-2"
                >
                  {currentQuestionIndex < quizData.length - 1 ? (
                     <span className="flex items-center gap-2">Next Question <ChevronRight className="h-4 w-4" /></span>
                  ) : (
                     <span className="flex items-center gap-2">Finish Exam <Target className="h-4 w-4" /></span>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* --- VIEW 3: RESULTS --- */}
        {quizData && showScore && (
          <div className="max-w-lg mx-auto w-full animate-in zoom-in-95 duration-500 h-full flex flex-col justify-center">
            <Card className="relative overflow-hidden border-white/10 bg-[#0A0A0A]/90 p-12 backdrop-blur-3xl text-center shadow-2xl rounded-[48px]">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50" />
              
              <div className="relative z-10">
                <div className="mx-auto mb-8 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)] ring-4 ring-white/10 animate-in zoom-in duration-500 delay-150">
                  <Trophy className="h-16 w-16 text-white fill-white" />
                </div>
                
                <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Examination Complete</h2>
                <p className="text-zinc-400 mb-10 text-sm font-medium uppercase tracking-widest">Profile Updated</p>
                
                <div className="grid grid-cols-2 gap-4 mb-10">
                   <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Accuracy</span>
                      <span className="text-3xl font-black text-white">{Math.round((score / quizData.length) * 100)}%</span>
                   </div>
                   <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Questions</span>
                      <span className="text-3xl font-black text-white">{score}<span className="text-lg text-zinc-600">/{quizData.length}</span></span>
                   </div>
                </div>

                <div className="grid gap-4">
                  <Button onClick={handleReturn} className="h-14 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold shadow-xl transition-transform hover:scale-105">
                    {activeContext ? <div className="flex items-center gap-2"><ArrowLeft className="h-5 w-5" /> Return to {activeContext.source === 'study_plan' ? 'Plan' : 'Tutor'}</div> : <div className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Retry Assessment</div>}
                  </Button>
                  
                  {!activeContext && (
                      <Button onClick={() => { setQuizData(null); setShowScore(false); setIsAnswered(false); setScore(0); }} variant="outline" className="h-14 border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white rounded-2xl font-bold">
                        <Settings2 className="mr-2 h-5 w-5" /> Analyze New Topic
                      </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}