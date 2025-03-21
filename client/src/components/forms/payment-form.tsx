import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { insertPagoSchema, Prestamo, Cliente } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";

// Esquema para validación de pago
const paymentFormSchema = z.object({
  prestamo_id: z.string().min(1, "Debe seleccionar un préstamo"),
  monto_pagado: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "El monto debe ser un número positivo"
  }),
  // Añadimos un mensaje opcional que no se enviará al servidor
  es_pago_parcial_confirmado: z.boolean().optional()
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PrestamoConCliente extends Prestamo {
  cliente?: Cliente;
}

export default function PaymentForm({ open, onOpenChange, onSuccess }: PaymentFormProps) {
  const { toast } = useToast();
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<PrestamoConCliente | null>(null);
  const [showParcialAlert, setShowParcialAlert] = useState(false);

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

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      prestamo_id: "",
      monto_pagado: ""
    }
  });

  // Al cambiar el préstamo seleccionado, obtener detalles y actualizar el monto sugerido
  const handlePrestamoChange = (id: string) => {
    if (!id) {
      setPrestamoSeleccionado(null);
      form.setValue("monto_pagado", "");
      return;
    }
    
    const prestamo = prestamosConCliente.find(p => p.id === parseInt(id));
    if (prestamo) {
      setPrestamoSeleccionado(prestamo);
      form.setValue("monto_pagado", prestamo.pago_semanal.toString());
    }
  };

  // Mutation para registrar pago
  const registrarPagoMutation = useMutation({
    mutationFn: async (values: any) => {
      console.log("Valores en mutación antes de la llamada API:", values);
      // Asegurarse de que los tipos son correctos para la API
      const dataToSend = {
        prestamo_id: Number(values.prestamo_id),
        monto_pagado: String(values.monto_pagado)
      };
      console.log("Datos a enviar a la API:", dataToSend);
      const res = await apiRequest("POST", "/api/pagos", dataToSend);
      return res.json();
    },
    onSuccess: () => {
      // Invalidar todas las consultas relevantes
      queryClient.invalidateQueries({ queryKey: ["/api/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestamos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estadisticas"] });
      
      // Invalidar también consultas específicas por préstamo y cliente
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          (query.queryKey[0] === "/api/pagos" || query.queryKey[0] === "/api/prestamos") && 
          query.queryKey.length > 1 
      });
      
      toast({
        title: "Pago registrado",
        description: "El pago ha sido registrado con éxito"
      });
      
      form.reset();
      setPrestamoSeleccionado(null);
      onOpenChange(false);
      if (onSuccess) onSuccess();
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
      monto_pagado: String(montoPagado)
    };
    
    // Depuración
    console.log("Datos de pago a enviar:", dataToSend);
    
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
      monto_pagado: String(values.monto_pagado)
    };
    
    console.log("Datos de pago parcial a enviar:", dataToSend);
    
    registrarPagoMutation.mutate(dataToSend);
    setShowParcialAlert(false);
  };

  // Calcular la diferencia para el diálogo de pago parcial
  const diferenciaPago = prestamoSeleccionado ? 
    Number(prestamoSeleccionado.pago_semanal) - Number(form.getValues().monto_pagado || "0") 
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="prestamo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Préstamo</FormLabel>
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
                      <SelectContent>
                        {prestamosConCliente.map((prestamo) => (
                          <SelectItem key={prestamo.id} value={prestamo.id.toString()}>
                            {prestamo.cliente?.nombre} - {formatCurrency(prestamo.monto_prestado)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input className="pl-6" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={registrarPagoMutation.isPending}
                  className="bg-primary hover:bg-blue-600"
                >
                  {registrarPagoMutation.isPending ? "Registrando..." : "Registrar Pago"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de alerta para pagos parciales */}
      <AlertDialog open={showParcialAlert} onOpenChange={setShowParcialAlert}>
        <AlertDialogContent>
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmPagoParcial}
              className="bg-primary hover:bg-blue-600"
            >
              Confirmar Pago Parcial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
