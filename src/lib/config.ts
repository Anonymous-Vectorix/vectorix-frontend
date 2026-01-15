// src/lib/config.ts

// 1. In Production (e.g., Netlify/Vercel):
//    We use "/api" assuming you have a rewrite rule pointing to your backend.
// 2. In Local Development:
//    We point DIRECTLY to the FastAPI server running on port 8000.
export const API_BASE_URL = import.meta.env.PROD 
  ? "http://34.131.19.153:8000" 
  : "http://0.0.0.0:8000";