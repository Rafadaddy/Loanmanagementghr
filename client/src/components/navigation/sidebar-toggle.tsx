import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

export default function SidebarToggle() {
  const { isOpen, toggle } = useSidebar();
  const [location] = useLocation();
  
  // Ocultar el botón en la página de detalles del préstamo, cobros diarios y panel de control
  if (
    (location.includes("/prestamos/") && /\/prestamos\/\d+/.test(location)) ||
    location.includes("/cobros-dia") ||
    location === "/dashboard" ||
    location === "/"
  ) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={toggle}
      className={cn(
        "fixed z-50 bg-[hsl(var(--sidebar-background))] hover:bg-[hsl(var(--sidebar-accent))] border border-[hsl(var(--sidebar-border))] shadow-md",
        // Posición y forma cuando el menú está abierto
        isOpen 
          ? "top-16 left-[252px] h-10 w-6 rounded-l-none rounded-r-md" 
          : "top-16 left-[58px] h-10 w-6 rounded-l-none rounded-r-md",
        "flex items-center justify-center p-0 transition-all duration-300"
      )}
      title={isOpen ? "Ocultar menú" : "Mostrar menú"}
    >
      {isOpen ? (
        <ChevronLeft className="h-4 w-4 text-[hsl(var(--sidebar-foreground))]" />
      ) : (
        <ChevronRight className="h-4 w-4 text-[hsl(var(--sidebar-foreground))]" />
      )}
      <span className="sr-only">{isOpen ? "Ocultar menú" : "Mostrar menú"}</span>
    </Button>
  );
}