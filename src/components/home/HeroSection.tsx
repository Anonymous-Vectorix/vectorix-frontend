"use client";

import { useState, useEffect, useRef } from "react";
import { useVectorixStore } from "@/contexts/VectorixStore"; 
import { useDocument } from "@/contexts/DocumentContext"; 
import {
  Upload, Link as LinkIcon, FileText, Music, ArrowRight,
  Sparkles, Loader2, CheckCircle2, X, FileText as FileIcon,
  Cpu, ScanLine, Terminal, Command, Layers, Wand2, Globe
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- RICH TEXT IMPORTS ---
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

import { API_BASE_URL as API } from "@/lib/config";

/* --- 1. STABLE IDENTITY UTILS (PRESERVED) --- */
const getStableUserId = () => {
  if (typeof window === "undefined") return "default_user";
  let uid = localStorage.getItem("vectorix_user_id");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("vectorix_user_id", uid);
  }
  return uid;
};

/* --- LOGIC UTILS --- */
const useTypewriter = (words: string[]) => {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [speed, setSpeed] = useState(150);

  useEffect(() => {
    const handleTyping = () => {
      const fullText = words[index];
      if (isDeleting) {
        setText(fullText.substring(0, text.length - 1));
        setSpeed(50);
      } else {
        setText(fullText.substring(0, text.length + 1));
        setSpeed(150);
      }

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % words.length);
      }
    };
    const timer = setTimeout(handleTyping, speed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, index, words, speed]);

  return text;
};

const cleanText = (text: string) => {
  if (!text) return "";
  try {
    return text.replace(/\u0000/g, "").replace(/\\u([0-9A-F]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  } catch (e) { return text; }
};

/* --- 2. UPGRADED RENDERER (NEON + TERMINAL STYLE) --- */
const MathRenderer = ({ content }: { content: string }) => {
  const cleaned = cleanText(content);
  
  return (
    <div className="w-full text-zinc-300 leading-relaxed font-light">
      <ReactMarkdown
        children={cleaned}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 1. NEON BOLD TEXT
          strong: ({ children }) => (
            <span className="font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              {children}
            </span>
          ),
          
          // 2. STYLED HEADINGS
          h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-white/10 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold text-indigo-200 mt-6 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-medium text-cyan-200 mt-5 mb-2">{children}</h3>,
          
          // 3. LISTS
          ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-cyan-500">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-2 marker:text-cyan-500">{children}</ol>,
          
          // 4. TERMINAL CODE BLOCKS
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <div className="my-6 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d0d] shadow-2xl relative group">
                {/* Mac-style Window Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#161616] border-b border-white/5">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex items-center text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    <Terminal className="w-3 h-3 mr-2" />
                    {match[1]}
                  </div>
                </div>
                {/* Code Content */}
                <div className="text-sm font-mono">
                  <SyntaxHighlighter
                    style={atomDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: "1.5rem", background: "transparent" }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              // Inline Code (Simple Highlight)
              <code className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono border border-indigo-500/20" {...props}>
                {children}
              </code>
            );
          },
        }}
      />
    </div>
  );
};

/* --- CONFIG --- */
const inputMethods = [
  { 
    id: "upload", icon: Upload, title: "Upload PDF", description: "Analyze Documents", 
    colorClass: "text-blue-400 bg-blue-500/5 border-blue-500/10", 
    hoverClass: "group-hover:border-blue-500/30 group-hover:bg-blue-500/10 group-hover:text-blue-300",
    activeColor: "border-blue-400/50 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
  },
  { 
    id: "paste", icon: FileText, title: "Paste Text", description: "Raw Data Buffer", 
    colorClass: "text-amber-400 bg-amber-500/5 border-amber-500/10", 
    hoverClass: "group-hover:border-amber-500/30 group-hover:bg-amber-500/10 group-hover:text-amber-300",
    activeColor: "border-amber-400/50 bg-gradient-to-br from-amber-600/20 to-orange-600/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
  },
  { 
    id: "link", icon: LinkIcon, title: "Web Link", description: "Connect URL", 
    colorClass: "text-cyan-400 bg-cyan-500/5 border-cyan-500/10", 
    hoverClass: "group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10 group-hover:text-cyan-300",
    activeColor: "border-cyan-400/50 bg-gradient-to-br from-cyan-600/20 to-teal-600/20 shadow-[0_0_30px_rgba(34,211,238,0.2)]",
    comingSoon: false 
  },
  { 
    id: "audio", icon: Music, title: "Audio Stream", description: "Voice Input", 
    colorClass: "text-zinc-600 bg-zinc-900/50 border-white/[0.02]", 
    hoverClass: "group-hover:border-white/10",
    comingSoon: true 
  },
];

