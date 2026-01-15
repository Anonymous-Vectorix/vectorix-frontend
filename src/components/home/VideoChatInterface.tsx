import { useState, useRef, useEffect, useCallback } from 'react';
// 💎 IMPORT STORE ACCESS
import { useVectorixStore } from "@/contexts/VectorixStore";
import { NeuralLogger } from "@/lib/neural-logger";
import { tracker } from "@/lib/BehavioralTracker"; 
import { 
  Send, Bot, Loader2, Terminal, Sparkles, User, StopCircle, BookOpen
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { motion, AnimatePresence } from "framer-motion";

// --- RICH TEXT IMPORTS ---
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import 'katex/dist/katex.min.css'; 

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// 🧠 NEURAL ENGINE CONFIGURATION
const NEURAL_ENDPOINT = `${API_BASE}/tutor/neural/log`;
const IDLE_THRESHOLD_MS = 15000; // 15s to detect "Stuck/Confused" state

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
};

interface Message { role: 'user' | 'ai'; content: string; }

interface VideoChatInterfaceProps { 
    systemInstruction?: string; 
    currentSegment?: { title: string; summary?: string; content?: string } | null; 
    mode?: 'standalone' | 'embedded'; 
    getCurrentTime?: () => number; 
    initialContext?: any;
    sessionId?: string; 
    
    // 50:50 Protocol Context
    modulesCompleted?: number;
    totalModules?: number;
    isExamComplete?: boolean;
}

