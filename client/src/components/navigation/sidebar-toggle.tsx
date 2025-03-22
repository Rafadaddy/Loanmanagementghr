import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";

export default function SidebarToggle() {
  const { isOpen, toggle } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="fixed md:top-4 md:left-4 top-2 left-2 z-50 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white/90 border"
      title={isOpen ? "Ocultar menú" : "Mostrar menú"}
    >
      <i className={`fas fa-${isOpen ? "arrow-left" : "bars"} text-lg`}></i>
      <span className="sr-only">{isOpen ? "Ocultar menú" : "Mostrar menú"}</span>
    </Button>
  );
}