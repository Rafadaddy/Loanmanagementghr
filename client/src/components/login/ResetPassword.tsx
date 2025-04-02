import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
          description: "Usuario administrador creado/actualizado correctamente. Usuario: admin@sistema.com, Contraseña: admin123",
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
    <div className="mt-6 flex flex-col space-y-4 p-4 border border-muted rounded-md">
      <h3 className="text-sm font-medium text-center">¿Olvidaste tu contraseña?</h3>
      
      <div className="flex flex-col space-y-2">
        <Input
          placeholder="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleResetPassword}
          disabled={isResetting}
        >
          {isResetting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restableciendo...
            </>
          ) : (
            "Restablecer contraseña"
          )}
        </Button>
      </div>
      
      <div className="flex flex-col space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCreateAdmin}
          disabled={isCreatingAdmin}
        >
          {isCreatingAdmin ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando admin...
            </>
          ) : (
            "Crear/Actualizar usuario admin"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Usuario: admin@sistema.com<br />
          Contraseña: admin123
        </p>
      </div>
    </div>
  );
}