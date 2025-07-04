import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingButton } from "@/components/ui/loading";
import { insertPagoSchema, Prestamo, Cliente } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";

// Esquema para validación de pago
const paymentFormSchema = z.object({
  prestamo_id: z.string().min(1, "Debe seleccionar un préstamo"),
  monto_pagado: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "El monto debe ser un número positivo"
  }),
  fecha_pago: z.string().min(1, "Debe seleccionar una fecha de pago"),
  semana_pago: z.string().optional(), // Campo para la semana del pago
  // Añadimos un mensaje opcional que no se enviará al servidor
  es_pago_parcial_confirmado: z.boolean().optional()
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prestamoId?: number; // ID del préstamo pre-seleccionado
  clienteNombre?: string; // Nombre del cliente pre-seleccionado
}

interface PrestamoConCliente extends Prestamo {
  cliente?: Cliente;
}

export default function PaymentForm({ open, onOpenChange, onSuccess, prestamoId, clienteNombre }: PaymentFormProps) {
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<PrestamoConCliente | null>(null);
  const [showParcialAlert, setShowParcialAlert] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [montoEditado, setMontoEditado] = useState(false); // Track if user has manually edited the amount
  const [montoLimpiado, setMontoLimpiado] = useState(false); // Track if user has manually cleared the amount

  // Obtener la lista de préstamos activos
  const { data: prestamos = [] } = useQuery<Prestamo[]>({ 
    queryKey: ["/api/prestamos"],
    select: (data) => data.filter(p => p.estado !== "PAGADO")
  });

  // Obtener la lista de clientes (para mostrar nombre del cliente)
  const { data: clientes = [] } = useQuery<Cliente[]>({ 
    queryKey: ["/api/clientes"]
  });

  // Combinar préstamos con datos de clientes
  const prestamosConCliente: PrestamoConCliente[] = prestamos.map(prestamo => {
    const cliente = clientes.find(c => c.id === prestamo.cliente_id);
    return { ...prestamo, cliente };
  });
  
  // Lista filtrada de préstamos según el término de búsqueda
  const filteredPrestamos = searchTerm.trim() === "" 
    ? prestamosConCliente 
    : prestamosConCliente.filter((prestamo: PrestamoConCliente) => {
        const searchTermLower = searchTerm.toLowerCase();
        const clienteNombre = prestamo.cliente?.nombre?.toLowerCase() || "";
        const montoStr = prestamo.monto_prestado.toString();
        const pagoSemanalStr = prestamo.pago_semanal.toString();
        
        return clienteNombre.includes(searchTermLower) || 
              montoStr.includes(searchTermLower) ||
              pagoSemanalStr.includes(searchTermLower);
      });

  // Función para obtener fecha local en formato YYYY-MM-DD sin problemas de zona horaria
  const getFechaLocal = (): string => {
    // Crear fecha con el año, mes y día actuales sin conversiones UTC
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fechaLocal = `${año}-${mes}-${dia}`;
    console.log("DEBUG - Fecha local generada:", fechaLocal, "vs fecha actual:", hoy.toLocaleDateString());
    return fechaLocal;
  };

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      prestamo_id: "",
      monto_pagado: "",
      fecha_pago: getFechaLocal(), // Fecha actual en formato YYYY-MM-DD sin problemas de zona horaria
      semana_pago: ""
    }
  });

  // Efecto para pre-seleccionar préstamo cuando se proporciona uno
  useEffect(() => {
    if (open && prestamoId && prestamosConCliente.length > 0) {
      const prestamo = prestamosConCliente.find(p => p.id === prestamoId);
      if (prestamo) {
        setPrestamoSeleccionado(prestamo);
        form.setValue("prestamo_id", prestamoId.toString());
        // Solo establecer el monto si no ha sido editado manualmente y no ha sido limpiado
        if (!montoEditado && !montoLimpiado) {
          form.setValue("monto_pagado", prestamo.pago_semanal.toString());
        }
        // Limpiar el término de búsqueda para mostrar solo el préstamo seleccionado
        setSearchTerm("");
      }
    }
  }, [open, prestamoId, prestamosConCliente, form, montoEditado, montoLimpiado]);

  // Limpiar formulario cuando se cierra
  useEffect(() => {
    if (!open) {
      form.reset({
        prestamo_id: "",
        monto_pagado: "",
        fecha_pago: getFechaLocal(), // Usar la función local consistente
        semana_pago: ""
      });
      setPrestamoSeleccionado(null);
      setSearchTerm("");
      setShowParcialAlert(false);
      setMontoEditado(false); // Reset edit state
      setMontoLimpiado(false); // Reset cleared state
    }
  }, [open, form]);

  // Función para calcular la semana del pago basada en la fecha de inicio del préstamo
  const calcularSemanaPago = (fechaInicioPrestamo: string, fechaPago: string): number => {
    const fechaInicio = new Date(fechaInicioPrestamo);
    const fechaPagoDate = new Date(fechaPago);
    
    // Calcular la diferencia en días
    const diffTime = fechaPagoDate.getTime() - fechaInicio.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calcular la semana (cada 7 días es una semana)
    const semana = Math.ceil(diffDays / 7);
    
    return semana > 0 ? semana : 1;
  };

  // Al cambiar el préstamo seleccionado, establecer monto semanal y semana por defecto
  const handlePrestamoChange = (id: string) => {
    if (!id) {
      setPrestamoSeleccionado(null);
      form.setValue("monto_pagado", "");
      form.setValue("semana_pago", "");
      setMontoEditado(false);
      setMontoLimpiado(false);
      return;
    }
    
    const prestamo = prestamosConCliente.find(p => p.id === parseInt(id));
    if (prestamo) {
      setPrestamoSeleccionado(prestamo);
      // Solo establecer el monto si no ha sido editado manualmente y no ha sido limpiado
      if (!montoEditado && !montoLimpiado) {
        form.setValue("monto_pagado", prestamo.pago_semanal.toString());
      }
      
      // Calcular y establecer la semana del pago basada en la fecha actual
      const fechaPago = form.getValues("fecha_pago");
      if (fechaPago && prestamo.fecha_inicio) {
        const semana = calcularSemanaPago(prestamo.fecha_inicio, fechaPago);
        form.setValue("semana_pago", semana.toString());
      }
    }
  };

  // Función para actualizar la semana cuando cambie la fecha de pago
  const handleFechaPagoChange = (fecha: string) => {
    form.setValue("fecha_pago", fecha);
    
    if (prestamoSeleccionado && prestamoSeleccionado.fecha_inicio) {
      const semana = calcularSemanaPago(prestamoSeleccionado.fecha_inicio, fecha);
      form.setValue("semana_pago", semana.toString());
    }
  };

  // Mutation para registrar pago
  const registrarPagoMutation = useMutation({
    mutationFn: async (values: any) => {
      console.log("Valores en mutación antes de la llamada API:", values);
      // Asegurarse de que los tipos son correctos para la API
      const dataToSend = {
        prestamo_id: Number(values.prestamo_id),
        monto_pagado: String(values.monto_pagado),
        fecha_pago: values.fecha_pago,
        numero_semana: values.semana_pago ? Number(values.semana_pago) : undefined
      };
      console.log("Datos a enviar a la API:", dataToSend);
      const res = await apiRequest("POST", "/api/pagos", dataToSend);
      return res.json();
    },
    onSuccess: (data) => {
      const prestamoId = Number(form.getValues().prestamo_id);
      
      // Invalidar todas las consultas relevantes
      queryClient.invalidateQueries({ queryKey: ["/api/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestamos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estadisticas"] });
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      // Forzar recarga inmediata de las consultas actuales para ver los cambios sin necesidad de refrescar
      queryClient.refetchQueries({ queryKey: ["/api/pagos"] });
      queryClient.refetchQueries({ queryKey: ["/api/prestamos"] });
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.refetchQueries({ queryKey: ['/api/pagos', { prestamo_id: prestamoId }] });
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      toast({
        title: "Pago registrado",
        description: "El pago ha sido registrado con éxito"
      });
      
      form.reset({
        prestamo_id: "",
        monto_pagado: "",
        fecha_pago: getFechaLocal(), // Resetear con la fecha actual correcta
        semana_pago: ""
      });
      setPrestamoSeleccionado(null);
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
      // Recargar la página completa después de un breve retraso
      // para que el usuario pueda ver el mensaje de éxito
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo registrar el pago: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  function onSubmit(values: PaymentFormValues) {
    if (!prestamoSeleccionado) return;
    
    const montoPagado = Number(values.monto_pagado);
    const montoSemanal = Number(prestamoSeleccionado.pago_semanal);
    
    // Verificar si es un pago parcial
    const esPagoParcial = montoPagado < montoSemanal;
    
    // Si es pago parcial y no está confirmado, mostrar alerta
    if (esPagoParcial && !values.es_pago_parcial_confirmado) {
      setShowParcialAlert(true);
      return;
    }
    
    // Si no es parcial o ya está confirmado, proceder con el pago
    const dataToSend = {
      prestamo_id: Number(values.prestamo_id),
      monto_pagado: String(montoPagado),
      fecha_pago: values.fecha_pago
    };
    
    // Depuración
    console.log("Datos de pago a enviar:", dataToSend);
    
    // Usar directamente el estado de la mutación para mostrar el estado de carga
    registrarPagoMutation.mutate(dataToSend);
  }

  // Resetear form cuando se cierra
  useEffect(() => {
    if (!open) {
      form.reset();
      setPrestamoSeleccionado(null);
    }
  }, [open, form]);

  // Función para confirmar y proceder con un pago parcial
  const handleConfirmPagoParcial = () => {
    if (!prestamoSeleccionado) return;
    
    // Establecer es_pago_parcial_confirmado en true en el formulario
    form.setValue("es_pago_parcial_confirmado", true);
    
    // Volver a enviar el formulario
    const values = form.getValues();
    const dataToSend = {
      prestamo_id: Number(values.prestamo_id),
      monto_pagado: String(values.monto_pagado),
      fecha_pago: values.fecha_pago
    };
    
    console.log("Datos de pago parcial a enviar:", dataToSend);
    
    // Ya no usamos el indicador de carga global, usamos el estado de la mutación directamente
    registrarPagoMutation.mutate(dataToSend);
    
    setShowParcialAlert(false);
    
    // Recargar la página después de registrar el pago
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Calcular la diferencia para el diálogo de pago parcial
  const diferenciaPago = prestamoSeleccionado ? 
    Number(prestamoSeleccionado.pago_semanal) - Number(form.getValues().monto_pagado || "0") 
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[95vh] overflow-y-auto z-[9999]">
          {/* Overlay de carga para indicar procesamiento */}
          {registrarPagoMutation.isPending && (
            <div className="absolute inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center rounded-md">
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl border border-white/20">
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm font-medium text-white animate-pulse">
                    Registrando pago...
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Formulario para registrar un nuevo pago</DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="prestamo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Préstamo</FormLabel>
                    {prestamoId && prestamoSeleccionado ? (
                      // Mostrar información del préstamo pre-seleccionado
                      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Cliente</p>
                            <p className="text-sm font-medium text-gray-800">{clienteNombre || prestamoSeleccionado.cliente?.nombre}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Préstamo #</p>
                            <p className="text-sm font-medium text-gray-800">{prestamoSeleccionado.id}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Monto del Préstamo</p>
                            <p className="text-sm font-medium text-gray-800">{formatCurrency(prestamoSeleccionado.monto_prestado)}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Pago Semanal</p>
                            <p className="text-sm font-medium text-gray-800">{formatCurrency(prestamoSeleccionado.pago_semanal)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Mostrar selector de préstamo normal
                      <div className="space-y-2">
                        <div className="relative mb-2">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            <i className="fas fa-search text-sm"></i>
                          </span>
                          <Input 
                            className="pl-8 bg-gray-50" 
                            placeholder="Buscar cliente o monto"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            value={searchTerm}
                            autoComplete="off"
                          />
                          {searchTerm.trim() !== "" && (
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>{filteredPrestamos.length} resultados encontrados</span>
                              {searchTerm.trim() !== "" && (
                                <button 
                                  type="button" 
                                  className="text-blue-500 hover:text-blue-700"
                                  onClick={() => setSearchTerm("")}
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handlePrestamoChange(value);
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un préstamo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[10001]">
                            {filteredPrestamos.length > 0 ? (
                              filteredPrestamos.map((prestamo: PrestamoConCliente) => (
                                <SelectItem key={prestamo.id} value={prestamo.id.toString()}>
                                  {prestamo.cliente?.nombre} - {formatCurrency(prestamo.monto_prestado)}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-center text-gray-500">
                                No se encontraron préstamos
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {prestamoSeleccionado && (
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Información del Préstamo</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Cliente</p>
                      <p className="text-sm font-medium text-gray-800">{prestamoSeleccionado.cliente?.nombre}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Monto del Préstamo</p>
                      <p className="text-sm font-medium text-gray-800">{formatCurrency(prestamoSeleccionado.monto_prestado)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Semanas Pagadas</p>
                      <p className="text-sm font-medium text-gray-800">
                        {prestamoSeleccionado.semanas_pagadas} de {prestamoSeleccionado.numero_semanas}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Pago Semanal</p>
                      <p className="text-sm font-medium text-gray-800">
                        {formatCurrency(prestamoSeleccionado.pago_semanal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <FormField
                control={form.control}
                name="monto_pagado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a Pagar</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input 
                            className="pl-6" 
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setMontoEditado(true); // Mark as manually edited
                            }}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              // Permitir teclas especiales
                              if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '.'].includes(e.key)) {
                                return;
                              }
                              // Permitir números
                              if (e.key >= '0' && e.key <= '9') {
                                return;
                              }
                              // Bloquear otras teclas
                              e.preventDefault();
                            }}
                          />
                        </div>
                        {prestamoSeleccionado && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                form.setValue("monto_pagado", prestamoSeleccionado.pago_semanal.toString());
                                setMontoEditado(false); // Reset edit state when using full payment
                              }}
                              className="text-xs"
                            >
                              Pago Completo ({formatCurrency(prestamoSeleccionado.pago_semanal)})
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                form.setValue("monto_pagado", "");
                                setMontoLimpiado(true); // Mark as manually cleared
                                setMontoEditado(true); // Also mark as edited
                              }}
                              className="text-xs"
                            >
                              Limpiar
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fecha_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Pago</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        value={field.value || getFechaLocal()} // Asegurar que siempre tenga la fecha local
                        onChange={(e) => handleFechaPagoChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="semana_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semana de Pago</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="1"
                        placeholder="Ej: 1, 2, 3..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {prestamoSeleccionado ? 
                        `Semana calculada automáticamente basada en fecha de inicio: ${prestamoSeleccionado.fecha_inicio}` :
                        "Se calcula automáticamente al seleccionar préstamo y fecha"
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={registrarPagoMutation.isPending}>Cancelar</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={registrarPagoMutation.isPending}
                  className="bg-primary hover:bg-blue-600"
                >
                  {registrarPagoMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <LoadingButton /> Registrando...
                    </span>
                  ) : (
                    "Registrar Pago"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de alerta para pagos parciales */}
      <AlertDialog open={showParcialAlert} onOpenChange={setShowParcialAlert}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto z-[9999]">
          {/* Overlay de carga para indicar procesamiento */}
          {registrarPagoMutation.isPending && (
            <div className="absolute inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center rounded-md">
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl border border-white/20">
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm font-medium text-white animate-pulse">
                    Registrando pago parcial...
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar Pago Parcial?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Está a punto de registrar un pago parcial. Esto significa que la semana actual 
              no se marcará como pagada completamente y quedará un saldo pendiente.</p>
              
              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mt-2">
                <p className="text-sm font-medium text-yellow-800">
                  Monto semanal requerido: {formatCurrency(prestamoSeleccionado?.pago_semanal || 0)}
                </p>
                <p className="text-sm font-medium text-yellow-800">
                  Monto a pagar ahora: {formatCurrency(form.getValues().monto_pagado || 0)}
                </p>
                <p className="text-sm font-medium text-yellow-800">
                  Saldo pendiente: {formatCurrency(diferenciaPago)}
                </p>
              </div>
              
              <p className="font-medium mt-2">¿Desea continuar con el pago parcial?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registrarPagoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmPagoParcial}
              className="bg-primary hover:bg-blue-600"
              disabled={registrarPagoMutation.isPending}
            >
              {registrarPagoMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <LoadingButton /> Procesando...
                </span>
              ) : (
                "Confirmar Pago Parcial"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
