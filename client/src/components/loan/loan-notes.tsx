import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  StickyNote, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Calendar,
  FileText,
  MessageSquare,
  Clock
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NotaPrestamo, InsertNotaPrestamo } from "@shared/schema";

const notaFormSchema = z.object({
  titulo: z.string().min(1, "El título es requerido"),
  contenido: z.string().min(1, "El contenido es requerido"),
  tipo: z.string().min(1, "Debe seleccionar un tipo"),
  importante: z.boolean().default(false)
});

type NotaFormValues = z.infer<typeof notaFormSchema>;

interface LoanNotesProps {
  prestamoId: number;
}

const tiposNota = [
  { valor: "GENERAL", label: "General", icon: FileText, color: "bg-gray-100 text-gray-800" },
  { valor: "PAGO", label: "Pago", icon: Calendar, color: "bg-green-100 text-green-800" },
  { valor: "INCIDENCIA", label: "Incidencia", icon: AlertTriangle, color: "bg-red-100 text-red-800" },
  { valor: "RECORDATORIO", label: "Recordatorio", icon: Clock, color: "bg-blue-100 text-blue-800" }
];

export default function LoanNotes({ prestamoId }: LoanNotesProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaPrestamo | null>(null);

  const form = useForm<NotaFormValues>({
    resolver: zodResolver(notaFormSchema),
    defaultValues: {
      titulo: "",
      contenido: "",
      tipo: "GENERAL",
      importante: false
    }
  });

  // Obtener notas del préstamo
  const { data: notas = [], isLoading } = useQuery<NotaPrestamo[]>({
    queryKey: [`/api/prestamos/${prestamoId}/notas`],
  });

  // Crear nota
  const crearNotaMutation = useMutation({
    mutationFn: async (data: NotaFormValues) => {
      const res = await apiRequest("POST", `/api/prestamos/${prestamoId}/notas`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/notas`] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Nota creada",
        description: "La nota se ha guardado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la nota",
        variant: "destructive",
      });
    }
  });

  // Actualizar nota
  const actualizarNotaMutation = useMutation({
    mutationFn: async (data: NotaFormValues) => {
      if (!editingNota) return;
      const res = await apiRequest("PUT", `/api/notas/${editingNota.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/notas`] });
      setDialogOpen(false);
      setEditingNota(null);
      form.reset();
      toast({
        title: "Nota actualizada",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la nota",
        variant: "destructive",
      });
    }
  });

  // Eliminar nota
  const eliminarNotaMutation = useMutation({
    mutationFn: async (notaId: number) => {
      await apiRequest("DELETE", `/api/notas/${notaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/notas`] });
      toast({
        title: "Nota eliminada",
        description: "La nota se ha eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la nota",
        variant: "destructive",
      });
    }
  });

  const abrirDialogo = (nota?: NotaPrestamo) => {
    if (nota) {
      setEditingNota(nota);
      form.reset({
        titulo: nota.titulo,
        contenido: nota.contenido,
        tipo: nota.tipo,
        importante: nota.importante
      });
    } else {
      setEditingNota(null);
      form.reset();
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: NotaFormValues) => {
    if (editingNota) {
      actualizarNotaMutation.mutate(data);
    } else {
      crearNotaMutation.mutate(data);
    }
  };

  const getTipoInfo = (tipo: string) => {
    return tiposNota.find(t => t.valor === tipo) || tiposNota[0];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notas y Anexos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Cargando notas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Notas y Anexos ({notas.length})
            </CardTitle>
            <Button onClick={() => abrirDialogo()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notas.length === 0 ? (
            <div className="text-center py-8">
              <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay notas para este préstamo
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Agrega notas para recordar detalles importantes del cliente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notas.map((nota) => {
                const tipoInfo = getTipoInfo(nota.tipo);
                const IconComponent = tipoInfo.icon;
                
                return (
                  <div
                    key={nota.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={tipoInfo.color}>
                            <IconComponent className="h-3 w-3 mr-1" />
                            {tipoInfo.label}
                          </Badge>
                          {nota.importante && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Importante
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm mb-1 truncate">
                          {nota.titulo}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {nota.contenido}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(nota.fecha_creacion), "dd/MM/yyyy 'a las' HH:mm", { locale: es })} 
                          {" · "}
                          {formatDistanceToNow(new Date(nota.fecha_creacion), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirDialogo(nota)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarNotaMutation.mutate(nota.id)}
                          disabled={eliminarNotaMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNota ? "Editar Nota" : "Nueva Nota"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Título de la nota"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposNota.map((tipo) => (
                          <SelectItem key={tipo.valor} value={tipo.valor}>
                            <div className="flex items-center gap-2">
                              <tipo.icon className="h-4 w-4" />
                              {tipo.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contenido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenido</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Escribe aquí los detalles importantes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="importante"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Marcar como importante</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={crearNotaMutation.isPending || actualizarNotaMutation.isPending}
            >
              {crearNotaMutation.isPending || actualizarNotaMutation.isPending 
                ? "Guardando..." 
                : editingNota 
                  ? "Actualizar" 
                  : "Crear Nota"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
