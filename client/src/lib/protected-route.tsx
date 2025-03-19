import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, Redirect } from "wouter";

// Creamos un componente separado para el contenido protegido
function ProtectedContent({ 
  component: Component 
}: { 
  component: () => React.JSX.Element 
}) {
  const { user, isLoading } = useAuth();

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

  return <Component />;
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
