import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { VectorixProvider } from "@/contexts/VectorixStore";
import { NeuralProgressSection } from '@/components/home/NeuralProgressSection';

// --- LAZY LOAD PAGES ---
const Welcome = lazy(() => import("./pages/Welcome")); 
const Index = lazy(() => import("./pages/Index"));     
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Library = lazy(() => import("./pages/Library"));
const History = lazy(() => import("./pages/History"));
const AiTest = lazy(() => import("./pages/AiTest"));

// 💎 IMPORT THE NEW TUTOR TEST COMPONENT
const AiTestForTutor = lazy(() => import("@/components/home/AiTestForTutor")); 

const PyqAnalysis = lazy(() => import("./pages/AiPyq"));
const Settings = lazy(() => import("./pages/Settings"));
const AiTutor = lazy(() => import("./pages/AiTutor"));
const StudyPlanPage = lazy(() => import("./pages/StudyPlan"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#0B0C15]">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium text-zinc-500 animate-pulse">Initializing Vectorix...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DocumentProvider>
        <VectorixProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* --- 1. LANDING PAGE --- */}
                  <Route path="/" element={<Welcome />} />

                  {/* --- 2. MAIN APP DASHBOARD --- */}
                  <Route path="/home" element={<Index />} />

                  {/* --- PUBLIC AUTH ROUTES --- */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  
                  {/* --- PROTECTED ROUTES --- */}
                  <Route path="/ai-tutor" element={
                    <ProtectedRoute><AiTutor /></ProtectedRoute>
                  } />
                  
                  {/* 💎 REGISTER THE NEW ROUTE HERE */}
                  <Route path="/tutor-test" element={
                    <ProtectedRoute><AiTestForTutor /></ProtectedRoute>
                  } />

                  <Route path="/study-plan" element={
                    <ProtectedRoute><StudyPlanPage /></ProtectedRoute>
                  } />
                  <Route path="/ai-test" element={
                    <ProtectedRoute><AiTest /></ProtectedRoute>
                  } />
                  
                  <Route path="/neural-engine" element={
                    <ProtectedRoute><NeuralProgressSection /></ProtectedRoute>
                  } />

                  <Route path="/pyq-analysis" element={
                    <ProtectedRoute><PyqAnalysis /></ProtectedRoute>
                  } />
                  <Route path="/library" element={
                    <ProtectedRoute><Library /></ProtectedRoute>
                  } />
                  <Route path="/history" element={
                    <ProtectedRoute><History /></ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute><Settings /></ProtectedRoute>
                  } />

                  {/* --- CATCH ALL --- */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </VectorixProvider>
      </DocumentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;