export function HeroSection() {
  const typedWord = useTypewriter(["learn?", "create?", "solve?", "master?"]);
  
  const { setDocumentUploaded } = useDocument(); 
  const { heroAiAnswer, setHeroAiAnswer, heroSource, setHeroSource } = useVectorixStore();

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMethodClick = (method: typeof inputMethods[0]) => {
    if (method.comingSoon) {
      toast.info(`${method.title} coming soon`, { 
        icon: "✨",
        style: { background: '#09090b', color: '#fff', border: '1px solid #27272a' } 
      });
      return;
    }
    if (method.id === "upload") fileInputRef.current?.click();
    else setActiveModal(method.id);
  };

  const processContent = async (endpoint: string, body: any, source: "upload" | "paste" | "link") => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); 

    try {
      const toastId = toast.loading("Neural Analysis in progress..", {
        style: { background: '#09090b', color: '#a1a1aa', border: '1px solid #27272a' }
      });
      
      const userId = getStableUserId(); // 2. GET USER ID

      // 3. ADD HEADERS WITH USER ID FOR ALL REQUESTS
      let options: RequestInit = {};
      if (source === "upload") {
        options = { 
            method: "POST", 
            body, 
            signal: controller.signal,
            headers: { "X-User-Id": userId } // Add ID to file upload
        };
      } else {
        options = { 
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "X-User-Id": userId // Add ID to JSON upload
            }, 
            body: JSON.stringify(body), 
            signal: controller.signal 
        };
      }
      
      const res = await fetch(`${API}/${endpoint}`, options);
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }
      
      setHeroSource(source);
      setDocumentUploaded();
      
      toast.dismiss(toastId);
      toast.success("Knowledge Ingested.", {
        icon: "🧠",
        style: { background: '#09090b', color: '#fff', border: '1px solid #10b981' }
      });
      setActiveModal(null);
      setUrlValue("");
      setPasteValue("");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Neural Bridge Offline.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append("file", files[0]);
      processContent("upload-pdf", formData, "upload");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAskAI = async () => {
    if (!searchQuery.trim()) return toast.error("Command empty.");
    if (!heroSource) return toast.error("No source data found.");
    
    setIsAsking(true);
    setHeroAiAnswer(null);

    const userId = getStableUserId(); // 4. GET ID FOR ASKING

    try {
      // 5. SEND ID WITH QUESTION
      const response = await fetch(`${API}/ask-ai`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId  // <--- CRITICAL FIX
        },
        body: JSON.stringify({ question: searchQuery, top_k: 6 }),
      });

      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setHeroAiAnswer(data.answer);
    } catch (error) {
      toast.error("Network Error.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleCloseAnswer = () => {
    setHeroAiAnswer(null);
    setSearchQuery("");
  };

  return (
    <section className="relative min-h-full w-full flex flex-col items-center justify-start pt-24 pb-24 px-6 font-sans">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/[0.08] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[300px] bg-cyan-500/[0.05] blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-20">
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/40 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)] backdrop-blur-md transition-all hover:border-indigo-500/40">
             <div className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
             </div>
             <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-[0.25em]">NEURAL ENGINE V3.0</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white leading-[0.95]">
            What will you <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 animate-pulse-glow">
              {typedWord}
            </span>
            <span className="animate-pulse text-indigo-500 ml-1">_</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl font-light leading-relaxed tracking-wide">
            The advance operating system for your ambition. <br/>
            <span className="text-zinc-100 font-medium">Ingest. Analyze. Master.</span>
          </p>
        </div>

        <div className="mx-auto max-w-2xl w-full relative group animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
             <div className={cn(
               "absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-[24px] blur-xl opacity-20 transition duration-1000 group-hover:opacity-40 group-hover:blur-2xl",
               isTyping && "opacity-60 blur-2xl animate-aurora"
             )} />
             <div className={cn(
               "relative flex items-center bg-[#050505]/80 backdrop-blur-2xl border rounded-[20px] p-2 shadow-2xl transition-all duration-300",
               isTyping ? "border-indigo-500/30 ring-1 ring-indigo-500/20" : "border-white/10"
             )}>
                <div className="pl-4 pr-3 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                   {isAsking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
                </div>
                <Input 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                   onFocus={() => setIsTyping(true)}
                   onBlur={() => setIsTyping(false)}
                   className="h-14 border-none bg-transparent text-lg placeholder:text-zinc-600 text-white focus-visible:ring-0 font-medium tracking-tight"
                   placeholder={heroSource ? "Execute neural command..." : "Upload data to initialize..."}
                />
                <Button 
                  size="icon" 
                  onClick={handleAskAI}
                  disabled={isAsking}
                  className="h-12 w-12 rounded-xl bg-white text-black hover:bg-indigo-50 hover:text-indigo-600 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95"
                >
                   <ArrowRight className="w-5 h-5" />
                </Button>
             </div>
        </div>

        {heroAiAnswer && (
          <div className="mx-auto max-w-4xl w-full animate-in fade-in zoom-in-95 duration-500 text-left">
            <Card className="overflow-hidden border-white/10 bg-[#0A0A0A]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
              <div className="p-8 md:p-12 space-y-8">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]">
                        <Wand2 className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">AI Analysis</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                             {/* DYNAMIC SOURCE LABEL */}
                             Source: {heroSource === "upload" ? "Verified PDF" : heroSource === "link" ? "Live Network" : "Text Buffer"}
                           </p>
                        </div>
                      </div>
                   </div>
                   <Button onClick={handleCloseAnswer} size="icon" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 rounded-full h-10 w-10">
                     <X className="h-5 w-5" />
                   </Button>
                </div>
                
                {/* --- RENDERED CONTENT AREA --- */}
                <div className="bg-black/40 p-8 rounded-2xl border border-white/5 shadow-inner">
                   <MathRenderer content={heroAiAnswer} />
                </div>
                
                <div className="flex justify-center pt-2">
                  <Button onClick={handleCloseAnswer} variant="outline" className="border-white/10 bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl px-8 h-12 font-bold text-xs uppercase tracking-widest transition-all hover:scale-105">
                     <ScanLine className="w-4 h-4 mr-2" /> New Query
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {!heroAiAnswer && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            {inputMethods.map((method) => {
              const isActive = heroSource === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => handleMethodClick(method)}
                  className={cn(
                    "group relative flex flex-col items-center gap-4 rounded-[24px] border p-6 transition-all duration-500 overflow-hidden",
                    isActive 
                      ? method.activeColor 
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-2xl backdrop-blur-sm"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-4 right-4 animate-in fade-in zoom-in">
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]" />
                    </div>
                  )}
                  {method.comingSoon && (
                    <div className="absolute top-4 right-4">
                       <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
                    </div>
                  )}
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-500 border relative overflow-hidden",
                    isActive
                      ? "bg-white text-black border-white scale-110"
                      : cn("bg-black/40 border-white/5 group-hover:scale-110", method.colorClass, method.hoverClass)
                  )}>
                    {isActive ? (
                      <CheckCircle2 className="h-6 w-6 relative z-10" />
                    ) : (
                      <method.icon className="h-6 w-6 relative z-10 transition-colors" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className={cn(
                      "block text-xs font-bold tracking-widest uppercase transition-colors duration-300",
                      isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-200"
                    )}>
                      {isActive ? "Connected" : method.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        
        {/* === PASTE MODAL === */}
        <Dialog open={activeModal === "paste"} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="sm:max-w-xl bg-[#09090b]/95 border border-amber-500/10 text-white shadow-2xl backdrop-blur-2xl p-0 overflow-hidden rounded-[28px]">
            <DialogHeader className="p-6 border-b border-amber-500/10 bg-amber-500/[0.02]">
              <DialogTitle className="text-sm font-bold text-amber-100 flex items-center gap-3 uppercase tracking-widest">
                <div className="p-1.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                  <FileIcon className="h-4 w-4 text-amber-400" />
                </div>
                <span>Raw Text Buffer</span>
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6 bg-black/50">
              <Textarea 
                placeholder="Paste your data stream here..." 
                value={pasteValue} 
                onChange={(e) => setPasteValue(e.target.value)} 
                className="min-h-[200px] border-white/10 bg-zinc-900/50 text-amber-100/90 placeholder:text-zinc-700 resize-none text-sm font-mono leading-relaxed p-4 rounded-xl focus-visible:ring-amber-500/30 focus-visible:border-amber-500/30 transition-all selection:bg-amber-500/30" 
              />
              <Button 
                onClick={() => processContent("upload-text", { text: pasteValue }, "paste")} 
                className="w-full h-14 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.2)] transition-transform hover:scale-[1.01]"
              >
                <Cpu className="w-5 h-5 mr-2" /> INITIATE PROCESS
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* === NEW URL LINK MODAL === */}
        <Dialog open={activeModal === "link"} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="sm:max-w-xl bg-[#09090b]/95 border border-cyan-500/10 text-white shadow-2xl backdrop-blur-2xl p-0 overflow-hidden rounded-[28px]">
            <DialogHeader className="p-6 border-b border-cyan-500/10 bg-cyan-500/[0.02]">
              <DialogTitle className="text-sm font-bold text-cyan-100 flex items-center gap-3 uppercase tracking-widest">
                <div className="p-1.5 bg-cyan-500/10 rounded-md border border-cyan-500/20">
                  <Globe className="h-4 w-4 text-cyan-400" />
                </div>
                <span>Network Stream</span>
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6 bg-black/50">
              <Input 
                placeholder="https://youtube.com/... or https://wikipedia.org/..." 
                value={urlValue} 
                onChange={(e) => setUrlValue(e.target.value)} 
                className="h-14 border-white/10 bg-zinc-900/50 text-cyan-100/90 placeholder:text-zinc-700 text-sm font-mono p-4 rounded-xl focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 transition-all" 
              />
              <Button 
                onClick={() => processContent("upload-url", { url: urlValue }, "link")} 
                className="w-full h-14 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(34,211,238,0.2)] transition-transform hover:scale-[1.01]"
              >
                <LinkIcon className="w-5 h-5 mr-2" /> CONNECT STREAM
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </section>
  );
}