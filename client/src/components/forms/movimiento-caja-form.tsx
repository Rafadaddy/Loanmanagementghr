import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MovimientoCaja, insertMovimientoCajaSchema } from "@shared/schema";

// Esquema de validación del formulario
const movimientoCajaFormSchema = insertMovimientoCajaSchema.extend({
  monto: z.string().min(1, { message: "El monto es requerido" }),
  fecha: z.date({
    required_error: "La fecha es requerida",
  }),
  tipo: z.enum(["INGRESO", "EGRESO"], {
    required_error: "El tipo de movimiento es requerido",
  }),
  categoria: z.string().min(1, { message: "La categoría es requerida" }),
  descripcion: z.string().optional(),
});

// Categorías predefinidas para ingresos y egresos
const categoriasPorTipo = {
  INGRESO: [
    "Pago de préstamo",
    "Pago de interés",
    "Pago de mora",
    "Inversión",
    "Otros ingresos"
  ],
  EGRESO: [
    "Préstamo otorgado",
    "Salario",
    "Comisiones",
    "Alquiler",
    "Servicios",
    "Mantenimiento",
    "Otros gastos"
  ]
};

// Tipo de valores del formulario
type MovimientoCajaFormValues = z.infer<typeof movimientoCajaFormSchema>;

// Props del componente
interface MovimientoCajaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function MovimientoCajaForm({ 
  open, 
  onOpenChange, 
  onSuccess 
}: MovimientoCajaFormProps) {
  const { toast } = useToast();
  const [categorias, setCategorias] = useState<string[]>(categoriasPorTipo.INGRESO);
  
  // Inicializar formulario
  const form = useForm<MovimientoCajaFormValues>({
    resolver: zodResolver(movimientoCajaFormSchema),
    defaultValues: {
      monto: "",
      fecha: new Date(),
      tipo: "INGRESO",
      categoria: "",
      descripcion: "",
    }
  });
  
  // Observar el cambio de tipo para actualizar las categorías
  const tipoValue = form.watch("tipo");
  if (tipoValue && categorias !== categoriasPorTipo[tipoValue]) {
    setCategorias(categoriasPorTipo[tipoValue]);
    form.setValue("categoria", ""); // Resetear categoría al cambiar tipo
  }
  
  // Mutación para crear un movimiento de caja
  const crearMovimientoMutation = useMutation({
    mutationFn: async (values: MovimientoCajaFormValues) => {
      console.log("Enviando datos formateados:", values);
      
      // Añadir datos de registro
      const dataToSubmit = {
        ...values,
        cliente_id: null,
        prestamo_id: null
      };
      
      console.log("Enviando datos originales:", dataToSubmit);
      
      // Obtener ID del usuario actual si es necesario
      const userRes = await apiRequest("GET", "/api/user");
      let userId = null;
      
      if (userRes.ok) {
        const userData = await userRes.json();
        userId = userData.id;
        console.log("Usuario actual:", userData.username, "ID:", userId);
      }
      
      // Añadir creado_por si tenemos ID de usuario
      const finalData = {
        ...dataToSubmit,
        creado_por: userId || 2 // Valor por defecto para desarrollo
      };
      
      console.log("Enviando datos procesados:", finalData);
      console.log("Enviando petición a /api/caja/movimientos con datos:", finalData);
      
      const res = await apiRequest("POST", "/api/caja/movimientos", finalData);
      
      console.log("Respuesta exitosa del servidor:", res.status);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al crear el movimiento");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
      
      // Mostrar un mensaje de éxito antes de recargar la página
      toast({
        title: "Movimiento registrado",
        description: "Recargando página...",
        variant: "default",
      });
      
      // Esperar un poco para que el usuario vea el mensaje
      setTimeout(() => {
        // Recargar la página completamente
        window.location.reload();
      }, 1000);
      
      // No ejecutamos el callback porque vamos a recargar la página
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Manejar envío del formulario
  function onSubmit(values: MovimientoCajaFormValues) {
    // Enviamos los valores tal cual y el backend se encargará de la conversión
    crearMovimientoMutation.mutate(values);
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento de Caja</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del movimiento de caja.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo de movimiento */}
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INGRESO">Ingreso</SelectItem>
                      <SelectItem value="EGRESO">Egreso</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <div className="relative">
                      <span className="absolute left-3 top-2.5">$</span>
                      <Input 
                        placeholder="0.00" 
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="pl-7"
                        {...field} 
                      />
                    </div>
                  </FormControl>
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
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full text-left font-normal"
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalles adicionales del movimiento"
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={crearMovimientoMutation.isPending}
              >
                {crearMovimientoMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Guardando...
                  </>
                ) : "Guardar Movimiento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}