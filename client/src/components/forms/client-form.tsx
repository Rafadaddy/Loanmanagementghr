import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingButton } from "@/components/ui/loading";
import { insertClienteSchema, Cliente, Cobrador } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Esquema para el formulario
const clientFormSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  telefono: z.string().min(7, "El teléfono debe tener al menos 7 dígitos"),
  direccion: z.string(),
  documento_identidad: z.string().min(6, "El documento debe tener al menos 6 caracteres"),
  cobrador_id: z.string().optional()
    .transform(val => val === "" || val === undefined ? null : Number(val))
});

// Interfaz para los valores del formulario
interface ClientFormValues {
  nombre: string;
  telefono: string;
  direccion: string;
  documento_identidad: string;
  cobrador_id: string;
}

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente;
  onSuccess?: () => void;
}

export default function ClientForm({ open, onOpenChange, cliente, onSuccess }: ClientFormProps) {
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const isEditing = !!cliente;

  // Obtener la lista de cobradores
  const { data: cobradores = [], isLoading: isLoadingCobradores } = useQuery<Cobrador[]>({
    queryKey: ["/api/cobradores"],
    enabled: open // Solo hacer la consulta cuando el modal está abierto
  });

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      nombre: cliente?.nombre || "",
      telefono: cliente?.telefono || "",
      direccion: cliente?.direccion || "",
      documento_identidad: cliente?.documento_identidad || "",
      cobrador_id: cliente?.cobrador_id ? String(cliente.cobrador_id) : ""
    }
  });
  
  // Actualizar valores del formulario cuando cambia el cliente
  useEffect(() => {
    if (cliente) {
      form.reset({
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        documento_identidad: cliente.documento_identidad,
        cobrador_id: cliente.cobrador_id ? String(cliente.cobrador_id) : ""
      });
    }
  }, [cliente, form]);

  const mutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      if (isEditing) {
        const res = await apiRequest("PUT", `/api/clientes/${cliente.id}`, values);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/clientes", values);
        return res.json();
      }
    },
    onSuccess: () => {
      // Invalidamos las consultas relevantes para refrescar los datos automáticamente
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estadisticas"] });
      
      // Invalidar también consultas de préstamos, ya que pueden mostrar datos de clientes
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/prestamos" ||
          (query.queryKey[0] === "/api/clientes" && query.queryKey.length > 1)
      });
      
      toast({
        title: isEditing ? "Cliente actualizado" : "Cliente registrado",
        description: isEditing 
          ? "Los datos del cliente se han actualizado correctamente." 
          : "El nuevo cliente ha sido registrado con éxito."
      });
      
      form.reset();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo ${isEditing ? "actualizar" : "registrar"} el cliente: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  function onSubmit(values: ClientFormValues) {
    // Mostrar indicador de carga global
    startLoading(isEditing ? "Actualizando cliente..." : "Registrando cliente...");
    
    mutation.mutate(values, {
      onSettled: () => {
        // Detener el indicador independientemente del resultado
        stopLoading();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cliente" : "Registrar Nuevo Cliente"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="documento_identidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento de Identidad</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cobrador_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cobrador Asignado</FormLabel>
                  <Select
                    value={field.value !== undefined ? String(field.value) : ""}
                    onValueChange={field.onChange}
                    disabled={isLoadingCobradores}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cobrador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sin cobrador asignado</SelectItem>
                      {cobradores.map((cobrador) => (
                        <SelectItem key={cobrador.id} value={String(cobrador.id)}>
                          {cobrador.nombre} ({cobrador.zona})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="bg-primary hover:bg-blue-600"
              >
                {mutation.isPending 
                  ? (isEditing ? "Actualizando..." : "Guardando...") 
                  : (isEditing ? "Actualizar Cliente" : "Guardar Cliente")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
