import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Apenas redireciona se for na raiz /
    if (location.pathname === '/') {
      const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
      const hasDismissed = localStorage.getItem('hasDismissedOnboarding');
      
      if (!hasCompleted && !hasDismissed) {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
