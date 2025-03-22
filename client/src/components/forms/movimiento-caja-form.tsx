import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadingButton } from "@/components/ui/loading";
import { insertMovimientoCajaSchema, Cliente, Prestamo } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLoading } from "@/hooks/use-loading";
import { formatCurrency, cn } from "@/lib/utils";

// Esquema extendido para validación del formulario
const movimientoCajaFormSchema = insertMovimientoCajaSchema.extend({
  tipo: z.enum(["INGRESO", "EGRESO"], {
    required_error: "Debe seleccionar un tipo de movimiento",
  }),
  monto: z.string().min(1, "El monto es requerido"),
  categoria: z.string().min(1, "La categoría es requerida"),
  fecha: z.date({
    required_error: "La fecha es requerida",
  }),
});

// Tipo para los valores del formulario
type MovimientoCajaFormValues = z.infer<typeof movimientoCajaFormSchema>;

// Props del componente
interface MovimientoCajaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Componente principal del formulario
export default function MovimientoCajaForm({ open, onOpenChange, onSuccess }: MovimientoCajaFormProps) {
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  
  // Cargar datos de clientes para vincular movimientos
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
    enabled: open,
  });
  
  // Cargar datos de préstamos para vincular movimientos
  const { data: prestamos = [] } = useQuery<Prestamo[]>({
    queryKey: ["/api/prestamos"],
    enabled: open,
  });
  
  // Opciones de categorías
  const categoriasIngreso = [
    "Préstamo Nuevo", 
    "Pago de Préstamo", 
    "Inversión", 
    "Otro Ingreso"
  ];
  
  const categoriasEgreso = [
    "Sueldo", 
    "Gasolina", 
    "Papelería", 
    "Comisiones", 
    "Gastos Operativos", 
    "Otro Gasto"
  ];
  
  // Formulario con react-hook-form y zod
  const form = useForm<MovimientoCajaFormValues>({
    resolver: zodResolver(movimientoCajaFormSchema),
    defaultValues: {
      tipo: "INGRESO",
      monto: "",
      categoria: "",
      descripcion: "",
      fecha: new Date(),
      cliente_id: null,
      prestamo_id: null,
    },
  });
  
  // Obtener el tipo seleccionado para mostrar categorías adecuadas
  const tipoSeleccionado = form.watch("tipo");
  
  // Mutación para crear movimiento
  const crearMovimientoMutation = useMutation({
    mutationFn: async (values: MovimientoCajaFormValues) => {
      const res = await apiRequest("POST", "/api/caja/movimientos", values);
      return await res.json();
    },
    onMutate: () => {
      setIsFormSubmitting(true);
      startLoading("Registrando movimiento...");
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Movimiento registrado correctamente",
      });
      
      // Limpiar formulario y cerrar modal
      form.reset();
      onOpenChange(false);
      
      // Ejecutar callback de éxito si existe
      if (onSuccess) {
        onSuccess();
      }
      
      // Recargar la página después de un breve retraso
      setTimeout(() => {
        stopLoading();
        window.location.reload();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al registrar el movimiento: ${error.message}`,
        variant: "destructive",
      });
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
  function onSubmit(values: MovimientoCajaFormValues) {
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
    
    crearMovimientoMutation.mutate(values);
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
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                    defaultValue={field.value ? String(field.value) : ""}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un cliente (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">-- Ninguno --</SelectItem>
                      {clientes.map((cliente) => (
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
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                    defaultValue={field.value ? String(field.value) : ""}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un préstamo (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">-- Ninguno --</SelectItem>
                      {prestamos.map((prestamo) => {
                        const cliente = clientes.find(c => c.id === prestamo.cliente_id);
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