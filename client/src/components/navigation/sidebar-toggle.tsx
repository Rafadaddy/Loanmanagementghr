import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

export default function SidebarToggle() {
  const { isOpen, toggle } = useSidebar();

  return (
    <Button
      variant="outline"
      onClick={toggle}
      className={cn(
        "fixed z-50 bg-white hover:bg-gray-50 border shadow-md",
        // Posición y forma cuando el menú está abierto
        isOpen 
          ? "top-16 left-[252px] h-10 w-6 rounded-l-none rounded-r-md" 
          : "top-16 left-[58px] h-10 w-6 rounded-l-none rounded-r-md",
        "flex items-center justify-center p-0 transition-all duration-300"
      )}
      title={isOpen ? "Ocultar menú" : "Mostrar menú"}
    >
      <i className={`fas fa-${isOpen ? "chevron-left" : "chevron-right"} text-xs`}></i>
      <span className="sr-only">{isOpen ? "Ocultar menú" : "Mostrar menú"}</span>
    </Button>
  );
}