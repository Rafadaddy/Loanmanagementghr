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
    "Intereses", 
    "Mora por Atraso",
    "Inversión", 
    "Depósito",
    "Venta de Activo",
    "Otro Ingreso"
  ];
  
  const categoriasEgreso = [
    "Nómina", 
    "Comisiones",
    "Gasolina", 
    "Viáticos",
    "Papelería", 
    "Alquiler",
    "Servicios Públicos",
    "Impuestos",
    "Mantenimiento",
    "Gastos Operativos", 
    "Publicidad",
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
      console.log("Enviando datos originales:", values);
      
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
      };
      
      console.log("Enviando datos procesados:", dataToSend);
      
      const res = await apiRequest("POST", "/api/caja/movimientos", dataToSend);
      
      if (!res.ok) {
        let errorMessage = "Error al crear el movimiento";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
          console.error("Error respuesta:", errorData);
        } catch (e) {
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
          console.error("Error texto:", errorText);
        }
        throw new Error(errorMessage);
      }
      
      return await res.json();
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
    },
    onError: (error: Error) => {
      console.error("Error al crear movimiento:", error);
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
    
    // Asegurarnos de que todos los campos tienen valores correctos
    const formattedValues = {
      ...values,
      monto: monto.toString(), // Convertir a string después de validar
      cliente_id: values.cliente_id === 0 ? null : values.cliente_id,
      prestamo_id: values.prestamo_id === 0 ? null : values.prestamo_id,
      descripcion: values.descripcion || null,
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