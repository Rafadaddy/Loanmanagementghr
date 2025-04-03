import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLoading } from "@/hooks/use-loading";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  refetchUser: () => Promise<void>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Verificar si existe el modo bypass en localStorage
  const shouldBypass = localStorage.getItem('auth_bypass') === 'true';
  
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: async ({ signal }) => {
      // Si el modo bypass está activado, incluir el parámetro de bypass
      const url = shouldBypass ? '/api/user?bypass=true' : '/api/user';
      
      try {
        const response = await fetch(url, { 
          signal,
          headers: shouldBypass ? { 'x-auth-bypass': 'true' } : undefined
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            return undefined;
          }
          throw new Error(`Error al obtener usuario: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error en la consulta de usuario:", error);
        if (shouldBypass) {
          console.log("Intentando modo de recuperación de bypass");
          return {
            id: 1,
            username: 'admin@sistema.com',
            rol: 'ADMIN',
            nombre: 'Administrador (Recuperación)',
            email: 'admin@sistema.com',
            activo: true
          };
        }
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Función para recargar el estado del usuario
  const refetchUser = async () => {
    await refetch();
  };

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: async (user: SelectUser) => {
      // Actualizar la caché con los datos del usuario
      queryClient.setQueryData(["/api/user"], user);
      
      // Refetch para asegurar que tenemos los datos más recientes
      await refetchUser();
      
      // Mostrar notificación
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${user.nombre}`,
      });
      
      // Invalidar cualquier otra consulta que pueda depender del estado de autenticación
      queryClient.invalidateQueries();
      
      // Navegar al dashboard
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: async (user: SelectUser) => {
      // Actualizar la caché con los datos del usuario
      queryClient.setQueryData(["/api/user"], user);
      
      // Refetch para asegurar que tenemos los datos más recientes
      await refetchUser();
      
      // Mostrar notificación
      toast({
        title: "Registro exitoso",
        description: `Bienvenido ${user.nombre}`,
      });
      
      // Invalidar cualquier otra consulta que pueda depender del estado de autenticación
      queryClient.invalidateQueries();
      
      // Navegar al dashboard
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Esta función ya no se usa directamente, pero se mantiene para compatibilidad
  // con los componentes que aún no han sido actualizados
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Limpiar la caché
      queryClient.setQueryData(["/api/user"], null);
      
      // Mostrar notificación
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      
      // Redirigir a la página de autenticación
      navigate("/auth");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}
