import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Ghost } from "lucide-react";

const NotFound = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px] opacity-50" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-[500px] w-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-purple-500/10 blur-[100px] opacity-30" />

      {/* Main Content */}
      <div className="relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Glitchy 404 Text */}
        <h1 className="text-[150px] font-black leading-none tracking-tighter text-white/5 select-none md:text-[200px]">
          404
        </h1>

        <div className="-mt-16 space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
            <Ghost className="h-10 w-10 text-zinc-400" />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Lost in the Void?
          </h2>
          <p className="mx-auto max-w-md text-zinc-400">
            The page you are looking for doesn't exist, has been removed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
          <Button 
            variant="outline" 
            asChild
            className="h-11 border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <Link to={-1 as any}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Link>
          </Button>

          <Button 
            asChild
            className="h-11 bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Return Home
            </Link>
          </Button>
        </div>
      </div>

    </div>
  );
};

export default NotFound;