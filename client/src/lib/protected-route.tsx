import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";
import { useEffect } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  return (
    <Route
      path={path}
      component={() => {
        // Si está cargando, mostrar pantalla de carga
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // Si no hay usuario autenticado, redirigir a /auth
        if (!user) {
          // Usamos useEffect para asegurarnos de que el redireccionamiento ocurra
          // después del renderizado, evitando problemas con React Router
          useEffect(() => {
            navigate("/auth");
          }, []);
          
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
              <span className="ml-2">Redirigiendo a la página de autenticación...</span>
            </div>
          );
        }

        // Si hay usuario, renderizar el componente
        return <Component />;
      }}
    />
  );
}
