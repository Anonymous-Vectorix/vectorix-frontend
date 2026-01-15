// src/lib/neural-logger.ts

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

// 💎 SUPERSET DEFINITION:
// Includes all Legacy Signals + BehavioralTracker Events + New Exam Logic
export type NeuralSignalType = 
  // --- Legacy Signals (Keep for backward compatibility) ---
  | 'rewind' | 'pause' | 'play' | 'speed_change' | 'doubt' 
  | 'correct_answer' | 'wrong_answer' | 'task_complete' 
  | 'progress_25' | 'progress_50' | 'progress_75' 
  | 'plan_generated' | 'doubt_context'
  
  // --- BehavioralTracker Signals (The Main Tracker v3.0) ---
  | 'video_play' | 'video_pause' | 'video_seek' | 'video_speed' | 'video_complete'
  | 'pdf_scroll' | 'pdf_page_change'
  | 'quiz_view' | 'quiz_answer_select' | 'quiz_submit'
  | 'doubt_open' | 'doubt_submit' | 'doubt_query'
  | 'tab_hidden' | 'tab_visible' 
  | 'idle' 
  
  // --- New Exam & Test Logic (50:50 Protocol) ---
  | 'exam_complete' 
  | 'quiz_complete'
  
  // --- System ---
  | 'telemetry_report'; 

export const NeuralLogger = {
  // 1. Instant Log (For critical real-time events)
  log: async (
    source: 'tutor' | 'test' | 'study_plan', 
    topic: string, 
    type: NeuralSignalType, 
    value: number | string = 0, // 💎 Allow strings (e.g. "2x speed")
    segmentId?: string,
    metadata?: Record<string, any>
  ) => {
    
    // 💎 EXTRACTION LOGIC: Pull session_id from metadata if it exists
    const sessionId = metadata?.session_id;

    try {
      await fetch(`${API_BASE}/tutor/neural/log`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': 'default_user' 
        },
        body: JSON.stringify({
          source,
          topic: topic || "General",
          event_type: type,
          value: value,
          segment_id: segmentId,
          session_id: sessionId,
          metadata: metadata || {},
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error("❌ Neural Bridge Error:", e);
    }
  },

  // 2. Bulk Report (For the Behavioral Tracker)
  sendTelemetry: async (report: any) => {
    console.log("📦 Sending Behavioral Report to Brain...", report);
    
    try {
      await fetch(`${API_BASE}/tutor/neural/analyze-behavior`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': 'default_user'
        },
        body: JSON.stringify(report)
      });
      console.log("✅ Behavioral Analysis Sent");
    } catch (e) {
      console.error("❌ Telemetry Upload Failed:", e);
    }
  }
};