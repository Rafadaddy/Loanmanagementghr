import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function DirectAccess() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isActive, setIsActive] = useState(() => {
    return localStorage.getItem('direct_admin_access') === 'true';
  });

  const handleDirectAccess = () => {
    localStorage.setItem('direct_admin_access', 'true');
    setIsActive(true);
    
    // Notificamos al usuario
    toast({
      title: "Acceso activado",
      description: "Se ha activado el acceso directo al sistema.",
      variant: "default",
    });
    
    // Redirigimos al usuario a la página principal
    setTimeout(() => {
      navigate("/");
    }, 1000);
  };

  return (
    <>
      <CardContent className="pt-1">
        <div className="border-t border-border my-2"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Acceso directo</p>
            <p className="text-xs text-muted-foreground">
              {isActive ? (
                <span className="flex items-center text-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Activado
                </span>
              ) : (
                <span className="flex items-center text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Desactivado
                </span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant={isActive ? "outline" : "default"} 
          size="sm" 
          className="w-full"
          onClick={handleDirectAccess}
          disabled={isActive}
        >
          {isActive ? "Acceso activado" : "Acceder como Administrador"}
        </Button>
      </CardFooter>
    </>
  );
}