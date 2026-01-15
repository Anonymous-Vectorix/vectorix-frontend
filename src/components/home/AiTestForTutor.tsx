// src/components/home/AiTestForTutor.tsx

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVectorixStore } from "@/contexts/VectorixStore";
import { NeuralLogger } from "@/lib/neural-logger";
import { tracker } from "@/lib/BehavioralTracker"; 
import {
  Loader2, CheckCircle2, ChevronRight, Trophy, Target, ArrowLeft, Bot,
  Sparkles, Brain, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

/* -------------------------------------------------------------------------- */
/* UTILITY FUNCTIONS (Ported from AiTestSection)                              */
/* -------------------------------------------------------------------------- */

const cleanText = (text: string | null | undefined) => {
  if (!text) return "";
  try {
    let clean = text.replace(/\\n/g, "\n");
    clean = clean.replace(/\\u([0-9A-F]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    return clean;
  } catch (e) { return text || ""; }
};

const MathRenderer = ({ content, isOption = false }: { content: string; isOption?: boolean; }) => {
  const cleaned = cleanText(content);
  return (
    <div className={`prose prose-invert max-w-none ${isOption ? "prose-p:my-0 prose-p:leading-tight" : ""}`}>
      <ReactMarkdown
        children={cleaned}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ ...props }) => (
            <p className={`text-zinc-200 leading-relaxed ${isOption ? "text-base m-0" : "text-xl md:text-2xl font-medium mb-6"}`} {...props} />
          ),
          strong: ({ ...props }) => <strong className="text-emerald-300 font-bold" {...props} />,
          code: ({ ...props }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm text-emerald-300 font-mono" {...props} />,
        }}
      />
    </div>
  );
};

// 💎 Helper: Handle Options as Objects {id, text} or Strings
const renderOption = (option: any) => {
  return typeof option === 'object' ? option.text : option;
};

