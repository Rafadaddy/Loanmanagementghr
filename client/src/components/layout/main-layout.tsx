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
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main 
        className={cn(
          "flex-1 overflow-y-auto p-4 md:p-6 md:pt-4 mt-16 md:mt-0 transition-all duration-300",
          isOpen ? "md:ml-64" : "md:ml-16", // Cambiado ml-0 a ml-16 para dejar espacio cuando el sidebar está colapsado
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}