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

  // Movemos el useEffect fuera de condiciones para cumplir las reglas de hooks
  useEffect(() => {
    // Solo redirigir si no estamos cargando y no hay usuario autenticado
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [isLoading, user, navigate]);

  return (
    <Route path={path}>
      {() => {
        // Si está cargando o no hay usuario, mostrar pantalla de carga
        if (isLoading || !user) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
              {!isLoading && !user && 
                <span className="ml-2">Redirigiendo a la página de autenticación...</span>
              }
            </div>
          );
        }

        // Si hay usuario, renderizar el componente
        return <Component />;
      }}
    </Route>
  );
}
