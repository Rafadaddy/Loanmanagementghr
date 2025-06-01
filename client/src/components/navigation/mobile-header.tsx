import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { 
  Menu, 
  Home, 
  Users, 
  Calculator, 
  BarChart, 
  CreditCard,  
  Route, 
  DollarSign, 
  Receipt,
  LogOut,
  UserCheck,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/prestamos", label: "Préstamos", icon: DollarSign },
    { href: "/pagos", label: "Pagos", icon: CreditCard },
    { href: "/cobros-dia", label: "Cobros del Día", icon: Route },
    { href: "/cronograma-global", label: "Cronograma Global", icon: Calendar },
    { href: "/cobradores", label: "Cobradores", icon: UserCheck },
    { href: "/registro-caja", label: "Registro de Caja", icon: Receipt },
    { href: "/calculadora", label: "Calculadora", icon: Calculator },
    { href: "/reportes", label: "Reportes", icon: BarChart },
  ];

  // Verificar si estamos en una página donde no se debe mostrar el botón de menú
  // Nota: En la página de cobros diarios SÍ debe mostrarse el botón de menú
  const shouldHideMenu = (
    (location.includes("/prestamos/") && /\/prestamos\/\d+/.test(location)) &&
    !location.includes("/cobros-dia")
  );

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-b border-[hsl(var(--sidebar-border))] z-20 shadow-sm">
      <div className="flex items-center justify-between p-2.5">
        <div className="flex items-center">
          {!shouldHideMenu && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-1">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-r border-[hsl(var(--sidebar-border))]">
                <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
                  <h1 className="text-lg font-bold text-[hsl(var(--sidebar-primary))]">Sistema de Préstamos</h1>
                </div>
                
                <nav className="p-4 pt-2 overflow-y-auto max-h-[calc(100vh-160px)]">
                  <ul className="space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.startsWith(item.href);
                      return (
                        <li key={item.href}>
                          <Link href={item.href}>
                            <div 
                              className={cn(
                                "flex items-center py-2 px-3 rounded-md text-[hsl(var(--sidebar-foreground))] transition-colors relative cursor-pointer",
                                isActive 
                                  ? "bg-[hsl(var(--sidebar-primary))] bg-opacity-20 text-[hsl(var(--sidebar-primary))] font-medium" 
                                  : "hover:bg-[hsl(var(--sidebar-accent))] hover:bg-opacity-20"
                              )}
                              onClick={() => {
                                setOpen(false);
                              }}
                            >
                              <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                
                <div className="p-4 border-t border-[hsl(var(--sidebar-border))] absolute bottom-0 left-0 right-0 bg-[hsl(var(--sidebar-background))]">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--sidebar-accent))] mr-3 flex items-center justify-center">
                      {user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US'}
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px]">{user?.nombre}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[150px]">{user?.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full flex items-center justify-center"
                    onClick={async () => {
                      // Cerrar el menú móvil primero
                      setOpen(false);
                      
                      // Primero llamamos al endpoint de cierre de sesión
                      await fetch("/api/logout", { method: "POST" });
                      
                      // Luego recargamos la página para que se redirija al login
                      window.location.href = "/auth";
                    }}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Cerrar Sesión</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <h1 className="text-base font-bold text-[hsl(var(--sidebar-primary))] truncate max-w-[180px]">Sistema de Préstamos</h1>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {/* Para mostrar el título de la página actual, esto mejora UX */}
          <div className="ml-1.5 px-2.5 py-1.5 rounded-full bg-[hsl(var(--sidebar-primary))] bg-opacity-15 text-[hsl(var(--sidebar-primary))] text-xs font-semibold flex items-center">
            {(() => {
              const activeItem = navItems.find(item => location.startsWith(item.href));
              if (activeItem) {
                const Icon = activeItem.icon;
                return (
                  <>
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    <span>{activeItem.label}</span>
                  </>
                );
              }
              return 'Inicio';
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
