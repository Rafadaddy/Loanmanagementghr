import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import { useSidebar } from "@/hooks/use-sidebar";

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

export default function MainLayout({ children, className }: MainLayoutProps) {
  const { isOpen } = useSidebar();
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar siempre visible en tamaños md y mayores */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Header para móviles */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10">
        <MobileHeader />
      </div>
      
      {/* Contenido principal */}
      <div className={cn(
        "flex-1 overflow-hidden transition-all duration-300",
        isOpen ? "md:ml-64" : "md:ml-16" // Espacio para el sidebar colapsado o expandido
      )}>
        <main 
          className={cn(
            "h-full overflow-y-auto p-4 md:p-6 mt-16 md:mt-0",
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}