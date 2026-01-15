import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, Brain, BarChart3, Library, History, Settings, 
  ChevronLeft, ChevronRight, LogOut, LogIn, GraduationCap, User,
  CalendarCheck, Activity, Layers, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext'; 
import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';

interface SidebarProps {
  isCollapsed: boolean;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, isMobile, isOpen, onClose, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navItems = [
    { name: 'Home', path: '/home', icon: Home, restricted: false },
    { name: 'Study Plan', path: '/study-plan', icon: CalendarCheck, restricted: false },
    { name: 'AI Tutor', path: '/ai-tutor', icon: GraduationCap, restricted: false },
    { name: 'AI Test', path: '/ai-test', icon: Brain, restricted: false },
    { name: 'PYQ Analysis', path: '/pyq-analysis', icon: BarChart3, restricted: false },
    { name: 'Neural Engine', path: '/neural-engine', icon: Activity, restricted: true },
    { name: 'Library', path: '/library', icon: Library, restricted: false },
    { name: 'History', path: '/history', icon: History, restricted: false },
    { name: 'Settings', path: '/settings', icon: Settings, restricted: true },
  ];

  // CRYSTAL GLASS AESTHETIC
  // A deep, rich glass stack:
  // 1. High blur (backdrop-blur-xl)
  // 2. Low opacity black background
  // 3. A subtle white border on the right for definition
  const sidebarClasses = cn(
    "fixed top-0 left-0 z-50 h-full transition-all duration-500 cubic-bezier(0.33, 1, 0.68, 1) flex flex-col",
    "bg-black/40 backdrop-blur-2xl border-r border-white/10 shadow-[20px_0_40px_-10px_rgba(0,0,0,0.3)]",
    isMobile ? (isOpen ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px]") : (isCollapsed ? "w-[88px]" : "w-[280px]")
  );

  return (
    <>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {/* Mobile Backdrop Overlay */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-in fade-in duration-500" onClick={onClose} />
      )}

      <aside className={sidebarClasses}>
        
        {/* --- BRAND HEADER (Crystal Layout) --- */}
        <div className="h-28 flex items-center justify-center relative shrink-0">
          <Link 
            to="/home" 
            className="flex items-center gap-3 group w-full px-6 overflow-hidden" 
            onClick={isMobile ? onClose : undefined}
          >
            {/* LOGO CONTAINER: Floating Effect */}
            <div className={cn(
              "relative flex items-center justify-center transition-all duration-500",
              isCollapsed && !isMobile ? "w-full" : "w-auto"
            )}>
               {/* Using the user's brand logo. 
                  Added 'drop-shadow' to make it glow against the dark glass.
               */}
               <img 
                 src="/brand-logo.png" 
                 alt="Vectorix Logo" 
                 className={cn(
                   "object-contain transition-all duration-500 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]",
                   isCollapsed && !isMobile ? "h-10 w-10" : "h-12 w-auto"
                 )}
               />
            </div>
            
            {/* Text Title (Hides on Collapse) */}
            <div className={cn(
                "flex flex-col transition-all duration-500 origin-left", 
                isCollapsed && !isMobile ? "opacity-0 w-0 scale-90 hidden" : "opacity-100 w-auto scale-100"
            )}>
              {/* If your logo has text in it, you might not need this. 
                  But if it's just an icon, this adds the premium text title. */}
              <span className="text-xl font-bold text-white tracking-wide font-sans">VECTORIX</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">AI STUDY OS V3.0</span>
            </div>
          </Link>

          {/* Toggle Button (Floating Orb) */}
          {!isMobile && (
            <button 
              onClick={onToggleCollapse}
              className="absolute -right-3 top-10 h-6 w-6 rounded-full border border-white/10 bg-zinc-900/90 text-zinc-400 hover:text-white hover:border-white/30 hover:scale-110 transition-all flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] z-50 backdrop-blur-md"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* --- NAVIGATION (Etched Glass Style) --- */}
        <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-1.5 custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                    if (item.restricted && !user) {
                      e.preventDefault();
                      setShowAuthModal(true);
                      return;
                    }
                    if (isMobile) onClose();
                }}
                className={cn(
                  "relative group flex items-center rounded-xl px-3 py-3.5 transition-all duration-300 overflow-hidden",
                  // HOVER: Subtle white wash
                  "hover:bg-white/[0.04]",
                  // ACTIVE: Etched Glass Look (Inner glow, border, brighter text)
                  isActive 
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/5" 
                    : "text-zinc-400 border border-transparent",
                  (isCollapsed && !isMobile) ? "justify-center px-0" : "gap-3"
                )}
              >
                {/* Active Glow Backdrop (Ambient light behind the active item) */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-transparent opacity-50 blur-sm pointer-events-none" />
                )}

                {/* Active Indicator Line */}
                <div className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
                  isActive ? "h-6 opacity-100" : "h-0 opacity-0"
                )} />
                
                <item.icon className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-all duration-300 relative z-10", 
                    isActive ? "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]" : "group-hover:text-white group-hover:scale-105"
                )} />
                
                <span className={cn(
                    "text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300 relative z-10", 
                    (isCollapsed && !isMobile) ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                )}>
                  {item.name}
                </span>

                {/* Premium Tooltip (Collapsed) */}
                {isCollapsed && !isMobile && (
                  <div className="fixed left-[95px] px-3 py-2 bg-black/90 border border-white/10 backdrop-blur-md text-xs font-semibold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all translate-x-[-8px] group-hover:translate-x-0 z-[60] pointer-events-none shadow-2xl tracking-wide">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* --- USER PROFILE (Holographic Card) --- */}
        <div className="p-4 mt-auto border-t border-white/10 bg-black/20 shrink-0">
          {user ? (
            <div className={cn(
              "relative overflow-hidden rounded-2xl transition-all duration-300 border border-white/5",
              (isCollapsed && !isMobile) ? "p-2 bg-transparent border-none" : "p-3 bg-white/[0.03] hover:bg-white/[0.05]"
            )}>
              
              <div className={cn("flex items-center gap-3 transition-all", (isCollapsed && !isMobile) ? "justify-center" : "")}>
                {/* Avatar */}
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-white/10 flex items-center justify-center shadow-lg group cursor-pointer relative">
                   <User className="h-5 w-5 text-white/90" />
                   {/* Online Status Dot */}
                   <div className="absolute top-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-[#121212] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                
                {/* Text Info */}
                <div className={cn("flex-1 overflow-hidden transition-all duration-300", (isCollapsed && !isMobile) ? "w-0 opacity-0 hidden" : "block")}>
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                    <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Pro Account</p>
                  </div>
                </div>
                
                {/* Logout Button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={logout} 
                  className={cn(
                    "h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-all", 
                    (isCollapsed && !isMobile) ? "hidden" : "flex"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setShowAuthModal(true)} 
              className={cn(
                "w-full bg-white text-black hover:bg-zinc-200 font-bold shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-all rounded-xl",
                (isCollapsed && !isMobile) ? "px-0 h-10 w-10 flex items-center justify-center" : "py-6"
              )}
            >
              {(isCollapsed && !isMobile) ? <LogIn className="h-5 w-5" /> : "AUTHENTICATE"}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}