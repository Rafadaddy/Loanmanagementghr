import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export function BypassAuth() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [bypassEnabled, setBypassEnabled] = useState(
    localStorage.getItem("auth_bypass") === "true"
  );
  
  // Actualizar localStorage cuando cambia el estado
  useEffect(() => {
    if (bypassEnabled) {
      localStorage.setItem("auth_bypass", "true");
    } else {
      localStorage.removeItem("auth_bypass");
    }
  }, [bypassEnabled]);
  
  // Función para activar el bypass y navegar al dashboard
  const activateBypass = () => {
    localStorage.setItem("auth_bypass", "true");
    setBypassEnabled(true);
    
    toast({
      title: "Modo de acceso directo activado",
      description: "Acceso temporal habilitado. Las credenciales no son necesarias.",
      variant: "default"
    });
    
    // Refrescar la página para que se apliquen los cambios
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  };
  
  // Función para desactivar el bypass
  const deactivateBypass = () => {
    localStorage.removeItem("auth_bypass");
    setBypassEnabled(false);
    
    toast({
      title: "Modo de acceso directo desactivado",
      description: "Se ha desactivado el acceso directo.",
      variant: "default"
    });
  };
  
  return (
    <Card className="mt-6 border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-amber-500 flex items-center gap-2">
          <ShieldAlert size={20} />
          Modo de Acceso Directo
        </CardTitle>
        <CardDescription>
          Opción temporal para resolver problemas de acceso al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uso temporal</AlertTitle>
          <AlertDescription>
            Esta opción es para uso temporal mientras se resuelven problemas con 
            la base de datos o autenticación. Usar solo en entornos seguros.
          </AlertDescription>
        </Alert>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch 
            id="bypass-mode" 
            checked={bypassEnabled}
            onCheckedChange={setBypassEnabled}
          />
          <Label htmlFor="bypass-mode">
            {bypassEnabled ? "Modo bypass activado" : "Modo bypass desactivado"}
          </Label>
        </div>
        
        <Button 
          onClick={bypassEnabled ? deactivateBypass : activateBypass}
          variant={bypassEnabled ? "outline" : "default"}
          className="w-full"
        >
          {bypassEnabled ? "Desactivar acceso directo" : "Activar acceso directo"}
        </Button>
      </CardContent>
    </Card>
  );
}