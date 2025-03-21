import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: "home" },
    { href: "/clientes", label: "Clientes", icon: "users" },
    { href: "/prestamos", label: "Préstamos", icon: "hand-holding-usd" },
    { href: "/pagos", label: "Pagos", icon: "money-bill-wave" },
    { href: "/cobros-dia", label: "Cobros del Día", icon: "route" },
    { href: "/calculadora", label: "Calculadora", icon: "calculator" },
    { href: "/reportes", label: "Reportes", icon: "chart-bar" },
  ];

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-bold text-primary">Sistema de Préstamos</h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-lg font-bold text-primary">Sistema de Préstamos</h1>
            </div>
            
            <nav className="p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <a 
                        className={`flex items-center py-2 text-gray-700 ${
                          location === item.href ? "text-primary font-medium" : ""
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <i className={`fas fa-${item.icon} mr-3 w-5`}></i>
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            
            <div className="p-4 border-t border-gray-200 mt-auto">
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
                onClick={() => {
                  logoutMutation.mutate();
                  setOpen(false);
                }}
                disabled={logoutMutation.isPending}
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                <span>{logoutMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
