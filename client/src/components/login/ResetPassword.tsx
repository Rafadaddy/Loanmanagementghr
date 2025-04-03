import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, UserCog } from "lucide-react";

export function ResetPassword() {
  const [username, setUsername] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async () => {
    if (!username) {
      toast({
        title: "Error",
        description: "Por favor, ingresa un nombre de usuario",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch(`/api/debug/reset-password/${encodeURIComponent(username)}`);
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: `La contraseña de ${username} ha sido restablecida a "123456"`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Error al restablecer contraseña",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al comunicarse con el servidor",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateAdmin = async () => {
    setIsCreatingAdmin(true);
    try {
      const response = await fetch("/api/debug/ensure-admin");
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Usuario administrador creado/actualizado correctamente.",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Error al crear usuario administrador",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al comunicarse con el servidor",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  return (
    <>
      <CardContent className="pt-1">
        <div className="border-t border-border my-2"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Herramientas de recuperación</p>
            <p className="text-xs text-muted-foreground">
              Usuario admin: admin@sistema.com (Contraseña: admin123)
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Input
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-2"
          />
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          className="flex-1"
          onClick={handleResetPassword}
          disabled={isResetting}
        >
          {isResetting ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <KeyRound className="mr-1 h-3 w-3" />
              Restablecer clave
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleCreateAdmin}
          disabled={isCreatingAdmin}
        >
          {isCreatingAdmin ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <UserCog className="mr-1 h-3 w-3" />
              Crear admin
            </>
          )}
        </Button>
      </CardFooter>
    </>
  );
}