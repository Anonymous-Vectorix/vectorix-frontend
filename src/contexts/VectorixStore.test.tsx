import { createContext, useContext, useState, useEffect, type Dispatch, type SetStateAction, type ReactNode } from 'react';

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// --- SHARED TYPES ---
export type StudyMode = 'balanced' | 'exam';

export interface VideoSegment {
  content: string;
  id: string;
  timestamp_start: string;
  timestamp_end: string;
  title: string;
  summary: string;
  importance: "high" | "medium" | "low";
}

export interface LecturePlan {
  video_title: string;
  total_duration: string;
  mode: StudyMode;
  segments: VideoSegment[];
}

export type SessionContext = {
  source: 'study_plan' | 'tutor' | 'standalone';
  topic: string;       
  sessionId?: string;  
  returnPath: string;  
} | null;

// --- TUTOR TYPES ---
export type TutorStep = {
  topic: string;
  id: string;
  type: "concept" | "quiz" | "completion" | "remedial";
  title: string;
  content?: string;
  question?: string;
  options?: string[];
  answer?: string;
  mastery: number;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

// --- STORE INTERFACE ---
interface VectorixStoreType {
  // 1. Study Plan Data
  plan: LecturePlan | null;
  setPlan: Dispatch<SetStateAction<LecturePlan | null>>;
  videoFile: File | null;
  setVideoFile: Dispatch<SetStateAction<File | null>>;
  videoUrl: string;
  setVideoUrl: Dispatch<SetStateAction<string>>;
  inputType: 'url' | 'file';
  setInputType: Dispatch<SetStateAction<'url' | 'file'>>;
  mode: StudyMode;
  setMode: Dispatch<SetStateAction<StudyMode>>;
  systemInstruction: string;
  setSystemInstruction: Dispatch<SetStateAction<string>>;
  
  // 💎 Global Module Tracking (Type Fixed)
  completedSegmentIds: Set<string>;
  markSegmentAsCompleted: (id: string) => void;
  setCompletedSegmentIds: Dispatch<SetStateAction<Set<string>>>;

  // 💎 Track Exam Status
  isExamComplete: boolean;
  setIsExamComplete: Dispatch<SetStateAction<boolean>>;

  // 2. PYQ Section Data
  pyqResult: any[] | null;
  setPyqResult: Dispatch<SetStateAction<any[] | null>>;
  pyqFile: File | null;
  setPyqFile: Dispatch<SetStateAction<File | null>>;

  // 3. Test/Quiz Section Data
  quizData: any[] | null;
  setQuizData: Dispatch<SetStateAction<any[] | null>>;
  testFile: File | null;
  setTestFile: Dispatch<SetStateAction<File | null>>;

  // 4. Home (Hero) AI Answer
  heroAiAnswer: string | null;
  setHeroAiAnswer: Dispatch<SetStateAction<string | null>>;
  heroSource: "upload" | "paste" | "link" | null;
  setHeroSource: Dispatch<SetStateAction<"upload" | "paste" | "link" | null>>;

  // 5. AI Tutor (Text/PDF Mode) Data
  tutorStatus: "setup" | "loading" | "active" | "complete";
  setTutorStatus: Dispatch<SetStateAction<"setup" | "loading" | "active" | "complete">>;
  tutorSessionId: string | null;
  setTutorSessionId: Dispatch<SetStateAction<string | null>>;
  tutorTopic: string;
  setTutorTopic: Dispatch<SetStateAction<string>>;
  tutorFile: File | null;
  setTutorFile: Dispatch<SetStateAction<File | null>>;
  tutorRawText: string;
  setTutorRawText: Dispatch<SetStateAction<string>>;
  tutorStepData: TutorStep | null;
  setTutorStepData: Dispatch<SetStateAction<TutorStep | null>>;
  tutorChatHistory: ChatMessage[];
  setTutorChatHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  tutorInputType: "pdf" | "text";
  setTutorInputType: Dispatch<SetStateAction<"pdf" | "text">>;

  // 6. Session State
  activeSegmentId: string | null;
  setActiveSegmentId: Dispatch<SetStateAction<string | null>>;

  // 7. Global Context
  activeContext: SessionContext;
  setActiveContext: Dispatch<SetStateAction<SessionContext>>;

  // 8. Global Reset
  resetApp: () => Promise<void>;
  
  // 9. Study Plan Reset (Specific)
  resetStudyPlan: () => void;
}

const VectorixContext = createContext<VectorixStoreType | undefined>(undefined);

export function VectorixProvider({ children }: { children: ReactNode }) {
  // Study Plan
  const [plan, setPlan] = useState<LecturePlan | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [inputType, setInputType] = useState<'url' | 'file'>('url');
  const [mode, setMode] = useState<StudyMode>('balanced');
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  
  // 💎 NEW: Initialize Global Module Tracker
  const [completedSegmentIds, setCompletedSegmentIds] = useState<Set<string>>(new Set());

  // 💎 NEW: Initialize Exam Status
  const [isExamComplete, setIsExamComplete] = useState<boolean>(false);

  // PYQ
  const [pyqResult, setPyqResult] = useState<any[] | null>(null);
  const [pyqFile, setPyqFile] = useState<File | null>(null);

  // Test
  const [quizData, setQuizData] = useState<any[] | null>(null);
  const [testFile, setTestFile] = useState<File | null>(null);

  // Home
  const [heroAiAnswer, setHeroAiAnswer] = useState<string | null>(null);
  const [heroSource, setHeroSource] = useState<"upload" | "paste" | "link" | null>(null);

  // Tutor (Text/PDF)
  const [tutorStatus, setTutorStatus] = useState<"setup" | "loading" | "active" | "complete">("setup");
  const [tutorSessionId, setTutorSessionId] = useState<string | null>(null);
  const [tutorTopic, setTutorTopic] = useState("");
  const [tutorFile, setTutorFile] = useState<File | null>(null);
  const [tutorRawText, setTutorRawText] = useState("");
  const [tutorStepData, setTutorStepData] = useState<TutorStep | null>(null);
  const [tutorChatHistory, setTutorChatHistory] = useState<ChatMessage[]>([]);
  const [tutorInputType, setTutorInputType] = useState<"pdf" | "text">("pdf");

  // Session
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Context
  const [activeContext, setActiveContext] = useState<SessionContext>(null);

  // 💎 NEW: Helper Action
  const markSegmentAsCompleted = (id: string) => {
    setCompletedSegmentIds(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
    });
  };

  // ------------------------------------------------------------------
  // 💎 PERSISTENCE LOGIC (FIXED)
  // ------------------------------------------------------------------

  // 1. Auto-Load from Disk when Plan is loaded
  useEffect(() => {
    if (plan?.video_title) {
        const key = `vectorix_progress_${plan.video_title}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                // 💎 TYPE FIX: Explicit cast to string[]
                const loadedArray = JSON.parse(saved) as string[];
                const loadedSet = new Set(loadedArray);
                
                setCompletedSegmentIds(prev => {
                    // Merge disk data with current memory
                    const combined = new Set([...prev, ...loadedSet]);
                    // Only update if we actually added something new to avoid loop
                    return combined.size > prev.size ? combined : prev;
                });
            } catch (e) { console.error("Failed to load progress", e); }
        }
    }
  }, [plan?.video_title]);

  // 2. Auto-Save to Disk whenever Progress changes
  useEffect(() => {
    if (plan?.video_title && completedSegmentIds.size > 0) {
        const key = `vectorix_progress_${plan.video_title}`;
        const dataToSave = JSON.stringify(Array.from(completedSegmentIds));
        localStorage.setItem(key, dataToSave);
        console.log(`[Store] 💾 Auto-Saved Progress: ${completedSegmentIds.size} modules`);
    }
  }, [completedSegmentIds, plan?.video_title]);

  // --- RESET LOGIC (FIXED) ---
  
  const resetStudyPlan = () => {
      // 💎 LOGIC FIX: Clear disk BEFORE clearing state
      if (plan?.video_title) {
        localStorage.removeItem(`vectorix_progress_${plan.video_title}`);
      }
      
      setPlan(null);
      setVideoFile(null);
      setVideoUrl("");
      setIsExamComplete(false); 
      setActiveSegmentId(null);
      setCompletedSegmentIds(new Set());
  };

  const resetApp = async () => {
    // 💎 LOGIC FIX: Clear disk for current plan
    if (plan?.video_title) {
       localStorage.removeItem(`vectorix_progress_${plan.video_title}`);
    }

    try {
      await fetch(`${API_BASE}/tutor/neural/reset`, { method: "POST" });
      console.log("🧠 Neural Engine: Memory Wiped");
    } catch (e) {
      console.error("Failed to reset neural memory", e);
    }

    setPlan(null);
    setVideoFile(null);
    setVideoUrl("");
    setPyqResult(null);
    setQuizData(null);
    setHeroAiAnswer(null);
    
    setTutorStatus("setup");
    setTutorStepData(null);
    setTutorChatHistory([]);
    setTutorTopic(""); 
    
    setActiveSegmentId(null);
    setActiveContext(null); 
    setIsExamComplete(false);
    
    setCompletedSegmentIds(new Set());
  };

  return (
    <VectorixContext.Provider value={{
      plan, setPlan,
      videoFile, setVideoFile,
      videoUrl, setVideoUrl,
      inputType, setInputType,
      mode, setMode,
      systemInstruction, setSystemInstruction,
      
      completedSegmentIds,
      markSegmentAsCompleted,
      setCompletedSegmentIds,
      
      isExamComplete, setIsExamComplete,

      pyqResult, setPyqResult,
      pyqFile, setPyqFile,
      
      quizData, setQuizData,
      testFile, setTestFile,

      heroAiAnswer, setHeroAiAnswer,
      heroSource, setHeroSource,

      tutorStatus, setTutorStatus,
      tutorSessionId, setTutorSessionId,
      tutorTopic, setTutorTopic,
      tutorFile, setTutorFile,
      tutorRawText, setTutorRawText,
      tutorStepData, setTutorStepData,
      tutorChatHistory, setTutorChatHistory,
      tutorInputType, setTutorInputType,

      activeSegmentId, setActiveSegmentId,
      activeContext, setActiveContext,

      resetApp,
      resetStudyPlan
    }}>
      {children}
    </VectorixContext.Provider>
  );
}

export function useVectorixStore() {
  const context = useContext(VectorixContext);
  if (!context) {
    throw new Error("useVectorixStore must be used within a VectorixProvider");
  }
  return context;
}