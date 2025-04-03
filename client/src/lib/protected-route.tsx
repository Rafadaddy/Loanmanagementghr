import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, Redirect } from "wouter";
import { useEffect } from "react";
import SidebarToggle from "@/components/navigation/sidebar-toggle";

// Creamos un componente separado para el contenido protegido
function ProtectedContent({ 
  component: Component 
}: { 
  component: () => React.JSX.Element 
}) {
  const { user, isLoading } = useAuth();
  
  // Verificar si el modo de acceso directo está activado
  const hasDirectAccess = localStorage.getItem('direct_admin_access') === 'true';
  
  useEffect(() => {
    // Si se detecta el modo de acceso directo, forzamos un refresh al cargar
    // Esto ayuda a garantizar que la página se cargue correctamente la primera vez
    if (hasDirectAccess && !sessionStorage.getItem('page_refreshed')) {
      console.log("Modo de acceso directo detectado, aplicando configuración inicial");
      sessionStorage.setItem('page_refreshed', 'true');
    }
  }, [hasDirectAccess]);

  // Si el modo de acceso directo está activado, mostramos el componente directamente
  if (hasDirectAccess) {
    console.log("Acceso directo activado, permitiendo acceso a ruta protegida");
    return (
      <>
        <Component />
        <SidebarToggle />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <>
      <Component />
      <SidebarToggle />
    </>
  );
}

// Componente de ruta protegida
export function ProtectedRoute({
  path,
  component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  return (
    <Route path={path}>
      <ProtectedContent component={component} />
    </Route>
  );
}
