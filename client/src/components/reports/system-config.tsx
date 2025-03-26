import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Configuracion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingData } from "@/components/ui/loading";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Cog, Edit, Save } from "lucide-react";

// Mapa de categorías para mostrar nombres más amigables
const CATEGORIAS_MAP: Record<string, string> = {
  "GENERAL": "General",
  "PRESTAMOS": "Préstamos",
  "PAGOS": "Pagos",
  "SISTEMA": "Sistema"
};

// Esquema para validar formulario de edición de configuración
const configFormSchema = z.object({
  id: z.number(),
  valor: z.string()
    .min(1, { message: "El valor no puede estar vacío" }),
  tipo: z.string(),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

export default function SystemConfigSection() {
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuracion | null>(null);

  // Consulta para obtener todas las configuraciones
  const { data: configuraciones, isLoading } = useQuery<Configuracion[]>({
    queryKey: ["/api/configuraciones"],
    staleTime: 60000, // 1 minuto
  });

  // Formulario para editar configuración
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      id: 0,
      valor: "",
      tipo: ""
    }
  });

  // Mutación para actualizar configuración
  const updateMutation = useMutation({
    mutationFn: async (values: ConfigFormValues) => {
      await apiRequest("PUT", `/api/configuraciones/${values.id}`, { 
        valor: adaptValueByType(values.valor, values.tipo)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configuraciones"] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración se ha actualizado correctamente",
      });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Agrupar configuraciones por categoría
  const configByCategory = configuraciones?.reduce((acc: Record<string, Configuracion[]>, config) => {
    if (!acc[config.categoria]) {
      acc[config.categoria] = [];
    }
    acc[config.categoria].push(config);
    return acc;
  }, {}) || {};

  // Categorías ordenadas para mostrar en un orden específico
  const categoriesOrder = ["GENERAL", "PRESTAMOS", "PAGOS", "SISTEMA"];
  const sortedCategories = categoriesOrder.filter(cat => configByCategory[cat]);

  // Adaptar el valor según el tipo antes de mostrar
  function displayValueByType(value: string, tipo: string): string {
    if (tipo === "BOOLEANO") {
      return value === "true" ? "Sí" : "No";
    }
    return value;
  }

  // Adaptar el valor según el tipo antes de guardar
  function adaptValueByType(value: string, tipo: string): string {
    return value;
  }

  // Manejar la apertura del diálogo de edición
  function handleEditClick(config: Configuracion) {
    setSelectedConfig(config);
    form.reset({
      id: config.id,
      valor: config.valor,
      tipo: config.tipo
    });
    setEditDialogOpen(true);
  }

  // Manejar el envío del formulario de edición
  function onSubmit(values: ConfigFormValues) {
    updateMutation.mutate(values);
  }

  if (isLoading) {
    return <LoadingData />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Cog className="h-5 w-5" />
        <h2 className="text-2xl font-bold">Configuración del Sistema</h2>
      </div>
      
      <p className="text-muted-foreground">
        Aquí puedes gestionar las configuraciones del sistema. Las configuraciones están agrupadas por categorías para facilitar su administración.
      </p>

      {/* Diálogo para editar configuración */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Configuración</DialogTitle>
            <DialogDescription>
              {selectedConfig && (
                <span>
                  {selectedConfig.descripcion || selectedConfig.clave}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      {selectedConfig?.tipo === "BOOLEANO" ? (
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="value-checkbox"
                            checked={field.value === "true"}
                            onCheckedChange={(checked) => {
                              field.onChange(checked ? "true" : "false");
                            }}
                          />
                          <label
                            htmlFor="value-checkbox"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Activado
                          </label>
                        </div>
                      ) : (
                        <Input {...field} />
                      )}
                    </FormControl>
                    <FormDescription>
                      {selectedConfig?.descripcion || "Valor de la configuración"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Acordeón de configuraciones por categoría */}
      <Accordion type="single" collapsible className="w-full">
        {sortedCategories.map((categoria) => (
          <AccordionItem key={categoria} value={categoria}>
            <AccordionTrigger className="font-semibold">
              {CATEGORIAS_MAP[categoria] || categoria}
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 mt-2">
                {configByCategory[categoria].map((config) => (
                  <Card key={config.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">
                          {config.descripcion || config.clave}
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="ml-auto h-8 w-8 p-0"
                          onClick={() => handleEditClick(config)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm font-medium">
                        Valor: <span className="font-normal">{displayValueByType(config.valor, config.tipo)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clave: {config.clave}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}