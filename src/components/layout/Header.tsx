import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Globe, Menu, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0B0C15]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0B0C15]/50">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        
        {/* Mobile Menu Trigger & Logo */}
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden text-zinc-400 hover:text-white hover:bg-white/5">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {/* Logo visible only on mobile/tablet where sidebar is hidden */}
          <Link to="/" className="flex lg:hidden items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary/20 to-blue-500/10 border border-white/5 flex items-center justify-center">
               <img src="/brand-logo.png" alt="Logo" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-bold text-lg text-white">Vectorix</span>
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full px-3 h-9 border border-transparent hover:border-white/5">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-medium uppercase tracking-wide">EN</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 border-white/10 bg-[#12121A]/95 backdrop-blur-xl text-zinc-300 rounded-xl shadow-2xl p-1">
              <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary rounded-lg cursor-pointer text-xs font-medium">English</DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary rounded-lg cursor-pointer text-xs font-medium">Español</DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary rounded-lg cursor-pointer text-xs font-medium">Français</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-[1px] bg-white/10 mx-1" />

          {/* User Profile */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 pl-2 pr-3 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                    {user?.name?.[0]?.toUpperCase() || <User className="h-3 w-3" />}
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white max-w-[80px] truncate hidden sm:block">
                    {user?.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-zinc-500 group-hover:text-zinc-300" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56 border-white/10 bg-[#12121A]/95 backdrop-blur-xl text-zinc-300 rounded-xl shadow-2xl p-1.5 mt-2">
                <div className="px-2 py-2 mb-1 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                </div>
                
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer my-0.5">
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-white/5 my-1" />
                
                <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg cursor-pointer flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium">
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" className="bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-bold shadow-lg shadow-white/5 px-4" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}