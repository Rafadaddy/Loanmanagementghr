import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Home, Users, Calculator, BarChart, CreditCard, Route, DollarSign, Receipt, UserCheck } from "lucide-react";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { isOpen } = useSidebar();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/prestamos", label: "Préstamos", icon: DollarSign },
    { href: "/pagos", label: "Pagos", icon: CreditCard },
    { href: "/cobros-dia", label: "Cobros del Día", icon: Route },
    { href: "/cobradores", label: "Cobradores", icon: UserCheck },
    { href: "/registro-caja", label: "Registro de Caja", icon: Receipt },
    { href: "/calculadora", label: "Calculadora", icon: Calculator },
    { href: "/reportes", label: "Reportes", icon: BarChart },
  ];

  // Versión colapsada del sidebar
  if (!isOpen) {
    return (
      <aside className="w-16 h-screen fixed left-0 top-0 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shadow-lg overflow-y-auto transition-all duration-300">
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))] flex justify-center items-center">
          <h1 className="text-xl font-bold text-[hsl(var(--sidebar-primary))]">SP</h1>
        </div>
        
        <nav className="mt-4">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="mb-1">
                  <Link href={item.href}>
                    <div 
                      className={cn(
                        "flex justify-center items-center p-3 text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] hover:border-l-4 hover:border-[hsl(var(--sidebar-primary))] cursor-pointer transition-colors",
                        location.startsWith(item.href) && "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] border-l-4 border-[hsl(var(--sidebar-primary))]"
                      )}
                      title={item.label}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <ThemeToggle />
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn("w-64 h-screen fixed left-0 top-0 z-10 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shadow-lg overflow-y-auto transition-all duration-300", className)}>
      <div className="p-4 border-b border-[hsl(var(--sidebar-border))] flex justify-between items-center">
        <h1 className="text-xl font-bold text-[hsl(var(--sidebar-primary))]">Sistema de Préstamos</h1>
        <ThemeToggle />
      </div>
      
      <nav className="mt-4 pb-32"> {/* Padding-bottom para evitar que el contenido sea ocultado por el div fijo del footer */}
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="mb-1">
                <Link href={item.href}>
                  <div 
                    className={cn(
                      "flex items-center px-4 py-3 text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] hover:border-l-4 hover:border-[hsl(var(--sidebar-primary))] cursor-pointer transition-colors",
                      location.startsWith(item.href) && "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] border-l-4 border-[hsl(var(--sidebar-primary))]"
                    )}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="fixed bottom-0 w-64 border-t border-[hsl(var(--sidebar-border))] p-4 bg-[hsl(var(--sidebar-background))]">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--sidebar-accent))] mr-3 flex items-center justify-center">
            {user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.nombre}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{user?.username}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          className="w-full flex items-center justify-center"
          onClick={async () => {
            // Primero llamamos al endpoint de cierre de sesión
            await fetch("/api/logout", { method: "POST" });
            // Luego recargamos la página para que se redirija al login
            window.location.href = "/auth";
          }}
          disabled={logoutMutation.isPending}
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          <span>Cerrar Sesión</span>
        </Button>
      </div>
    </aside>
  );
}
