import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Esquema de validación para el formulario
const credencialesFormSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  username: z
    .string()
    .email("Ingrese una dirección de correo válida")
    .min(1, "El correo electrónico es obligatorio"),
  passwordActual: z
    .string()
    .min(6, "La contraseña actual debe tener al menos 6 caracteres"),
  password: z
    .string()
    .min(6, "La nueva contraseña debe tener al menos 6 caracteres")
    .optional(),
  confirmarPassword: z.string().optional(),
}).refine(data => !data.password || data.password === data.confirmarPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarPassword"],
});

type CredencialesFormValues = z.infer<typeof credencialesFormSchema>;

export default function UserCredentialsSection() {
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<CredencialesFormValues>({
    resolver: zodResolver(credencialesFormSchema),
    defaultValues: {
      nombre: user?.nombre || "",
      username: user?.username || "",
      passwordActual: "",
      password: "",
      confirmarPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: CredencialesFormValues) => {
      // Eliminar confirmarPassword antes de enviar al servidor
      const { confirmarPassword, ...dataToSend } = values;
      
      // Si password está vacío, no lo enviamos
      if (!dataToSend.password) {
        const { password, ...dataWithoutPassword } = dataToSend;
        return apiRequest("POST", "/api/cambiar-credenciales", dataWithoutPassword);
      }
      
      return apiRequest("POST", "/api/cambiar-credenciales", dataToSend);
    },
    onSuccess: async () => {
      toast({
        title: "Credenciales actualizadas",
        description: "Tus credenciales han sido actualizadas correctamente."
      });
      
      // Recargar datos del usuario
      await refetchUser();
      
      // Cerrar el diálogo y resetear el formulario
      setDialogOpen(false);
      form.reset({
        nombre: user?.nombre || "",
        username: user?.username || "",
        passwordActual: "",
        password: "",
        confirmarPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudieron actualizar las credenciales: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  function onSubmit(values: CredencialesFormValues) {
    mutation.mutate(values);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Credenciales de Usuario</CardTitle>
        <CardDescription>
          Administra tus credenciales de acceso al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium">Nombre</h3>
              <p className="text-sm text-muted-foreground">{user?.nombre || "No especificado"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Correo Electrónico</h3>
              <p className="text-sm text-muted-foreground">{user?.username}</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Cambiar Credenciales</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cambiar Credenciales</DialogTitle>
                <DialogDescription>
                  Actualiza tu nombre, correo electrónico o contraseña. Deja la nueva contraseña en blanco si no deseas cambiarla.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="passwordActual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña Actual</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nueva Contraseña (opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormDescription>
                          Deja en blanco para mantener la contraseña actual
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmarPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {mutation.isPending ? "Actualizando..." : "Actualizar Credenciales"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}