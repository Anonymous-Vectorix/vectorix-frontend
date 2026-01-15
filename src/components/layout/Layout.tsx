import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(false); 
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans relative">
      
      {/* --- NEW BACKGROUND: "THE SPOTLIGHT" --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* 1. Subtle White Glow from Top Center (The Spotlight) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-white/5 blur-[100px] rounded-full mix-blend-screen" />
        
        {/* 2. Very Faint Blue Accent at bottom right (Optional, gives depth) */}
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-500/[0.03] blur-[120px] rounded-full" />
        
        {/* 3. High-Tech Grid with Fade-out Mask */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        isMobile={isMobile}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div 
        className={cn(
          "flex-1 flex flex-col h-full relative transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
          !isMobile && (sidebarCollapsed ? "ml-20" : "ml-72")
        )}
      >
        <div className="lg:hidden relative z-40"> 
           <Header onMenuClick={() => setMobileMenuOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar p-4 md:p-6">
           <div className="max-w-7xl mx-auto w-full h-full animate-in fade-in zoom-in-95 duration-500">
             {children}
           </div>
        </main>
      </div>
    </div>
  );
}