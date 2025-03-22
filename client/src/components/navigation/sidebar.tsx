import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { isOpen } = useSidebar();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: "home" },
    { href: "/clientes", label: "Clientes", icon: "users" },
    { href: "/prestamos", label: "Préstamos", icon: "hand-holding-usd" },
    { href: "/pagos", label: "Pagos", icon: "money-bill-wave" },
    { href: "/cobros-dia", label: "Cobros del Día", icon: "route" },
    { href: "/registro-caja", label: "Registro de Caja", icon: "cash-register" },
    { href: "/calculadora", label: "Calculadora", icon: "calculator" },
    { href: "/reportes", label: "Reportes", icon: "chart-bar" },
  ];

  // Versión colapsada del sidebar
  if (!isOpen) {
    return (
      <aside className="w-16 bg-white shadow-lg overflow-y-auto h-screen fixed left-0 top-0">
        <div className="p-4 border-b border-gray-200 flex justify-center items-center">
          <h1 className="text-xl font-bold text-primary">SP</h1>
        </div>
        
        <nav className="mt-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.href} className="mb-1">
                <Link href={item.href}>
                  <div 
                    className={cn(
                      "flex justify-center items-center p-3 text-gray-600 hover:bg-blue-50 hover:border-l-4 hover:border-primary cursor-pointer",
                      location === item.href && "text-gray-700 bg-blue-50 border-l-4 border-primary"
                    )}
                    title={item.label}
                  >
                    <i className={`fas fa-${item.icon}`}></i>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    );
  }

  return (
    <aside className={cn("w-64 bg-white shadow-lg overflow-y-auto h-screen fixed left-0 top-0 z-10", className)}>
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-xl font-bold text-primary">Sistema de Préstamos</h1>
      </div>
      
      <nav className="mt-4 pb-32"> {/* Agregado padding-bottom para evitar que el contenido sea ocultado por el div fijo del footer */}
        <ul>
          {navItems.map((item) => (
            <li key={item.href} className="mb-1">
              <Link href={item.href}>
                <div 
                  className={cn(
                    "flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 hover:border-l-4 hover:border-primary cursor-pointer",
                    location === item.href && "text-gray-700 bg-blue-50 border-l-4 border-primary"
                  )}
                >
                  <i className={`fas fa-${item.icon} mr-3`}></i>
                  <span>{item.label}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="fixed bottom-0 w-64 border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center">
            {user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.nombre}</p>
            <p className="text-xs text-gray-500">{user?.username}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          className="w-full flex items-center justify-center"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          <span>{logoutMutation.isPending ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
        </Button>
      </div>
    </aside>
  );
}
