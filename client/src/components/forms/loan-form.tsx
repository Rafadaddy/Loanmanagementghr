import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingButton } from "@/components/ui/loading";
import { insertPrestamoSchema, CalculoPrestamo, ResultadoCalculoPrestamo, Cliente } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";

// Extender el esquema para validación
const loanFormSchema = z.object({
  cliente_id: z.string().min(1, "Debe seleccionar un cliente"),
  monto_prestado: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "El monto debe ser un número positivo"
  }),
  tasa_interes: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100, {
    message: "La tasa debe ser entre 0 y 100"
  }),
  tasa_mora: z.string().default("5").refine(val => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
    message: "La tasa de mora debe ser entre 0 y 100"
  }),
  fecha_prestamo: z.string().min(1, "Debe seleccionar una fecha"),
  numero_semanas: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Las semanas deben ser un número positivo"
  }),
  frecuencia_pago: z.string().min(1, "Debe seleccionar una frecuencia"),
  monto_total_pagar: z.string(),
  pago_semanal: z.string()
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function LoanForm({ open, onOpenChange, onSuccess }: LoanFormProps) {
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [calculoResultado, setCalculoResultado] = useState<ResultadoCalculoPrestamo | null>(null);

  // Obtener la lista de clientes
  const { data: clientes = [] } = useQuery<Cliente[]>({ 
    queryKey: ["/api/clientes"]
  });
  
  // Estado para filtrar clientes
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const clientesFiltrados = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(filtroCliente.toLowerCase()) ||
    cliente.documento_identidad.toLowerCase().includes(filtroCliente.toLowerCase())
  );

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      cliente_id: "",
      monto_prestado: "",
      tasa_interes: "",
      tasa_mora: "5", // Valor predeterminado del 5%
      fecha_prestamo: new Date().toISOString().split('T')[0],
      numero_semanas: "12",
      frecuencia_pago: "SEMANAL",
      monto_total_pagar: "",
      pago_semanal: ""
    }
  });

  // Mutation para calcular préstamo
  const calcularMutation = useMutation({
    mutationFn: async (datos: CalculoPrestamo) => {
      const res = await apiRequest("POST", "/api/calcular-prestamo", datos);
      return res.json() as Promise<ResultadoCalculoPrestamo>;
    },
    onSuccess: (data) => {
      setCalculoResultado(data);
      form.setValue("monto_total_pagar", data.monto_total_pagar.toString());
      form.setValue("pago_semanal", data.pago_semanal.toString());
    },
    onError: (error) => {
      toast({
        title: "Error al calcular",
        description: `No se pudo calcular el préstamo: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para crear préstamo
  const crearPrestamoMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", "/api/prestamos", values);
      return res.json();
    },
    onSuccess: () => {
      // Mostrar indicador de carga global por un momento adicional para
      // dar tiempo a que los datos se actualicen completamente
      startLoading("Actualizando página...");
      
      // Invalidar múltiples consultas para actualizar los datos automáticamente
      queryClient.invalidateQueries({ queryKey: ["/api/prestamos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estadisticas"] });
      // Invalidar también consultas específicas por cliente
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/prestamos" && 
          query.queryKey.length > 1 
      });
      
      // Esperar un momento para asegurar que los datos se han actualizado
      // y para que el usuario vea el mensaje de carga
      setTimeout(() => {
        toast({
          title: "Préstamo creado",
          description: "El préstamo ha sido creado con éxito"
        });
        
        form.reset();
        onOpenChange(false);
        stopLoading();
        
        // Si hay una función de éxito personalizada, ejecutarla
        if (onSuccess) onSuccess();
        
        // Recargar la página para asegurar que todos los datos están actualizados
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo crear el préstamo: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  function calcularPrestamo() {
    const monto = parseFloat(form.getValues("monto_prestado"));
    const tasa = parseFloat(form.getValues("tasa_interes"));
    const semanas = parseInt(form.getValues("numero_semanas"));
    
    if (isNaN(monto) || isNaN(tasa) || isNaN(semanas)) {
      toast({
        title: "Datos incompletos",
        description: "Ingrese monto, tasa y número de semanas para calcular",
        variant: "destructive"
      });
      return;
    }
    
    // Mostrar indicador de carga global
    startLoading("Calculando préstamo...");
    
    calcularMutation.mutate(
      { monto_prestado: monto, tasa_interes: tasa, numero_semanas: semanas },
      {
        onSettled: () => {
          // Detener el indicador independientemente del resultado
          stopLoading();
        }
      }
    );
  }

  function onSubmit(values: LoanFormValues) {
    // Verificamos que el cálculo se ha realizado
    if (!calculoResultado) {
      toast({
        title: "Cálculo pendiente",
        description: "Debe calcular el préstamo antes de crearlo",
        variant: "destructive"
      });
      return;
    }

    // Convertir valores y asegurar que son del tipo correcto
    // Calcular fecha del primer pago (7 días después de la fecha de préstamo)
    // Usar nuestras funciones de utilidad para calcular fechas de manera consistente
    // Calcular la fecha del primer pago (7 días después de la fecha del préstamo)
    const proximaFechaPago = addDaysToDate(values.fecha_prestamo, 7);
    
    const dataToSend = {
      cliente_id: parseInt(values.cliente_id),
      monto_prestado: values.monto_prestado,  // Enviamos como string
      tasa_interes: values.tasa_interes,      // Enviamos como string
      tasa_mora: values.tasa_mora,            // Tasa de mora por pagos atrasados
      fecha_prestamo: values.fecha_prestamo,
      numero_semanas: parseInt(values.numero_semanas),
      frecuencia_pago: values.frecuencia_pago,
      monto_total_pagar: calculoResultado.monto_total_pagar.toString(), // Convertimos a string
      pago_semanal: calculoResultado.pago_semanal.toString(),           // Convertimos a string
      proxima_fecha_pago: proximaFechaPago // Primera fecha de pago (7 días después)
    };
    
    console.log("Datos a enviar:", dataToSend);
    
    // Mostrar indicador de carga global
    startLoading("Creando préstamo...");
    
    crearPrestamoMutation.mutate(dataToSend, {
      onError: () => {
        // Solo detenemos el indicador en caso de error, ya que en onSuccess ya tenemos la lógica
        stopLoading();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] lg:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Préstamo</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel>Cliente</FormLabel>
                  
                  <div className="space-y-2">
                    <div className="relative mb-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <i className="fas fa-search text-sm"></i>
                      </span>
                      <Input
                        className="pl-8 bg-gray-50"
                        placeholder="Buscar por nombre o documento..."
                        value={filtroCliente}
                        onChange={(e) => setFiltroCliente(e.target.value)}
                        autoComplete="off"
                      />
                      {filtroCliente.trim() !== "" && (
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{clientesFiltrados.length} resultados encontrados</span>
                          <button 
                            type="button" 
                            className="text-blue-500 hover:text-blue-700"
                            onClick={() => setFiltroCliente("")}
                          >
                            Limpiar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border rounded-md max-h-48 overflow-auto">
                    <ScrollArea className="h-full">
                      {clientesFiltrados.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          No se encontraron clientes
                        </div>
                      ) : (
                        <div className="p-1">
                          {clientesFiltrados.map((cliente) => (
                            <div
                              key={cliente.id}
                              className={`p-2 text-sm rounded-md cursor-pointer mb-1 hover:bg-gray-100 
                                ${cliente.id.toString() === field.value 
                                  ? "bg-primary/10 border border-primary/20" 
                                  : ""
                                }`}
                              onClick={() => form.setValue("cliente_id", cliente.id.toString())}
                            >
                              <div className="font-medium">{cliente.nombre}</div>
                              <div className="text-xs text-gray-500">
                                Documento: {cliente.documento_identidad}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  
                  {field.value && (
                    <div className="p-2 bg-gray-50 rounded-md text-sm">
                      <span className="font-semibold">Cliente seleccionado:</span>{" "}
                      {clientes.find(c => c.id.toString() === field.value)?.nombre}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monto_prestado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto del Préstamo</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate a-y-1/2 text-gray-500">$</span>
                        <Input className="pl-6" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tasa_interes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Interés (%)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tasa_mora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Mora por atraso (%)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">Recargo aplicado a pagos atrasados</p>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha_prestamo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha del Préstamo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="numero_semanas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Semanas</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="frecuencia_pago"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frecuencia de Pago</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione la frecuencia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SEMANAL">SEMANAL</SelectItem>
                      <SelectItem value="QUINCENAL">QUINCENAL</SelectItem>
                      <SelectItem value="MENSUAL">MENSUAL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Cálculo del Préstamo</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Monto Total a Pagar</p>
                  <p className="text-base font-medium text-gray-800">
                    {calculoResultado 
                      ? formatCurrency(calculoResultado.monto_total_pagar)
                      : "$0.00"}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 mb-1">Pago Semanal</p>
                  <p className="text-base font-medium text-gray-800">
                    {calculoResultado 
                      ? formatCurrency(calculoResultado.pago_semanal)
                      : "$0.00"}
                  </p>
                </div>
              </div>
              
              <Button 
                type="button" 
                variant="link" 
                className="mt-2 text-sm p-0 h-auto text-primary"
                onClick={calcularPrestamo}
                disabled={calcularMutation.isPending}
              >
                {calcularMutation.isPending ? "Calculando..." : "Calcular préstamo"}
              </Button>
            </div>
            
            <DialogFooter className="gap-2 mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={!calculoResultado || crearPrestamoMutation.isPending}
                className="bg-primary hover:bg-blue-600"
              >
                {crearPrestamoMutation.isPending ? "Creando préstamo..." : "Crear Préstamo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
