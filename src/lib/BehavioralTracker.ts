// src/lib/BehavioralTracker.ts

export type InteractionType = 
  | 'video_play' | 'video_pause' | 'video_seek' | 'video_speed' | 'video_complete'
  | 'pdf_scroll' | 'pdf_page_change'
  | 'quiz_view' | 'quiz_answer_select' | 'quiz_submit'
  | 'doubt_open' | 'doubt_submit'
  | 'tab_hidden' | 'tab_visible' 
  | 'idle' | 'doubt_query'
  // 💎 NEW: Context-Aware Completion Events
  | 'exam_complete' | 'quiz_complete'; 

export interface InteractionEvent {
  type: InteractionType;
  timestamp: number;
  value?: string | number;     
  context?: string;            
  segment_duration?: number;   
  session_id?: string;         
}

// 💎 UPDATED: The 50:50 Protocol Payload
export interface NeuralMetrics {
  modulesCompleted?: number;
  totalModules?: number;
  isExamComplete?: boolean;
  examScore?: number; 
  // Added to support quiz details without errors
  totalQuestions?: number;
  correctAnswers?: number;
}

class BehavioralTracker {
  // Global Session Timers
  private sessionStartTime: number = 0;
  private activeDuration: number = 0;
  private lastActiveTime: number = 0;
  private isPaused: boolean = true;

  // Segment Timer
  private segmentStartTime: number = 0;
  private currentSegmentId: string = "general";

  private events: InteractionEvent[] = [];
  private currentContext: string = "";
  
  // 💎 The Persistent ID Anchor
  private currentSessionId: string | undefined = undefined;

  // 0. 💎 Helper to check ID safely
  getCurrentSessionId() {
    return this.currentSessionId;
  }

  // 1. Start Tracking
  startSession(context: string, sessionId?: string) {
    // 💎 TOPIC LOCKING LOGIC:
    if (sessionId && this.currentSessionId === sessionId) {
        console.log(`[Tracker] 🛡️ Topic Locked to: "${this.currentContext}". Ignoring rename to: "${context}"`);
        this.isPaused = false;
        this.lastActiveTime = Date.now();
        // NOTE: We Reset events here to ensure a clean slate for 'new' sessions with same ID 
        // unless handled externally.
        this.events = []; 
        this.startSegment("start");
        
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        return; 
    }

    // --- FULL RESET ---
    this.currentContext = context;
    this.sessionStartTime = Date.now();
    this.lastActiveTime = Date.now();
    this.isPaused = false;
    this.activeDuration = 0;
    this.events = [];
    
    if (sessionId) {
      this.currentSessionId = sessionId;
      console.log(`[Tracker] 🔒 Session ID Locked: "${sessionId}"`);
    } else if (this.currentSessionId) {
       console.log(`[Tracker] 🔗 Inheriting Session ID: "${this.currentSessionId}"`);
    }
    
    this.startSegment("start");
    console.log(`[Tracker] 🟢 Session Started: ${context}`);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  // 2. Start a "Lap"
  startSegment(segmentId: string) {
    const now = Date.now();
    if (this.segmentStartTime > 0) {
      const duration = (now - this.segmentStartTime) / 1000;
      this.log('idle', `Finished ${this.currentSegmentId}`, duration); 
    }
    this.currentSegmentId = segmentId;
    this.segmentStartTime = now;
  }

  // 3. Log an Action
  log(type: InteractionType, value?: string | number, durationOverride?: number) {
    if (this.isPaused && type !== 'tab_visible') this.resumeTimer();

    const event: InteractionEvent = {
      type,
      timestamp: Date.now(),
      value,
      context: this.currentContext, 
      segment_duration: durationOverride || ((Date.now() - this.segmentStartTime) / 1000),
      session_id: this.currentSessionId // 💎 Attach ID
    };

    this.events.push(event);
    console.log(`[Tracker] 👁️ ${type} | Val: ${value} | ID: ${this.currentSessionId}`);
  }

  // 4. Special Helper for Video Seeking
  logSeek(oldTime: number, newTime: number) {
    const diff = newTime - oldTime;
    const isRewind = diff < 0;
    const type = 'video_seek';
    const val = `${isRewind ? 'Rewind' : 'Skip'} ${Math.abs(diff).toFixed(1)}s`;
    this.log(type, val);
  }

  // 5. Handle Distractions
  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.log('tab_hidden', 'User switched tabs');
      this.pauseTimer();
    } else {
      this.log('tab_visible', 'User returned');
      this.resumeTimer();
    }
  };

  pauseTimer() {
    if (this.isPaused) return;
    this.activeDuration += Date.now() - this.lastActiveTime;
    this.isPaused = true;
  }

  resumeTimer() {
    if (!this.isPaused) return;
    this.lastActiveTime = Date.now();
    this.isPaused = false;
  }

  // 6. Finish & Export Report (UPDATED)
  endSession(metrics?: NeuralMetrics) {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    
    if (!this.isPaused) {
      this.activeDuration += Date.now() - this.lastActiveTime;
    }

    const totalSessionTime = (Date.now() - this.sessionStartTime) / 1000;

    const report = {
      topic: this.currentContext,
      total_duration_sec: totalSessionTime.toFixed(1),
      active_duration_sec: (this.activeDuration / 1000).toFixed(1),
      events: this.events,
      timestamp: new Date().toISOString(),
      session_id: this.currentSessionId,
      
      // 💎 50:50 Protocol Mapping
      metric_modules_completed: metrics?.modulesCompleted || 0,
      metric_total_modules: metrics?.totalModules || 1, 
      metric_is_exam_complete: metrics?.isExamComplete || false,
      metric_exam_score: metrics?.examScore, 
      metric_total_questions: metrics?.totalQuestions || 0,
      metric_correct_answers: metrics?.correctAnswers || 0,
      source_type: 'study_plan' 
    };

    console.log("[Tracker] 🏁 Report Ready:", report);
    return report;
  }
}

export const tracker = new BehavioralTracker();