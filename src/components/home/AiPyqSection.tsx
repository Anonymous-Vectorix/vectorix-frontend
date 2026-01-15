import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  FileText,
  BarChart3,
  Brain,
  ArrowRight,
  Loader2,
  Sparkles,
  PieChart,
  Zap,
  Layers,
  Search,
  BookOpen,
  Target
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useVectorixStore } from "@/contexts/VectorixStore";
import { useDocument } from "@/contexts/DocumentContext";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

/* --- UTILS --- */
const cleanText = (text: string) => {
  if (!text) return "";
  try {
    return text
      .replace(/\u0000/g, "")
      .replace(/\\u([0-9A-F]{4})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
  } catch (e) {
    return text;
  }
};

const MathRenderer = ({ content }: { content: string }) => (
  <ReactMarkdown
    children={cleanText(content)}
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      p: ({ node, ...props }) => <span className="font-medium" {...props} />,
      strong: ({ node, ...props }) => (
        <span className="font-bold text-blue-300" {...props} />
      ),
    }}
  />
);

export function AiPyqSection() {
  const { setDocumentUploaded } = useDocument();
  
  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { pyqResult, setPyqResult } = useVectorixStore();
  const [showBars, setShowBars] = useState(false);
  
  // Input State
  const [inputMethod, setInputMethod] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      return "anonymous_pyq_" + Date.now();
    }
  }, []);
  const userId = useRef(getStableUserId()).current;

  // 💎 1. PERSISTENCE: Auto-Load from Disk
  useEffect(() => {
    if (!pyqResult) {
        const saved = localStorage.getItem("vectorix_pyq_data");
        if (saved) {
            try {
                setPyqResult(JSON.parse(saved));
                console.log("📂 [PYQ] Restored analysis from disk");
            } catch (e) { console.error("PYQ Load Error", e); }
        }
    }
  }, []);

  // 💎 2. PERSISTENCE: Auto-Save to Disk
  useEffect(() => {
    if (pyqResult && pyqResult.length > 0) {
        localStorage.setItem("vectorix_pyq_data", JSON.stringify(pyqResult));
        
        // Trigger visual animation
        const timer = setTimeout(() => setShowBars(true), 300);
        return () => clearTimeout(timer);
    } else {
      setShowBars(false);
    }
  }, [pyqResult]);

  // Handlers
  // 💎 FIX: Accept topicOverride to target the specific content
  const runAnalysis = async (topicOverride: string = "previous year paper") => {
    const loadingToast = toast.loading("Initializing Pattern Recognition v2.5...");

    try {
      const analyzeRes = await fetch(`${API_BASE}/analyze-pyq`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId 
        },
        body: JSON.stringify({ topic: topicOverride }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis engine failed.");
      
      const data = await analyzeRes.json();
      const result = data.metrics || [];

      if (result.length > 0) {
        const sorted = result.sort((a: any, b: any) => b.percentage - a.percentage);
        setPyqResult(sorted);

        toast.dismiss(loadingToast);
        toast.success(`Patterns Decoded: ${topicOverride}`, { icon: "🧠" });
      } else {
        throw new Error("No clear patterns found. Ensure the document contains questions.");
      }
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error(e.message || "Analysis Failed");
    }
  };

  const handlePasteAnalyze = async () => {
    if (!pasteText.trim()) return toast.error("Please paste some text.");
    setIsAnalyzing(true);

    try {
      // 1. Upload Text to Vector Store
      const uploadRes = await fetch(`${API_BASE}/upload-text`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-User-Id": userId
        },
        body: JSON.stringify({ text: pasteText }),
      });
      
      if (!uploadRes.ok) throw new Error("Text processing failed.");
      setDocumentUploaded();
      
      // 💎 FIX: Parse response to get the Detected Title
      const data = await uploadRes.json();
      const detectedTopic = data.title || "Study Notes"; // Fallback if title missing
      
      // 2. Run Analysis on the specific topic
      await runAnalysis(detectedTopic);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);

    try {
      // 1. Upload PDF to Vector Store
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch(`${API_BASE}/upload-pdf`, {
        method: "POST",
        headers: { "X-User-Id": userId },
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload Failed");
      setDocumentUploaded();

      // 2. Run Analysis using File Name as Topic
      await runAnalysis(file.name);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGeneratePractice = () => {
      toast.info("Generating targeted practice set...", { icon: "⚙️" });
      // This is where you would trigger the AI Test generation based on these topics
  };

  return (
    <section className="relative min-h-screen w-full bg-transparent overflow-hidden font-sans selection:bg-blue-500/30">
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col gap-16 min-h-[90vh] justify-center">
        
        {/* === HEADER === */}
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-xl">
             <Sparkles className="h-4 w-4 text-blue-400" />
             <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Pattern Recognition v3.0</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.9]">
            Exam Trend <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 animate-pulse-glow">Analysis</span>
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-2xl font-light leading-relaxed">
            Upload Previous Year Questions (PYQs). Our Neural Engine extracts recurring topics, 
            difficulty curves, and high-yield concepts to optimize your prep.
          </p>
        </div>

        {!pyqResult ? (
          // --- INPUT MODULE ---
          <div className="grid gap-8 lg:grid-cols-12 animate-in fade-in zoom-in-95 duration-700 delay-150">
            
            {/* Main Input Card - Premium Glass */}
            <div className="lg:col-span-7">
              <Card className="relative h-full overflow-hidden border border-white/10 bg-[#0A0A0A]/60 backdrop-blur-3xl rounded-[32px] shadow-2xl p-1 group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 opacity-50" />
                
                <div className="relative h-full flex flex-col p-8 md:p-10 gap-8">
                    {/* Tab Switcher */}
                    <div className="p-1.5 bg-black/40 rounded-xl border border-white/5 flex gap-2 w-full">
                      <button
                        onClick={() => setInputMethod("upload")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          inputMethod === "upload" 
                            ? "bg-white text-black shadow-lg" 
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <Upload className="w-3 h-3" /> Upload Data
                      </button>
                      <button
                        onClick={() => setInputMethod("paste")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          inputMethod === "paste" 
                            ? "bg-white text-black shadow-lg" 
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <FileText className="w-3 h-3" /> Raw Input
                      </button>
                    </div>

                    {/* The "Drop Zone" */}
                    <div className="flex-1 relative group/zone rounded-[24px] overflow-hidden">
                      <div
                        className={`relative w-full h-full min-h-[320px] border-2 border-dashed rounded-[24px] flex flex-col items-center justify-center transition-all duration-500 ${
                          isAnalyzing
                            ? "border-blue-500/30 bg-blue-500/5 cursor-wait"
                            : "border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-blue-500/30 cursor-pointer"
                        }`}
                        onClick={() => !isAnalyzing && inputMethod === "upload" && fileInputRef.current?.click()}
                      >
                        {isAnalyzing ? (
                          <div className="flex flex-col items-center w-full p-12 text-center z-10">
                            <div className="relative mb-8">
                              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                              <div className="relative h-24 w-24 rounded-3xl bg-[#0B0C15] flex items-center justify-center border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                              </div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Deciphering Patterns...</h3>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.25em]">
                              Neural Engine Active
                            </p>
                          </div>
                        ) : inputMethod === "upload" ? (
                          <>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={handleFileChange}
                              disabled={isAnalyzing}
                            />
                            
                            {/* Glowing Orb Background Effect */}
                            <div className="absolute inset-0 bg-blue-500/5 blur-3xl opacity-0 group-hover/zone:opacity-100 transition-opacity duration-700 pointer-events-none" />

                            <div className="h-24 w-24 rounded-[32px] bg-[#0B0C15] border border-white/5 flex items-center justify-center mb-8 group-hover/zone:scale-110 group-hover/zone:shadow-[0_0_50px_-10px_rgba(59,130,246,0.3)] transition-all duration-500 relative z-10">
                              <Upload className="h-10 w-10 text-zinc-600 group-hover/zone:text-blue-400 transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 relative z-10">Upload Question Paper</h3>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest relative z-10">PDF files</p>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col p-2 z-10">
                            <Textarea
                              placeholder="Paste your questions, syllabus, or raw text here for analysis..."
                              className="flex-1 bg-transparent border-none text-zinc-300 placeholder:text-zinc-700 resize-none text-base leading-relaxed focus-visible:ring-0 p-6 font-mono"
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                            />
                            <div className="flex justify-end pt-4 pr-4">
                              <Button
                                onClick={handlePasteAnalyze}
                                className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 uppercase text-xs tracking-widest"
                              >
                                <Zap className="w-4 h-4 mr-2" /> Run Analysis
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                </div>
              </Card>
            </div>

            {/* Feature Sidebar - Glass Cards */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-5">
              <FeatureCard
                icon={Target}
                title="Concept Extraction"
                desc="Automatically tags questions by chapter and topic."
                color="text-emerald-400"
                glow="group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]"
              />
              <FeatureCard
                icon={Brain}
                title="Difficulty Heuristics"
                desc="AI estimates cognitive load (Easy/Medium/Hard)."
                color="text-purple-400"
                glow="group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
              />
              <FeatureCard
                icon={BarChart3}
                title="Weightage Matrix"
                desc="Visualizes the distribution of marks across topics."
                color="text-blue-400"
                glow="group-hover:shadow-[0_0_30px_rgba(96,165,250,0.15)]"
              />
            </div>
          </div>
        ) : (
          // --- RESULTS DASHBOARD ---
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-700">
            
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[inset_0_0_20px_rgba(59,130,246,0.1)] backdrop-blur-md">
                  <PieChart className="h-7 w-7 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Pattern Report</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Generated by Neural Engine</p>
                </div>
              </div>
              <Button
                onClick={() => {
                    setPyqResult(null);
                    localStorage.removeItem("vectorix_pyq_data"); // Clear disk on reset
                }}
                variant="outline"
                className="h-12 px-8 border-white/10 bg-black/40 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-md"
              >
                <Search className="w-4 h-4 mr-2" /> Analyze New
              </Button>
            </div>

            {/* Grid Layout */}
            <div className="grid gap-6 lg:grid-cols-3">
              
              {/* Hero Card */}
              <div className="lg:col-span-3">
                <div className="rounded-[32px] border border-blue-500/20 bg-[#0A0A0A]/80 backdrop-blur-2xl p-8 md:p-12 relative overflow-hidden group shadow-2xl">
                  {/* Glowing blobs */}
                  <div className="absolute top-0 right-0 p-40 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-blue-600/20 transition-all duration-1000" />
                  <div className="absolute bottom-0 left-0 p-32 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                    <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0 ring-4 ring-white/5">
                      <Sparkles className="h-12 w-12 text-white" />
                    </div>
                    <div className="space-y-4 max-w-4xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Highest Yield Topic</span>
                      </div>
                      <h3 className="text-4xl md:text-5xl font-black text-white leading-[0.9]">
                        Prioritize <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 pb-1">{pyqResult[0]?.topic}</span>
                      </h3>
                      <p className="text-zinc-400 text-lg leading-relaxed">
                        Neural Engine analysis indicates this topic constitutes <strong className="text-white font-bold">{pyqResult[0]?.percentage}%</strong> of the exam pattern. 
                        Mastering this node provides the highest statistical probability of success.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Table */}
              <div className="lg:col-span-3 rounded-[32px] border border-white/10 bg-[#0A0A0A]/60 backdrop-blur-3xl overflow-hidden shadow-xl">
                {/* Table Header */}
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-8 py-5 bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Topic Node</span>
                  <span>Complexity</span>
                  <span className="text-right">Weightage</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5">
                  {pyqResult.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="group grid grid-cols-[2fr_1fr_1fr] gap-6 px-8 py-6 items-center hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Topic */}
                      <div>
                        <div className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-3">
                          <Layers className="h-4 w-4 text-zinc-600 group-hover:text-blue-500/50" />
                          <MathRenderer content={item.topic} />
                        </div>
                        <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1.5 ml-7">
                          Detected {item.count} Questions
                        </div>
                      </div>

                      {/* Difficulty */}
                      <div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border backdrop-blur-sm ${
                            item.difficulty === "Easy"
                              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                              : item.difficulty === "Medium"
                              ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
                              : "border-red-500/20 bg-red-500/5 text-red-400"
                          }`}
                        >
                          {item.difficulty}
                        </span>
                      </div>

                      {/* Bar */}
                      <div className="text-right">
                        <span className="block text-xl font-bold text-white mb-2 font-mono">
                          {item.percentage}%
                        </span>
                        <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            style={{
                              width: showBars ? `${item.percentage}%` : "0%",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Action */}
            <div className="flex justify-center pt-8 pb-20">
              <Button onClick={handleGeneratePractice} className="h-16 px-12 bg-white text-black hover:bg-zinc-200 font-bold text-sm uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95">
                <BookOpen className="mr-3 h-5 w-5" />
                Generate Practice Set
                <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  color,
  glow
}: {
  icon: any;
  title: string;
  desc: string;
  color: string;
  glow: string;
}) {
  return (
    <div className={`group flex items-start gap-5 rounded-[24px] border border-white/5 bg-[#0A0A0A]/40 backdrop-blur-xl p-6 transition-all hover:bg-[#0A0A0A]/60 hover:border-white/10 hover:-translate-y-1 ${glow}`}>
      <div className={`rounded-2xl p-4 shrink-0 transition-transform group-hover:scale-110 bg-[#0B0C15] border border-white/5`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div>
        <h3 className="font-bold text-white text-lg mb-1 tracking-tight">{title}</h3>
        <p className="text-sm text-zinc-500 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}