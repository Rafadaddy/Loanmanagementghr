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
      <div className="md:hidden fixed top-0 left-0 right-0 z-20">
        <MobileHeader />
      </div>
      
      {/* Contenido principal */}
      <div className={cn(
        "flex-1 overflow-hidden transition-all duration-300",
        isOpen ? "md:ml-64" : "md:ml-16" // Espacio para el sidebar colapsado o expandido
      )}>
        <main 
          className={cn(
            "h-full overflow-y-auto p-3 md:p-6 mt-16 md:mt-0", // Reducido el padding en móviles
            "pb-20", // Espacio extra en la parte inferior para evitar que el contenido quede oculto por los elementos flotantes
            className
          )}
        >
          {children}
        </main>
      </div>
      
      {/* Botón flotante de acción rápida para móviles (el contenedor lo definirá) */}
      <div className="md:hidden">
        {/* Posibles acciones flotantes irán aquí */}
      </div>
    </div>
  );
}