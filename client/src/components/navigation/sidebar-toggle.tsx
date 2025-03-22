import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";

export default function SidebarToggle() {
  const { isOpen, toggle } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="fixed md:top-4 md:left-4 top-2 left-20 z-50"
      title={isOpen ? "Ocultar menú" : "Mostrar menú"}
    >
      <i className={`fas fa-${isOpen ? "times" : "bars"} text-lg`}></i>
    </Button>
  );
}