import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, 
  FileText, 
  Settings, 
  Users, 
  BarChart, 
  LogOut, 
  Menu, 
  X,
  Award,
  BookOpen,
  Code,
  PanelLeft
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { isMobile } = useIsMobile();

  const isAdmin = user?.role === 'admin';
  
  const adminLinks = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Assessments', href: '/admin/assessments', icon: FileText },
    { name: 'Results', href: '/admin/results', icon: BarChart },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];
  
  const studentLinks = [
    { name: 'Dashboard', href: '/student', icon: Home },
    { name: 'My Assessments', href: '/student/assessments', icon: FileText },
    { name: 'Results', href: '/student/results', icon: Award },
    { name: 'Learning', href: '/student/learning', icon: BookOpen },
    { name: 'Practice', href: '/student/practice', icon: Code },
  ];
  
  const links = isAdmin ? adminLinks : studentLinks;
  
  const handleLogout = () => {
    logout();
  };
  
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50"
          onClick={toggleSidebar}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
        
        <div className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        />
        
        <aside className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-white dark:bg-gray-900 shadow-lg transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold">Yudha</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.name || user?.email}
              </p>
            </div>
            
            <ScrollArea className="flex-1 py-2">
              <nav className="space-y-1 px-2">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  
                  return (
                    <Link
                      key={link.name}
                      to={link.href}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      )}
                      onClick={() => isMobile && setIsOpen(false)}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {link.name}
                    </Link>
                  );
                })}
              </nav>
            </ScrollArea>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Logout
              </Button>
            </div>
          </div>
        </aside>
      </>
    );
  }
  
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-10 lg:hidden"
        onClick={toggleSidebar}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </Button>
      
      <aside className={cn(
        "fixed top-0 left-0 z-30 h-full bg-white dark:bg-gray-900 shadow-lg transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-16",
        "hidden lg:block"
      )}>
        <div className="flex flex-col h-full">
          <div className={cn(
            "flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-800",
            isOpen ? "justify-between" : "justify-center"
          )}>
            {isOpen ? (
              <>
                <h2 className="text-xl font-bold">Yudha</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                  <PanelLeft size={18} />
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu size={18} />
              </Button>
            )}
          </div>
          
          <ScrollArea className="flex-1 py-2">
            <nav className="space-y-1 px-2">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={cn(
                      "flex items-center rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
                      isOpen ? "px-3 py-2" : "justify-center p-2"
                    )}
                    title={!isOpen ? link.name : undefined}
                  >
                    <Icon className={cn("h-5 w-5", isOpen && "mr-3")} />
                    {isOpen && link.name}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
          
          <div className={cn(
            "p-4 border-t border-gray-200 dark:border-gray-800",
            !isOpen && "flex justify-center"
          )}>
            <Button
              variant="ghost"
              className={cn(
                "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
                isOpen ? "w-full justify-start" : "p-2"
              )}
              onClick={handleLogout}
              title={!isOpen ? "Logout" : undefined}
            >
              <LogOut className={cn("h-5 w-5", isOpen && "mr-3")} />
              {isOpen && "Logout"}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
