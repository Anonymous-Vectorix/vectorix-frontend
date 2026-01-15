import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, isLoading } = useAuth();

  // 1. Wait while we check if the user is logged in (prevents flashing)
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0B0C15]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. If no user is found, kick them to the Home Page (or Login)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 3. If user exists, let them see the page
  return children;
};