const getOptionValue = (option: any) => {
  return typeof option === 'object' ? option.id : option;
};

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function AiTestForTutor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setActiveContext, tutorRawText, tutorFile, tutorInputType } = useVectorixStore();

  // --- STATE ---
  const [quizData, setQuizData] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(true); 
  const [aiStep, setAiStep] = useState("Initializing Neural Matrix...");
  const [progress, setProgress] = useState(0);

  // Quiz Interaction State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  
  const isMounted = useRef(true);

  // --- 1. INITIALIZATION & GENERATION ---
  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      // 1. Validation & Fallback
      const state = location.state as any || {};
      
      const activeTextContext = state.textContext || tutorRawText;
      const activeFile = state.file || tutorFile;
      const activeTopic = state.topic || "AI Tutor Session";

      if (!activeTextContext && !activeFile) {
        console.error("Missing Context:", state);
        if (isMounted.current) {
            toast.error("Session context lost. Redirecting...");
            navigate("/ai-tutor");
        }
        return;
      }

      const difficulty = state.config?.difficulty || "medium";
      const qCount = parseInt(state.config?.questionCount || "5", 10);
      const qType = state.config?.questionType || "mcq";
      const sessionId = state.sessionId;

      if (sessionId) {
          tracker.startSession(`AI Test: ${activeTopic}`, sessionId);
      }
      
      try {
        if (!isMounted.current) return;
        setAiStep("Analyzing Lecture Context...");

        // 2. Upload Context (Handshake)
        const shouldUseFile = (tutorInputType === 'pdf' && activeFile) || (activeFile && !tutorInputType);

        if (shouldUseFile) {
            const formData = new FormData();
            formData.append("file", activeFile);
            const uploadRes = await fetch(`${API_BASE}/upload-pdf`, {
                method: "POST",
                headers: { "X-User-Id": "default_user" },
                body: formData
            });
            if (!uploadRes.ok) throw new Error("File Handshake Failed");
        } else if (activeTextContext) {
            const uploadRes = await fetch(`${API_BASE}/upload-text`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                "X-User-Id": "default_user" 
              },
              body: JSON.stringify({ text: activeTextContext }),
            });
            if (!uploadRes.ok) throw new Error("Context Handshake Failed");
        }

        // 3. Generate Quiz
        if (!isMounted.current) return;
        setAiStep("Formulating Questions...");
        
        const quizRes = await fetch(`${API_BASE}/generate-quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: activeTopic,
              difficulty: difficulty,
              question_count: qCount,
              question_type: qType,
            }),
        });

        if (!quizRes.ok) throw new Error("Generation Failed");
        
        // 💎 FIX: Robust Data Handling (Array or Object)
        const data = await quizRes.json();
        let finalQuestions = [];

        if (data.questions && Array.isArray(data.questions)) {
            finalQuestions = data.questions;
        } else if (Array.isArray(data)) {
            finalQuestions = data;
        }
        
        if (!isMounted.current) return;

        if (finalQuestions.length > 0) {
            setQuizData(finalQuestions);
            setIsGenerating(false);
            NeuralLogger.log("tutor", activeTopic, "quiz_start" as any, 0, undefined, { session_id: sessionId });
        } else {
            throw new Error("No questions returned");
        }

      } catch (e) {
          console.error(e);
          if (isMounted.current) {
            toast.error("Failed to generate quiz. Returning to Tutor.");
            navigate("/ai-tutor");
          }
      }
    };

    init();

    return () => { isMounted.current = false; };
  }, []); 

  // --- PROGRESS ANIMATION ---
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      if (isMounted.current) {
        setProgress((p) => Math.min(p + 1.5, 95));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // --- HANDLERS ---
  const handleOptionClick = (optionValue: string) => {
    if (isAnswered || !quizData) return;
    
    setSelectedOption(optionValue);
    setIsAnswered(true);

    const currentQ = quizData[currentQuestionIndex];

    // 💎 FIX: Robust Correctness Check (ID or Text match)
    let isCorrectCheck = false;
    
    // Case 1: Direct Match (Text or ID)
    if (optionValue === currentQ.answer) isCorrectCheck = true;
    if (currentQ.correctAnswerId && optionValue === currentQ.correctAnswerId) isCorrectCheck = true;
    
    // Case 2: Object Match (finding ID from Text)
    if (!isCorrectCheck && Array.isArray(currentQ.options)) {
        const matchedOpt = currentQ.options.find((o: any) => o.text === optionValue || o === optionValue);
        if (matchedOpt && (matchedOpt.id === currentQ.correctAnswerId)) {
            isCorrectCheck = true;
        }
    }
    
    tracker.log('quiz_answer_select', `Selected: ${optionValue} (${isCorrectCheck ? 'Correct' : 'Wrong'})`);

    if (isCorrectCheck) {
      setScore((s) => s + 1);
      toast.success("Correct", { style: { background: "#064e3b", color: "#34d399", border: "none" } });
    } else {
      toast.error("Incorrect", { style: { background: "#450a0a", color: "#f87171", border: "none" } });
    }
  };

  const handleNext = () => {
    if (!quizData) return;

    if (currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex((p) => p + 1);
      setIsAnswered(false);
      setSelectedOption(null);
      tracker.startSegment(`Question ${currentQuestionIndex + 2}`);
    } else {
      // --- FINISH EXAM ---
      setShowScore(true);
      const finalPercentage = Math.round((score / quizData.length) * 100);
      const state = location.state as any;
      const sessionId = state?.sessionId;

      if (sessionId) {
          NeuralLogger.log('tutor', state.topic, 'quiz_complete' as any, finalPercentage, undefined, { session_id: sessionId });
          
          const report = tracker.endSession({
              modulesCompleted: 1,      
              totalModules: 1,          
              examScore: finalPercentage,
              isExamComplete: true,
              totalQuestions: quizData.length,
              correctAnswers: score
          });
          
          (report as any).session_id = sessionId;
          NeuralLogger.sendTelemetry(report);
      } else {
          tracker.endSession();
      }
    }
  };

  const handleReturn = () => {
    setActiveContext(null); 
    navigate("/ai-tutor");
  };

  // --- RENDER ---
  return (
    <section className="relative min-h-screen w-full font-sans selection:bg-emerald-500/30 overflow-hidden bg-transparent">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col gap-12 min-h-[90vh] justify-center">

        {/* --- VIEW 1: LOADING (Neural Matrix) --- */}
        {isGenerating && (
           <div className="flex flex-col items-center justify-center space-y-8 relative overflow-hidden font-sans min-h-[60vh]">
             <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
                <div className="relative">
                  <div className="w-24 h-24 border-2 border-white/5 rounded-full" />
                  <div className="absolute inset-0 w-24 h-24 border-2 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_50px_rgba(16,185,129,0.4)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <div className="mt-10 text-center space-y-3">
                   <p className="text-white font-bold text-lg tracking-[0.2em] uppercase animate-pulse">{aiStep}</p>
                   <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 font-mono">
                      <Bot className="w-3 h-3" />
                      <span>Syncing Lecture Context... {Math.round(progress)}%</span>
                   </div>
                </div>
                {/* Progress Bar */}
                <div className="w-64 h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                    <div 
                        className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
             </div>
           </div>
        )}

        {/* --- VIEW 2: ACTIVE QUIZ --- */}
        {!isGenerating && quizData && !showScore && (
          <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header */}
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

            {/* Main Card */}
            <Card className="relative overflow-hidden border-white/10 bg-[#0A0A0A]/90 p-8 md:p-12 backdrop-blur-3xl shadow-2xl rounded-[32px]">
              {/* Top Progress Line */}
              <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" 
                   style={{ width: `${((currentQuestionIndex + 1) / quizData.length) * 100}%` }} />
              
              {/* Question Text */}
              <div className="mb-10 min-h-[100px]">
                <MathRenderer content={quizData[currentQuestionIndex].question} />
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-4 mb-10">
                {quizData[currentQuestionIndex].options.map((option: any, idx: number) => {
                  // 💎 FIX: Use helpers for rendering and values
                  const optionValue = getOptionValue(option);
                  const optionText = renderOption(option);
                  
                  const isSelected = selectedOption === optionValue;
                  const currentQ = quizData[currentQuestionIndex];
                  
                  // Safe Correctness Check for UI styling
                  let isCorrect = false;
                  if (currentQ.correctAnswerId) {
                      isCorrect = optionValue === currentQ.correctAnswerId;
                  } else {
                      isCorrect = optionText === currentQ.answer;
                  }
                  
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

              {/* Footer */}
              <div className="flex justify-end pt-6 border-t border-white/5">
                <Button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="h-12 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all disabled:opacity-0 disabled:translate-y-2"
                >
                  {currentQuestionIndex < quizData.length - 1 ? (
                     <span className="flex items-center gap-2">Next Question <ChevronRight className="h-4 w-4" /></span>
                  ) : (
                     <span className="flex items-center gap-2">Finish Session <Target className="h-4 w-4" /></span>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* --- VIEW 3: RESULTS (50:50 COMPLETE) --- */}
        {showScore && (
          <div className="max-w-lg mx-auto w-full animate-in zoom-in-95 duration-500 h-full flex flex-col justify-center">
            <Card className="relative overflow-hidden border-white/10 bg-[#0A0A0A]/90 p-12 backdrop-blur-3xl text-center shadow-2xl rounded-[48px]">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50" />
              <div className="relative z-10">
                <div className="mx-auto mb-8 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)] ring-4 ring-white/10 animate-in zoom-in duration-500 delay-150">
                  <Trophy className="h-16 w-16 text-white fill-white" />
                </div>
                <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Session Complete</h2>
                <p className="text-zinc-400 mb-10 text-sm font-medium uppercase tracking-widest">Neural Profile Updated</p>
                <div className="grid grid-cols-2 gap-4 mb-10">
                   <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Accuracy</span>
                      <span className="text-3xl font-black text-white">{Math.round((score / quizData!.length) * 100)}%</span>
                   </div>
                   <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Questions</span>
                      <span className="text-3xl font-black text-white">{score}<span className="text-lg text-zinc-600">/{quizData!.length}</span></span>
                   </div>
                </div>
                <Button onClick={handleReturn} className="h-14 w-full bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold shadow-xl transition-transform hover:scale-105">
                    <div className="flex items-center gap-2"><ArrowLeft className="h-5 w-5" /> Return to Tutor</div>
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}