import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading";

// Categorías predefinidas para ingresos y egresos
const categoriasIngreso = [
  "Pago de Préstamo",
  "Inversión",
  "Venta",
  "Ingreso Extra",
  "Otro Ingreso",
];

const categoriasEgreso = [
  "Gastos Operativos",
  "Nuevo Préstamo",
  "Pago de Servicios",
  "Compra de Suministros",
  "Salario",
  "Transporte",
  "Otro Gasto",
];

// Esquema de validación
const formSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  categoria: z.string().min(1, "La categoría es requerida"),
  monto: z.string().min(1, "El monto es requerido"),
  fecha: z.date({
    required_error: "La fecha es requerida",
  }),
  descripcion: z.string().optional(),
  cliente_id: z.number().nullable().optional(),
  prestamo_id: z.number().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RegistroMovimientoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function RegistroMovimientoForm({
  open,
  onOpenChange,
  onSuccess,
}: RegistroMovimientoFormProps) {
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Obtener clientes para asociarlos al movimiento (opcional)
  const { data: clientes = [] } = useQuery({
    queryKey: ['/api/clientes'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clientes?user_id=${user?.id || 1}`);
      return res.json();
    },
    enabled: open, // Solo cargar cuando el formulario está abierto
  });

  // Obtener préstamos para asociarlos al movimiento (opcional)
  const { data: prestamos = [] } = useQuery({
    queryKey: ['/api/prestamos'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/prestamos?user_id=${user?.id || 1}`);
      return res.json();
    },
    enabled: open, // Solo cargar cuando el formulario está abierto
  });

  // Formulario
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "INGRESO",
      categoria: "",
      monto: "",
      fecha: new Date(),
      descripcion: "",
      cliente_id: null,
      prestamo_id: null,
    },
  });

  // Obtener el tipo seleccionado para mostrar categorías adecuadas
  const tipoSeleccionado = form.watch("tipo");

  // Mutación para crear movimiento
  const crearMovimientoMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      console.log("Enviando datos originales:", values);
      
      // Asegurar que el usuario esté autenticado
      if (!user) {
        console.error("No hay un usuario autenticado");
        await refetchUser();
        if (!user) {
          throw new Error("Debe iniciar sesión para realizar esta operación");
        }
      }
      
      // Procesar datos para asegurar que tienen el formato correcto
      const dataToSend = {
        ...values,
        // Asegurar que el monto sea un string y sea un número válido
        monto: parseFloat(values.monto).toString(),
        // Asegurar que los IDs son null si son 0
        cliente_id: values.cliente_id === 0 ? null : values.cliente_id,
        prestamo_id: values.prestamo_id === 0 ? null : values.prestamo_id,
        // Descripción puede ser null
        descripcion: values.descripcion || null,
        // Incluir el ID del usuario actual
        creado_por: user?.id
      };
      
      console.log("Enviando datos procesados:", dataToSend);
      console.log("Usuario actual:", user?.username, "ID:", user?.id);
      console.log("Enviando petición a /api/caja/movimientos con datos:", dataToSend);
      
      try {
        // Añadir un parámetro user_id para modo de emergencia en caso de fallo de autenticación
        const res = await apiRequest("POST", `/api/caja/movimientos?user_id=${user?.id || 1}`, {
          ...dataToSend,
          // aseguramos que la descripción sea string o undefined, nunca null
          descripcion: dataToSend.descripcion || undefined
        });
        
        // apiRequest ya lanza un error si res.ok es false, así que si llegamos aquí es porque la respuesta fue exitosa
        console.log("Respuesta exitosa del servidor:", res.status);
        return await res.json();
      } catch (error) {
        console.error("Error capturado en la petición:", error);
        // Re-lanzar el error para que lo maneje onError
        throw error;
      }
    },
    onMutate: () => {
      setIsFormSubmitting(true);
      startLoading("Registrando movimiento...");
    },
    onSuccess: () => {
      // Limpiar formulario y cerrar modal
      form.reset();
      onOpenChange(false);
      
      // Ejecutar callback de éxito si existe
      if (onSuccess) {
        onSuccess();
      }
      
      // Detener indicador de carga
      setIsFormSubmitting(false);
      stopLoading();
      
      // Mostrar mensaje de éxito
      toast({
        title: "Movimiento registrado",
        description: "El movimiento ha sido registrado correctamente",
        variant: "default",
      });
      
      // Invalidar consultas para actualizar datos
      queryClient.invalidateQueries({ queryKey: ['/api/caja/movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/caja/resumen'] });
    },
    onError: (error: Error) => {
      console.error("Error al crear movimiento:", error);
      
      // Verificar si es un error de autenticación
      if (error.message.includes("401") || error.message.includes("No autorizado") || error.message.includes("iniciar sesión")) {
        toast({
          title: "Error de autenticación",
          description: "Su sesión ha expirado. Por favor, inicie sesión nuevamente.",
          variant: "destructive",
        });
        
        // Intentar refrescar la sesión
        refetchUser().catch(() => {
          // Si falla, redirigir a la página de login
          window.location.href = '/auth';
        });
      } else {
        toast({
          title: "Error",
          description: `Error al registrar el movimiento: ${error.message}`,
          variant: "destructive",
        });
      }
      
      setIsFormSubmitting(false);
      stopLoading();
    },
  });

  // Resetear formulario al cerrarse
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  // Manejar envío del formulario
  function onSubmit(values: FormValues) {
    // Validar que el monto sea un número positivo
    const monto = parseFloat(values.monto);
    if (isNaN(monto) || monto <= 0) {
      toast({
        title: "Error de validación",
        description: "El monto debe ser un número positivo",
        variant: "destructive",
      });
      return;
    }
    
    // Asegurarnos de que todos los campos tienen valores correctos
    const formattedValues = {
      ...values,
      monto: monto.toString(), // Convertir a string después de validar
      cliente_id: values.cliente_id === 0 ? null : values.cliente_id,
      prestamo_id: values.prestamo_id === 0 ? null : values.prestamo_id, 
      // La descripción ahora se mantiene como string undefined en lugar de null
    };
    
    console.log("Enviando datos formateados:", formattedValues);
    crearMovimientoMutation.mutate(formattedValues);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento de Caja</DialogTitle>
          <DialogDescription>
            Complete la información para registrar un nuevo movimiento de caja
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Tipo de Movimiento */}
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de movimiento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INGRESO">Ingreso</SelectItem>
                      <SelectItem value="EGRESO">Egreso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Seleccione si es un ingreso o egreso de dinero
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Categoría */}
            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tipoSeleccionado === "INGRESO" ? (
                        categoriasIngreso.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))
                      ) : (
                        categoriasEgreso.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Categoría a la que pertenece este movimiento
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Cliente relacionado (opcional) */}
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente Relacionado (Opcional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))} 
                    defaultValue={field.value ? String(field.value) : "0"}
                    value={field.value ? String(field.value) : "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un cliente (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">-- Ninguno --</SelectItem>
                      {clientes.map((cliente: any) => (
                        <SelectItem key={cliente.id} value={String(cliente.id)}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Si este movimiento está relacionado con un cliente específico
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Préstamo relacionado (opcional) */}
            <FormField
              control={form.control}
              name="prestamo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Préstamo Relacionado (Opcional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))} 
                    defaultValue={field.value ? String(field.value) : "0"}
                    value={field.value ? String(field.value) : "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un préstamo (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">-- Ninguno --</SelectItem>
                      {prestamos.map((prestamo: any) => {
                        const cliente = clientes.find((c: any) => c.id === prestamo.cliente_id);
                        return (
                          <SelectItem key={prestamo.id} value={String(prestamo.id)}>
                            {cliente?.nombre} - ${prestamo.monto_prestado}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Si este movimiento está relacionado con un préstamo específico
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Monto */}
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Cantidad de dinero {tipoSeleccionado === "INGRESO" ? "ingresado" : "egresado"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Fecha */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha del Movimiento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccione una fecha</span>
                          )}
                          <i className="fas fa-calendar-alt ml-auto h-4 w-4 opacity-50"></i>
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Fecha en que se realizó el movimiento
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ingrese una descripción del movimiento" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Detalles adicionales sobre este movimiento
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isFormSubmitting}>
                {isFormSubmitting ? <LoadingButton /> : "Registrar Movimiento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}