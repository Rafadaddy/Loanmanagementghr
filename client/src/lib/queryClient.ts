import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Verificar si el acceso directo está activado
  const hasDirectAccess = localStorage.getItem('direct_admin_access') === 'true';
  
  // Construir los headers
  const headers: Record<string, string> = {};
  
  // Agregar Content-Type si hay datos
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Agregar cabecera de acceso directo si está activado
  if (hasDirectAccess) {
    headers["x-direct-admin-access"] = "true";
    // Guardar también como cookie para mayor compatibilidad
    document.cookie = "direct_admin_access=true; path=/; max-age=86400";
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Verificar si el acceso directo está activado
    const hasDirectAccess = localStorage.getItem('direct_admin_access') === 'true';
    
    // Construir los headers
    const headers: Record<string, string> = {};
    
    // Agregar cabecera de acceso directo si está activado
    if (hasDirectAccess) {
      headers["x-direct-admin-access"] = "true";
      // Guardar también como cookie para mayor compatibilidad
      document.cookie = "direct_admin_access=true; path=/; max-age=86400";
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,  // Actualizamos cuando se vuelve a enfocar la ventana
      staleTime: 5 * 60 * 1000,    // Consideramos los datos obsoletos después de 5 minutos
      retry: false,
      refetchOnMount: 'always',    // Siempre actualizar al montar el componente
    },
    mutations: {
      retry: false,
    },
  },
});