export function VideoChatInterface({ 
    systemInstruction, 
    currentSegment, 
    initialContext,
    mode = 'standalone', 
    getCurrentTime,
    sessionId,
    
    // Destructure New Metrics with Defaults
    modulesCompleted = 0,
    totalModules = 1,
    isExamComplete = false
}: VideoChatInterfaceProps) {
  
  // 💎 ACCESS GLOBAL STORE
  const { tutorStepData, tutorTopic, completedSegmentIds, plan } = useVectorixStore(); 
  
  const activeSegment = currentSegment || initialContext || tutorStepData;

  const [currentModuleTitle, setCurrentModuleTitle] = useState(tutorTopic || "Loading...");
  const [currentModuleContent, setCurrentModuleContent] = useState((activeSegment as any)?.content || "");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timeIntervalRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', content: `I'm ready! Ask me doubts or request practice questions on this topic.` }]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 🧠 BEHAVIORAL REFS
  const typingStartRef = useRef<number | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const hasLoggedIdleRef = useRef<boolean>(false);

  // --- 🧠 NEURAL TELEMETRY SENDER (PRESERVED) ---
  const sendNeuralSignal = useCallback((eventType: string, metadata: any = {}) => {
    const payload = {
      source: "video_chat",
      topic: currentModuleTitle,
      event_type: eventType,
      timestamp: Date.now() / 1000,
      session_id: sessionId || "video_chat_pending",
      metadata: {
        ...metadata,
        video_time: currentTime // Context-aware logging
      }
    };

    fetch(NEURAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true 
    }).catch(err => console.debug("[Neural] Telemetry drop:", err));
  }, [currentModuleTitle, sessionId, currentTime]);

  // --- 🧠 1. SESSION LIFECYCLE & ATTENTION TRACKING (PRESERVED) ---
  useEffect(() => {
    if (currentModuleTitle && currentModuleTitle !== "Loading...") {
      tracker.startSession(`AI Tutor: ${currentModuleTitle}`, sessionId);
      sendNeuralSignal("session_start", { mode });
    }

    // Idle & Focus Logic
    const resetIdleTimer = () => {
      lastInteractionRef.current = Date.now();
      hasLoggedIdleRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        if (!hasLoggedIdleRef.current) {
          sendNeuralSignal("idle", { duration_ms: IDLE_THRESHOLD_MS, context: "doubt_formulation" });
          hasLoggedIdleRef.current = true;
        }
      }, IDLE_THRESHOLD_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendNeuralSignal("tab_hidden");
      } else {
        const timeAway = Date.now() - lastInteractionRef.current;
        sendNeuralSignal("tab_visible", { time_away_ms: timeAway });
        resetIdleTimer();
      }
    };

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetIdleTimer();

    return () => {
      const effectiveCount = Math.max(modulesCompleted, completedSegmentIds.size);
      const effectiveTotal = plan?.segments?.length || totalModules || 1;

      const metrics = {
          modulesCompleted: effectiveCount,
          totalModules: effectiveTotal,
          isExamComplete
      };
      
      const report = tracker.endSession(metrics);
      if (report.events.length > 0) {
        if (sessionId) { (report as any).session_id = sessionId; }
        NeuralLogger.sendTelemetry(report);
      }
      
      sendNeuralSignal("session_end");
      
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [currentModuleTitle, sessionId, modulesCompleted, totalModules, isExamComplete, completedSegmentIds, plan, sendNeuralSignal]);

  // --- 🧠 2. CONTEXT SYNC (PRESERVED) ---
  useEffect(() => {
      if (activeSegment) {
          setCurrentModuleTitle(activeSegment.title || "Current Module");
          setCurrentModuleContent(activeSegment.summary || activeSegment.content || "");
          // Signal context switch to engine
          sendNeuralSignal("context_switch", { module: activeSegment.title }); 
      }
  }, [activeSegment, sendNeuralSignal]);

  useEffect(() => {
     timeIntervalRef.current = setInterval(() => {
         if (getCurrentTime) {
             const curr = getCurrentTime();
             setCurrentTime(curr);
         }
     }, 1000);
     return () => clearInterval(timeIntervalRef.current);
  }, [getCurrentTime]);

  // --- 🧠 3. TYPING DYNAMICS (PRESERVED) ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!typingStartRef.current && e.target.value.length > 0) {
          typingStartRef.current = Date.now();
          sendNeuralSignal("typing_start");
      }
      setInput(e.target.value);
  };

  const handleChatSend = async () => {
    if (!input.trim()) return;
    
    // Calculate Formulation Time (Cognitive Load Proxy)
    const formulationTime = typingStartRef.current ? (Date.now() - typingStartRef.current) / 1000 : 0;
    typingStartRef.current = null; // Reset

    const userMsg = input;
    setInput("");
    setMessages(p => [...p, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    
    NeuralLogger.log('tutor', currentModuleTitle, 'doubt', currentTime, undefined, { session_id: sessionId });
    tracker.log('doubt_query', userMsg); 
    
    // 🧠 Log Query Depth
    sendNeuralSignal("chat_query", { 
        length: userMsg.length,
        formulation_time_sec: formulationTime,
        video_timestamp: currentTime
    });

    try {
      // 💎 UPDATED PROMPT: HYBRID MENTOR MODE
      const dynamicContext = `
        You are Vectorix, an Expert AI Mentor watching a video lecture with the student.
        
        VIDEO CONTEXT (What the student is seeing right now):
        - TOPIC: "${currentModuleTitle}"
        - CURRENT TIMESTAMP: ${formatTime(currentTime)}
        - SCENE SUMMARY: "${currentModuleContent}"
        
        INSTRUCTIONS FOR YOU:
        1. PRIMARY GOAL: Act as a brilliant co-pilot. Explain concepts, clear doubts, and keep the student engaged.
        2. IF ASKED ABOUT VIDEO: Use the 'SCENE SUMMARY' to answer specifically about what just happened.
        3. IF ASKED FOR PRACTICE/QUIZ: If the user asks for questions (e.g. "give me 10 questions", "quiz me"), DO NOT LIMIT YOURSELF to the summary. Use your GENERAL KNOWLEDGE to generate high-quality questions relevant to the TOPIC.
        4. IF ASKED FOR EXAMPLES: Provide code snippets, analogies, or real-world examples to clarify the topic.
        
        FORMATTING RULES:
        - Use LaTeX for math equations. Inline: $x^2$, Block: $$ \int x dx $$.
        - Use **Bold** for important terms.
        - Be concise but complete.
      `;

      const res = await fetch(`${API_BASE}/chat/video-tutor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          system_instruction: dynamicContext,
          context: { topic: currentModuleTitle, playbackState: { timestamp: currentTime } },
          // Pass history for conversation continuity
          history: messages.map(m => ({ role: m.role, text: m.content })) 
        })
      });
      
      const data = await res.json();
      setMessages(p => [...p, { role: 'ai', content: data.response || data.answer || "I understand." }]);
      sendNeuralSignal("ai_response_received"); // Close the interaction loop
    } catch (e) { 
        toast.error("AI connection failed"); 
        setMessages(p => [...p, { role: 'ai', content: "⚠️ Neural Link Lost. Please try again." }]); 
        sendNeuralSignal("chat_error");
    } finally { 
        setIsChatLoading(false); 
    }
  };

  useEffect(() => { chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isChatLoading]);

  return (
    <div className="flex flex-col h-full w-full bg-[#020204] relative overflow-hidden font-sans">
       
       {/* Ambient Background Glow */}
       <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

       {/* Message Container */}
       <div className="flex-1 min-h-0 relative">
         <ScrollArea className="h-full w-full px-4 py-6">
           <div className="space-y-6 pb-4">
             <AnimatePresence initial={false}>
               {messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                      {msg.role === 'ai' && (
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 shadow-lg mt-1">
                              <Sparkles className="w-4 h-4 text-cyan-400" />
                          </div>
                      )}
                      
                      <div className={`
                        relative px-5 py-3.5 text-sm max-w-[85%] shadow-lg transition-all
                        ${msg.role === 'user' 
                           ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                           : 'bg-[#121217]/90 backdrop-blur-md border border-white/10 text-zinc-300 rounded-2xl rounded-tl-sm'
                        }
                      `}>
                          <div className="prose prose-invert prose-p:leading-relaxed prose-pre:m-0 max-w-none">
                              <ReactMarkdown 
                                  remarkPlugins={[remarkMath]} 
                                  rehypePlugins={[rehypeKatex as any]}
                                  components={{
                                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                      
                                      // 1. NEON BOLD
                                      strong: ({node, ...props}) => (
                                        <strong className="text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" {...props} />
                                      ),
                                      
                                      em: ({node, ...props}) => <em className="text-blue-300 not-italic" {...props} />,
                                      
                                      // 2. TERMINAL CODE BLOCKS
                                      code({node, inline, className, children, ...props}: any) {
                                          const match = /language-(\w+)/.exec(className || "");
                                          return !inline && match ? (
                                            <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d] shadow-xl">
                                              {/* Terminal Header */}
                                              <div className="flex items-center justify-between px-3 py-1.5 bg-[#161616] border-b border-white/5">
                                                <div className="flex space-x-1.5">
                                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                                                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                                                </div>
                                                <div className="text-[10px] text-zinc-500 font-mono flex items-center">
                                                   <Terminal className="w-3 h-3 mr-1" />
                                                   {match[1]}
                                                </div>
                                              </div>
                                              <div className="text-xs">
                                                <SyntaxHighlighter
                                                  style={atomDark}
                                                  language={match[1]}
                                                  PreTag="div"
                                                  customStyle={{ margin: 0, padding: "1rem", background: "transparent" }}
                                                  {...props}
                                                >
                                                  {String(children).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                              </div>
                                            </div>
                                          ) : (
                                            <code className="bg-blue-500/10 text-cyan-300 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono text-xs" {...props}>
                                                {children}
                                            </code>
                                          );
                                      }
                                  }}
                              >
                                  {msg.content}
                              </ReactMarkdown>
                          </div>
                      </div>
                      
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-lg mt-1">
                             <User className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                  </motion.div>
               ))}
             </AnimatePresence>

             {/* Typing Indicator */}
             {isChatLoading && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                     <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                     </div>
                     <div className="px-5 py-3 bg-[#121217] border border-white/5 rounded-2xl rounded-tl-sm text-zinc-500 text-sm italic flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                     </div>
                 </motion.div>
             )}
             <div ref={chatScrollRef} />
           </div>
         </ScrollArea>
       </div>
       
       {/* High-Tech Input Area */}
       <div className="p-4 bg-[#020204]/95 backdrop-blur-sm border-t border-white/5 z-20 shrink-0">
          <div className="relative group">
            {/* Glow Effect on Focus */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
            
            <div className="relative flex items-center bg-[#0A0A0F] rounded-xl border border-white/10 overflow-hidden transition-colors">
                <Input 
                    value={input} 
                    onChange={handleInputChange} 
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} 
                    placeholder="Ask about the video or request practice questions..." 
                    className="h-12 border-none bg-transparent text-white px-4 placeholder:text-zinc-600 focus-visible:ring-0 text-sm font-medium" 
                    disabled={isChatLoading} 
                />
                <div className="pr-1.5">
                    <Button 
                      onClick={handleChatSend} 
                      size="icon" 
                      className={`h-9 w-9 rounded-lg transition-all ${
                          input.trim() 
                          ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]" 
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                      disabled={!input.trim() || isChatLoading}
                    >
                        {isChatLoading ? <StopCircle className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
          </div>
          
          <div className="text-[10px] text-zinc-700 text-center mt-2 font-mono flex items-center justify-center gap-3">
             <span>Neural Link Active</span>
             <span className="w-1 h-1 bg-zinc-800 rounded-full" />
             <span>Latency: {Math.floor(Math.random() * 20 + 10)}ms</span>
          </div>
       </div>
    </div>
  );
}