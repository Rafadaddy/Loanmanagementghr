import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Si el usuario ya está autenticado, redirigir a la página principal
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Estados para los formularios
  const [loginData, setLoginData] = useState({
    username: "",
    password: ""
  });
  
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    nombre: "",
    email: "",
    rol: "USER"
  });
  
  // Manejar inicio de sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await loginMutation.mutateAsync(loginData);
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido al sistema de préstamos",
        variant: "default"
      });
    } catch (error) {
      console.error("Error de inicio de sesión:", error);
      toast({
        title: "Error de inicio de sesión",
        description: "Credenciales inválidas. Por favor, intente de nuevo.",
        variant: "destructive"
      });
    }
  };
  
  // Manejar registro
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await registerMutation.mutateAsync(registerData);
      toast({
        title: "Registro exitoso",
        description: "Se ha creado su cuenta correctamente",
        variant: "default"
      });
    } catch (error) {
      console.error("Error de registro:", error);
      toast({
        title: "Error de registro",
        description: "No se pudo crear la cuenta. Puede que el nombre de usuario ya exista.",
        variant: "destructive"
      });
    }
  };
  
  // Si está cargando, mostrar indicador
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Lado izquierdo - Formularios */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Tabs defaultValue="login" className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>
          
          {/* Formulario de inicio de sesión */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Iniciar Sesión</CardTitle>
                <CardDescription>
                  Ingrese sus credenciales para acceder al sistema.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Nombre de usuario</Label>
                    <Input
                      id="login-username"
                      placeholder="usuario@correo.com"
                      value={loginData.username}
                      onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : "Iniciar Sesión"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          
          {/* Formulario de registro */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Crear Cuenta</CardTitle>
                <CardDescription>
                  Complete el formulario para registrarse en el sistema.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Nombre de usuario</Label>
                    <Input
                      id="register-username"
                      placeholder="usuario@correo.com"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Correo electrónico</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nombre completo</Label>
                    <Input
                      id="register-name"
                      placeholder="Juan Pérez"
                      value={registerData.nombre}
                      onChange={(e) => setRegisterData({...registerData, nombre: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : "Crear Cuenta"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Lado derecho - Hero section */}
      <div className="flex-1 bg-primary text-primary-foreground hidden lg:flex flex-col justify-center p-12">
        <div className="max-w-lg mx-auto space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Sistema de Gestión de Préstamos</h1>
          <p className="text-xl">
            Plataforma integral para administrar préstamos, clientes y cobranzas de manera eficiente y segura.
          </p>
          <ul className="space-y-2 text-lg">
            <li>✓ Gestión completa de clientes y préstamos</li>
            <li>✓ Seguimiento de pagos y recordatorios</li>
            <li>✓ Control de caja y movimientos financieros</li>
            <li>✓ Reportes detallados y exportables</li>
            <li>✓ Perfiles de cobradores y rutas</li>
          </ul>
        </div>
      </div>
    </div>
  );
}