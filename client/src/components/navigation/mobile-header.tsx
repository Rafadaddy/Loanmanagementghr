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
  LogOut
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
    { href: "/registro-caja", label: "Registro de Caja", icon: Receipt },
    { href: "/calculadora", label: "Calculadora", icon: Calculator },
    { href: "/reportes", label: "Reportes", icon: BarChart },
  ];

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-b border-[hsl(var(--sidebar-border))] z-10">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-bold text-[hsl(var(--sidebar-primary))]">Sistema de Préstamos</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-r border-[hsl(var(--sidebar-border))]">
              <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
                <h1 className="text-lg font-bold text-[hsl(var(--sidebar-primary))]">Sistema de Préstamos</h1>
              </div>
              
              <nav className="p-4">
                <ul className="space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link href={item.href}>
                          <a 
                            className={cn(
                              "flex items-center py-2 text-[hsl(var(--sidebar-foreground))] transition-colors",
                              location === item.href && "text-[hsl(var(--sidebar-primary))] font-medium"
                            )}
                            onClick={() => setOpen(false)}
                          >
                            <Icon className="h-5 w-5 mr-3" />
                            <span>{item.label}</span>
                          </a>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              
              <div className="p-4 border-t border-[hsl(var(--sidebar-border))] mt-auto">
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
                  onClick={() => {
                    logoutMutation.mutate();
                    setOpen(false);
                  }}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>{logoutMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
