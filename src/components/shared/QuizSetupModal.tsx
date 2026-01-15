import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Brain, Play, SkipForward, Sparkles, Target, Layers, Zap, Hexagon } from "lucide-react";

// 💎 EXPORTED TYPE: Used by AiTutorSection and AiTestForTutor to parse options
export interface QuizConfig {
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
}

interface QuizSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  // This callback now triggers the navigation to /tutor-test in the parent
  onStart: (config: QuizConfig) => void; 
  onSkip: () => void;
  sourceType: "tutor" | "study_plan";
  moduleCount?: number;
}

export function QuizSetupModal({ 
  isOpen, 
  onClose, 
  onStart, 
  onSkip, 
  sourceType,
  moduleCount = 1 
}: QuizSetupModalProps) {
  
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState<string>("5");

  const handleStart = () => {
    // Passes config up to AiTutorSection, which then sends it to AiTestForTutor
    onStart({
      difficulty,
      questionCount: parseInt(count)
    });
  };

  const title = sourceType === "tutor" ? "Neural Validation Required" : "Course Mastery Gate";
  const description = sourceType === "tutor" 
    ? "Lecture sequence complete. Initiate knowledge verification protocol to sync full mastery data."
    : `Course sequence concluded (${moduleCount} modules). Execute final examination to unify Neural Score.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-[#020204]/80 border-white/5 text-white shadow-2xl backdrop-blur-3xl overflow-hidden rounded-[32px] ring-1 ring-white/10">
        
        {/* === CINEMATIC BACKGROUND FX === */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#020204]/80 to-[#020204] pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        {/* === HEADER === */}
        <div className="relative p-8 pb-6 space-y-6">
          <div className="flex items-start gap-5">
            <div className="relative group">
               <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
               <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-white/10 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
                  <Brain className="w-7 h-7 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
               </div>
               {/* Animated Status Dot */}
               <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#020204] rounded-full flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
               </div>
            </div>
            
            <div className="space-y-1.5 pt-1">
               <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                 {title}
               </DialogTitle>
               <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-300 uppercase tracking-widest shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                     <Sparkles className="w-3 h-3" /> AI Verification
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                     v3.0 Active
                  </span>
               </div>
            </div>
          </div>
          
          <DialogDescription className="text-zinc-400 leading-relaxed text-sm font-light border-l-2 border-white/5 pl-4">
            {description}
          </DialogDescription>
        </div>

        {/* === CONTROLS === */}
        <div className="relative px-8 py-2 grid gap-8">
          
          {/* Difficulty Selector (Visual Cards) */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Target className="w-3 h-3 text-purple-400" /> Simulation Intensity
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["easy", "medium", "hard"] as const).map((level) => {
                const isActive = difficulty === level;
                return (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`relative py-3 px-2 rounded-xl border transition-all duration-300 group overflow-hidden ${
                      isActive
                        ? "bg-blue-600/10 border-blue-500/40 shadow-[0_0_20px_rgba(37,99,235,0.15)]"
                        : "bg-[#0A0A10] border-white/5 hover:border-white/10 hover:bg-[#101018]"
                    }`}
                  >
                    {isActive && <div className="absolute inset-0 bg-blue-500/5 blur-md" />}
                    <span className={`relative z-10 text-xs font-bold capitalize tracking-wide flex flex-col items-center gap-1 ${
                      isActive ? "text-blue-100" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}>
                      {level === "easy" && <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />}
                      {level === "medium" && <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-yellow-400' : 'bg-zinc-600'}`} />}
                      {level === "hard" && <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-red-400' : 'bg-zinc-600'}`} />}
                      {level}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Count (Clean Select) */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers className="w-3 h-3 text-purple-400" /> Data Points (Questions)
            </label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="w-full bg-[#0A0A10] border-white/5 h-12 text-zinc-300 focus:ring-1 focus:ring-blue-500/50 rounded-xl hover:bg-[#101018] transition-colors">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F111A] border-white/10 text-zinc-300 backdrop-blur-xl">
                <SelectItem value="3">3 Questions (Rapid Scan)</SelectItem>
                <SelectItem value="5">5 Questions (Standard Protocol)</SelectItem>
                <SelectItem value="10">10 Questions (Deep Analysis)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Neural Impact Warning */}
          <div className="relative p-4 rounded-xl bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/10 group overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <Hexagon className="w-12 h-12 text-yellow-500 rotate-12" />
            </div>
            <div className="relative z-10 flex gap-3">
               <Zap className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
               <div className="space-y-1">
                  <p className="text-xs font-bold text-yellow-100/90">Neural Impact Prediction</p>
                  <p className="text-[10px] text-yellow-500/70 leading-relaxed">
                    Passing this exam is the <strong>only way</strong> to unlock 100% Mastery. Skipping will cap your Neural Score (Concept Exposed).
                  </p>
               </div>
            </div>
          </div>
        </div>

        {/* === FOOTER === */}
        <DialogFooter className="relative p-6 bg-[#05050A]/50 backdrop-blur-md border-t border-white/5 flex-col sm:flex-row gap-3 sm:gap-4 mt-4">
          <Button 
            variant="ghost" 
            onClick={onSkip}
            className="w-full sm:w-auto h-12 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
          >
            <SkipForward className="w-4 h-4 mr-2" /> 
            Skip & Finish
          </Button>
          <Button 
            onClick={handleStart}
            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:scale-[1.02] active:scale-95 transition-all duration-300 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
            <div className="relative flex items-center justify-center">
               <Play className="w-4 h-4 mr-2 fill-white" /> 
               Initialize Exam
            </div>
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}