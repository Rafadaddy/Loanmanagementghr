import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingButton } from "@/components/ui/loading";
import { Cliente, Prestamo, CalculoPrestamo, ResultadoCalculoPrestamo } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency, addDaysToDate } from "@/lib/utils";
import { Search } from "lucide-react";

// Esquema de validación para edición
const editLoanFormSchema = z.object({
  cliente_id: z.string().min(1, "Debe seleccionar un cliente"),
  monto_prestado: z.string().min(1, "El monto es requerido"),
  tasa_interes: z.string().min(1, "La tasa de interés es requerida"),
  tasa_mora: z.string().default("0"),
  fecha_prestamo: z.string().min(1, "La fecha es requerida"),
  numero_semanas: z.string().min(1, "El número de semanas es requerido"),
  frecuencia_pago: z.string().min(1, "La frecuencia de pago es requerida"),
  monto_total_pagar: z.string().min(1, "El monto total es requerido"),
  pago_semanal: z.string().min(1, "El pago semanal es requerido")
});

type EditLoanFormValues = z.infer<typeof editLoanFormSchema>;

interface EditLoanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestamo: Prestamo;
  onSuccess?: () => void;
}

export default function EditLoanForm({ open, onOpenChange, prestamo, onSuccess }: EditLoanFormProps) {
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

  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(editLoanFormSchema),
    defaultValues: {
      cliente_id: prestamo.cliente_id.toString(),
      monto_prestado: prestamo.monto_prestado,
      tasa_interes: prestamo.tasa_interes,
      tasa_mora: prestamo.tasa_mora || "0",
      fecha_prestamo: prestamo.fecha_prestamo,
      numero_semanas: prestamo.numero_semanas.toString(),
      frecuencia_pago: prestamo.frecuencia_pago || "SEMANAL",
      monto_total_pagar: prestamo.monto_total_pagar,
      pago_semanal: prestamo.pago_semanal
    }
  });

  // Resetear formulario cuando cambie el préstamo
  useEffect(() => {
    if (prestamo && open) {
      form.reset({
        cliente_id: prestamo.cliente_id.toString(),
        monto_prestado: prestamo.monto_prestado,
        tasa_interes: prestamo.tasa_interes,
        tasa_mora: prestamo.tasa_mora || "0",
        fecha_prestamo: prestamo.fecha_prestamo,
        numero_semanas: prestamo.numero_semanas.toString(),
        frecuencia_pago: prestamo.frecuencia_pago || "SEMANAL",
        monto_total_pagar: prestamo.monto_total_pagar,
        pago_semanal: prestamo.pago_semanal
      });
    }
  }, [prestamo, open, form]);

  // Mutación para calcular préstamo
  const calcularMutation = useMutation({
    mutationFn: async (datos: CalculoPrestamo) => {
      const res = await apiRequest("POST", "/api/calcular-prestamo", datos);
      return res.json() as Promise<ResultadoCalculoPrestamo>;
    },
    onSuccess: (data) => {
      setCalculoResultado(data);
      // Actualizar automáticamente los campos calculados
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

  // Mutación para actualizar préstamo
  const actualizarPrestamoMutation = useMutation({
    mutationFn: async (datos: any) => {
      const res = await apiRequest("PUT", `/api/prestamos/${prestamo.id}`, datos);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Préstamo actualizado",
        description: "El préstamo ha sido actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prestamos"] });
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamo.id}`] });
      stopLoading();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      console.error("Error al actualizar préstamo:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el préstamo",
        variant: "destructive"
      });
      stopLoading();
    }
  });

  // Función para calcular el préstamo
  const handleCalcular = () => {
    const values = form.getValues();
    const datos: CalculoPrestamo = {
      monto_prestado: parseFloat(values.monto_prestado),
      tasa_interes: parseFloat(values.tasa_interes),
      numero_semanas: parseInt(values.numero_semanas)
    };
    calcularMutation.mutate(datos);
  };

  // Función para manejar el envío del formulario
  const onSubmit = (values: EditLoanFormValues) => {
    if (!calculoResultado) {
      toast({
        title: "Error",
        description: "Debe calcular el préstamo antes de guardarlo",
        variant: "destructive"
      });
      return;
    }

    // Calcular fecha del primer pago (7 días después de la fecha de préstamo)
    const proximaFechaPago = addDaysToDate(values.fecha_prestamo, 7);
    
    const dataToSend = {
      cliente_id: parseInt(values.cliente_id),
      monto_prestado: values.monto_prestado,
      tasa_interes: values.tasa_interes,
      tasa_mora: values.tasa_mora,
      fecha_prestamo: values.fecha_prestamo,
      numero_semanas: parseInt(values.numero_semanas),
      frecuencia_pago: values.frecuencia_pago,
      monto_total_pagar: calculoResultado.monto_total_pagar.toString(),
      pago_semanal: calculoResultado.pago_semanal.toString(),
      proxima_fecha_pago: proximaFechaPago
    };
    
    console.log("Datos a actualizar:", dataToSend);
    
    startLoading("Actualizando préstamo...");
    actualizarPrestamoMutation.mutate(dataToSend);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Editar Préstamo #{prestamo.id}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
              {/* Selección de Cliente */}
              <div className="space-y-4">
                <FormLabel>Cliente</FormLabel>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nombre o documento..."
                    value={filtroCliente}
                    onChange={(e) => setFiltroCliente(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <ScrollArea className="h-[200px]">
                            {clientesFiltrados.map((cliente) => (
                              <SelectItem 
                                key={cliente.id} 
                                value={cliente.id.toString()}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{cliente.nombre}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {cliente.documento_identidad} - {cliente.telefono}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monto Prestado */}
                <FormField
                  control={form.control}
                  name="monto_prestado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Prestado</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="5000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tasa de Interés */}
                <FormField
                  control={form.control}
                  name="tasa_interes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tasa de Interés (%)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.1" placeholder="40" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tasa de Mora */}
                <FormField
                  control={form.control}
                  name="tasa_mora"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tasa de Mora (%)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.1" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fecha del Préstamo */}
                <FormField
                  control={form.control}
                  name="fecha_prestamo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha del Préstamo</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número de Semanas */}
                <FormField
                  control={form.control}
                  name="numero_semanas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Semanas</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="16" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Frecuencia de Pago */}
                <FormField
                  control={form.control}
                  name="frecuencia_pago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de Pago</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar frecuencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SEMANAL">Semanal</SelectItem>
                          <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                          <SelectItem value="MENSUAL">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Botón para calcular */}
              <div className="flex justify-center">
                <Button 
                  type="button" 
                  onClick={handleCalcular}
                  disabled={calcularMutation.isPending}
                  variant="secondary"
                >
                  {calcularMutation.isPending ? "Calculando..." : "Recalcular Préstamo"}
                </Button>
              </div>

              {/* Resultado del cálculo */}
              {calculoResultado && (
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Resultado del Cálculo</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Monto Total a Pagar:</span>
                      <p className="font-medium text-lg">
                        {formatCurrency(calculoResultado.monto_total_pagar)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pago Semanal:</span>
                      <p className="font-medium text-lg">
                        {formatCurrency(calculoResultado.pago_semanal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monto Total a Pagar (solo lectura) */}
                <FormField
                  control={form.control}
                  name="monto_total_pagar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Total a Pagar</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pago Semanal (solo lectura) */}
                <FormField
                  control={form.control}
                  name="pago_semanal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pago Semanal</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={!calculoResultado || actualizarPrestamoMutation.isPending}
          >
            {actualizarPrestamoMutation.isPending ? "Actualizando..." : "Actualizar Préstamo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
