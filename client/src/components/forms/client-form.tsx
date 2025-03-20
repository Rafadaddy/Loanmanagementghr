import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertClienteSchema, Cliente } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

// Extender el esquema para validación del formulario
const clientFormSchema = insertClienteSchema.extend({
  documento_identidad: z.string().min(6, "El documento debe tener al menos 6 caracteres"),
  telefono: z.string().min(7, "El teléfono debe tener al menos 7 dígitos")
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente;
  onSuccess?: () => void;
}

export default function ClientForm({ open, onOpenChange, cliente, onSuccess }: ClientFormProps) {
  const { toast } = useToast();
  const isEditing = !!cliente;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      nombre: cliente?.nombre || "",
      telefono: cliente?.telefono || "",
      direccion: cliente?.direccion || "",
      documento_identidad: cliente?.documento_identidad || ""
    }
  });
  
  // Actualizar valores del formulario cuando cambia el cliente
  useEffect(() => {
    if (cliente) {
      form.reset({
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        documento_identidad: cliente.documento_identidad
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
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estadisticas"] });
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
    mutation.mutate(values);
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
