import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cobrador, Cliente } from "@shared/schema";

import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingData } from "@/components/ui/loading";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Plus, Search, Trash, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Schema para validación de formulario
const cobradorFormSchema = z.object({
  nombre: z.string().min(3, "Nombre debe tener al menos 3 caracteres"),
  telefono: z.string().min(10, "Teléfono debe tener al menos 10 caracteres"),
  zona: z.string().optional(),
  user_id: z.number().optional().nullable(),
});

type CobradorFormValues = z.infer<typeof cobradorFormSchema>;

// Interfaz para usuario (simplificada)
interface User {
  id: number;
  username: string;
  rol: string;
}

export default function Cobradores() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCobrador, setSelectedCobrador] = useState<Cobrador | null>(null);
  const [isClientesDialogOpen, setIsClientesDialogOpen] = useState(false);
  const [clientesCobrador, setClientesCobrador] = useState<Cliente[]>([]);

  // Fetch cobradores
  const {
    data: cobradores = [],
    isLoading,
    isError,
  } = useQuery<Cobrador[]>({
    queryKey: ["/api/cobradores"],
    refetchOnWindowFocus: false,
  });

  // Fetch usuarios disponibles para ser cobradores
  const { data: usuariosDisponibles = [] } = useQuery<User[]>({
    queryKey: ["/api/usuarios-disponibles-para-cobrador"],
    refetchOnWindowFocus: false,
  });

  // Crear cobrador
  const createMutation = useMutation({
    mutationFn: async (values: CobradorFormValues) => {
      const res = await apiRequest("POST", "/api/cobradores", values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cobrador creado",
        description: "El cobrador ha sido creado exitosamente",
      });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cobradores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear cobrador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar cobrador
  const updateMutation = useMutation({
    mutationFn: async (values: CobradorFormValues & { id: number }) => {
      const { id, ...rest } = values;
      const res = await apiRequest("PUT", `/api/cobradores/${id}`, rest);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cobrador actualizado",
        description: "El cobrador ha sido actualizado exitosamente",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cobradores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar cobrador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eliminar cobrador
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cobradores/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al eliminar cobrador");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Cobrador eliminado",
        description: "El cobrador ha sido eliminado exitosamente",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cobradores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar cobrador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch clientes asignados a un cobrador
  const fetchClientesCobrador = async (cobradorId: number) => {
    try {
      const res = await apiRequest("GET", `/api/cobradores/${cobradorId}/clientes`);
      if (!res.ok) {
        throw new Error("Error al obtener clientes del cobrador");
      }
      const clientes = await res.json();
      setClientesCobrador(clientes);
      setIsClientesDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes del cobrador",
        variant: "destructive",
      });
    }
  };

  // Formulario para añadir cobrador
  const addForm = useForm<CobradorFormValues>({
    resolver: zodResolver(cobradorFormSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      zona: "",
      user_id: null,
    },
  });

  // Formulario para editar cobrador
  const editForm = useForm<CobradorFormValues>({
    resolver: zodResolver(cobradorFormSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      zona: "",
      user_id: null,
    },
  });

  // Actualizar formulario de edición cuando cambia el cobrador seleccionado
  useEffect(() => {
    if (selectedCobrador && isEditDialogOpen) {
      editForm.reset({
        nombre: selectedCobrador.nombre,
        telefono: selectedCobrador.telefono,
        zona: selectedCobrador.zona || "",
        user_id: selectedCobrador.user_id,
      });
    }
  }, [selectedCobrador, isEditDialogOpen, editForm]);

  // Filtrado de cobradores por búsqueda
  const filteredCobradores = cobradores.filter((cobrador) =>
    cobrador.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Manejadores
  const handleAddSubmit = (values: CobradorFormValues) => {
    createMutation.mutate(values);
  };

  const handleEditSubmit = (values: CobradorFormValues) => {
    if (!selectedCobrador) return;
    updateMutation.mutate({ ...values, id: selectedCobrador.id });
  };

  const handleDeleteClick = (cobrador: Cobrador) => {
    setSelectedCobrador(cobrador);
    setIsDeleteDialogOpen(true);
  };

  const handleEditClick = (cobrador: Cobrador) => {
    setSelectedCobrador(cobrador);
    setIsEditDialogOpen(true);
  };

  const handleVerClientesClick = (cobrador: Cobrador) => {
    setSelectedCobrador(cobrador);
    fetchClientesCobrador(cobrador.id);
  };

  const confirmDelete = () => {
    if (selectedCobrador) {
      deleteMutation.mutate(selectedCobrador.id);
    }
  };

  if (isLoading) {
    return (
      <MainLayout className="p-4">
        <LoadingData />
      </MainLayout>
    );
  }

  if (isError) {
    return (
      <MainLayout className="p-4">
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl font-bold text-red-500">
            Error al cargar cobradores
          </h1>
          <p className="text-gray-500">
            Por favor, intenta nuevamente más tarde.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Cobradores</h1>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Añadir Cobrador
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Gestión de Cobradores</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cobrador..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cobrador</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCobradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No hay cobradores registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCobradores.map((cobrador) => (
                    <TableRow key={cobrador.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Avatar>
                            <AvatarImage src="" />
                            <AvatarFallback>
                              {getInitials(cobrador.nombre)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{cobrador.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell>{cobrador.telefono}</TableCell>
                      <TableCell>
                        {cobrador.zona ? (
                          <Badge variant="outline">{cobrador.zona}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No definida</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cobrador.user_id ? (
                          <Badge variant="secondary">
                            ID: {cobrador.user_id}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sin usuario</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerClientesClick(cobrador)}
                        >
                          <Users className="h-4 w-4 mr-1" /> Ver Clientes
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(cobrador)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(cobrador)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo para añadir cobrador */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Cobrador</DialogTitle>
            <DialogDescription>
              Completa la información para registrar un nuevo cobrador.
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form
              onSubmit={addForm.handleSubmit(handleAddSubmit)}
              className="space-y-4"
            >
              <FormField
                control={addForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del cobrador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Teléfono del cobrador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="zona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <FormControl>
                      <Input placeholder="Zona asignada (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario asignado</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          field.onChange(value);
                        }}
                      >
                        <option value="">Seleccionar usuario (opcional)</option>
                        {usuariosDisponibles.map((usuario) => (
                          <option key={usuario.id} value={usuario.id}>
                            {usuario.username} ({usuario.rol})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar cobrador */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cobrador</DialogTitle>
            <DialogDescription>
              Actualiza la información del cobrador.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del cobrador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Teléfono del cobrador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="zona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <FormControl>
                      <Input placeholder="Zona asignada (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
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

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente al cobrador{" "}
              <span className="font-semibold">
                {selectedCobrador?.nombre}
              </span>
              . Solo puedes eliminar cobradores sin clientes asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para ver clientes del cobrador */}
      <Dialog open={isClientesDialogOpen} onOpenChange={setIsClientesDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Clientes asignados a {selectedCobrador?.nombre}</DialogTitle>
            <DialogDescription>
              Lista de clientes que están asignados a este cobrador.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesCobrador.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                      Este cobrador no tiene clientes asignados
                    </TableCell>
                  </TableRow>
                ) : (
                  clientesCobrador.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Avatar>
                            <AvatarImage src="" />
                            <AvatarFallback>
                              {getInitials(cliente.nombre)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{cliente.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell>{cliente.telefono}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cliente.ruta || "No definida"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(cliente.fecha_registro)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsClientesDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}