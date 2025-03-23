import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cobrador, Cliente, Prestamo, Pago } from "@shared/schema";

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
import { formatDate, getInitials, formatCurrency, getLoanStatus } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Plus, Search, Trash, Users, CreditCard, Calendar, DollarSign, Info, PieChart, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [activeClienteTab, setActiveClienteTab] = useState("info");
  const [clienteSearchQuery, setClienteSearchQuery] = useState("");
  const [isEditingCliente, setIsEditingCliente] = useState(false);
  const [clienteRuta, setClienteRuta] = useState("");
  const [clienteNotas, setClienteNotas] = useState("");
  
  // Estados para mostrar préstamos y pagos del cliente
  const [prestamosCliente, setPrestamosCliente] = useState<Prestamo[]>([]);
  const [pagosCliente, setPagosCliente] = useState<Pago[]>([]);
  const [isLoadingPrestamos, setIsLoadingPrestamos] = useState(false);
  
  // Filtrado de clientes por búsqueda
  const filteredClientes = clientesCobrador.filter(cliente => 
    cliente.nombre.toLowerCase().includes(clienteSearchQuery.toLowerCase()) ||
    cliente.telefono.toLowerCase().includes(clienteSearchQuery.toLowerCase()) ||
    (cliente.documento_identidad && cliente.documento_identidad.toLowerCase().includes(clienteSearchQuery.toLowerCase()))
  );
  
  // Funciones para cálculo de ratio deuda-ingresos
  const getEstimatedIncome = () => {
    if (!selectedCliente || prestamosCliente.length === 0) return 0;
    
    // Asumimos que una persona no debería gastar más del 40% de sus ingresos en pagos de préstamos
    // Esto es una estimación inversa basada en los pagos actuales
    const totalMonthlyPayments = getTotalMonthlyPayments();
    return totalMonthlyPayments / 0.4;
  };
  
  const getTotalMonthlyPayments = () => {
    if (!prestamosCliente.length) return 0;
    
    // Calculamos el total de pagos mensuales sumando los pagos semanales
    return prestamosCliente.reduce((sum, prestamo) => {
      // Convertimos pagos semanales a mensuales (multiplicamos por 4.33 semanas por mes en promedio)
      return sum + (parseFloat(prestamo.pago_semanal) * 4.33);
    }, 0);
  };
  
  const getDebtToIncomeRatio = () => {
    const income = getEstimatedIncome();
    if (income === 0) return 0;
    
    const payments = getTotalMonthlyPayments();
    // Calculamos la proporción y la convertimos a porcentaje, redondeando a 2 decimales
    return Math.round((payments / income) * 100 * 100) / 100;
  };

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
      setSelectedCliente(null); // Resetear cliente seleccionado
      setPrestamosCliente([]); // Limpiar préstamos anteriores
      setPagosCliente([]); // Limpiar pagos anteriores
      setActiveClienteTab("info"); // Resetear tab activa
      setIsClientesDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes del cobrador",
        variant: "destructive",
      });
    }
  };
  
  // Cargar préstamos de un cliente
  const fetchPrestamosCliente = async (clienteId: number) => {
    if (!clienteId) return;
    
    setIsLoadingPrestamos(true);
    try {
      console.log("Cargando préstamos para cliente ID:", clienteId);
      
      // Obtener préstamos
      const resPrestamos = await apiRequest("GET", `/api/clientes/${clienteId}/prestamos`);
      console.log("Respuesta de API de préstamos:", resPrestamos);
      
      if (!resPrestamos.ok) {
        throw new Error(`Error al obtener préstamos del cliente: ${resPrestamos.status}`);
      }
      
      let prestamos = [];
      try {
        prestamos = await resPrestamos.json();
        console.log("Préstamos obtenidos:", prestamos);
      } catch (parseError) {
        console.error("Error al parsear préstamos:", parseError);
        prestamos = [];
      }
      
      // Establecer los préstamos en el estado
      setPrestamosCliente(Array.isArray(prestamos) ? prestamos : []);
      
      // Obtener pagos de todos los préstamos
      if (Array.isArray(prestamos) && prestamos.length > 0) {
        try {
          console.log("Cargando pagos para", prestamos.length, "préstamos");
          
          const pagosPromises = prestamos.map((prestamo: Prestamo) => {
            console.log("Solicitando pagos para préstamo ID:", prestamo.id);
            return apiRequest("GET", `/api/prestamos/${prestamo.id}/pagos`)
              .then(res => {
                if (!res.ok) {
                  console.log(`Error al cargar pagos para préstamo ${prestamo.id}:`, res.status);
                  return [];
                }
                return res.json().catch(() => {
                  console.log(`Error al parsear pagos para préstamo ${prestamo.id}`);
                  return [];
                });
              })
              .catch(err => {
                console.error(`Error de red al cargar pagos para préstamo ${prestamo.id}:`, err);
                return [];
              });
          });
          
          const pagosResults = await Promise.all(pagosPromises);
          console.log("Resultados de pagos obtenidos:", pagosResults);
          
          const todosLosPagos = pagosResults.flat();
          console.log("Total de pagos procesados:", todosLosPagos.length);
          
          setPagosCliente(todosLosPagos);
        } catch (pagosError) {
          console.error("Error al procesar pagos:", pagosError);
          setPagosCliente([]);
        }
      } else {
        console.log("No hay préstamos para cargar pagos");
        setPagosCliente([]);
      }
      
      // Cargar los datos de ruta y notas del cliente seleccionado
      if (selectedCliente) {
        console.log("Estableciendo datos del cliente:", { 
          ruta: selectedCliente.ruta || "", 
          notas: selectedCliente.notas || "" 
        });
        setClienteRuta(selectedCliente.ruta || "");
        setClienteNotas(selectedCliente.notas || "");
      }
      
    } catch (error) {
      console.error("Error en fetchPrestamosCliente:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del cliente",
        variant: "destructive",
      });
      setPrestamosCliente([]);
      setPagosCliente([]);
    } finally {
      setIsLoadingPrestamos(false);
    }
  };
  
  // Manejar selección de cliente
  const handleClienteClick = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    // Establecer los valores de ruta y notas inmediatamente al seleccionar el cliente
    setClienteRuta(cliente.ruta || "");
    setClienteNotas(cliente.notas || "");
    // Cargar los préstamos y pagos
    await fetchPrestamosCliente(cliente.id);
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Clientes asignados a {selectedCobrador?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona un cliente para ver sus préstamos y pagos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lista de clientes en la columna izquierda */}
            <div className="lg:col-span-1 overflow-auto max-h-[calc(100vh-300px)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Clientes</h3>
                <span className="text-sm text-muted-foreground">{clientesCobrador.length} total</span>
              </div>
              
              <div className="relative mb-3">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar cliente..." 
                  className="pl-8"
                  onChange={(e) => setClienteSearchQuery(e.target.value)}
                  value={clienteSearchQuery}
                />
              </div>
              
              <div className="space-y-2">
                {clientesCobrador.length === 0 ? (
                  <div className="p-4 text-center bg-muted rounded-md">
                    Este cobrador no tiene clientes asignados
                  </div>
                ) : filteredClientes.length === 0 ? (
                  <div className="p-4 text-center bg-muted rounded-md">
                    No se encontraron clientes con "{clienteSearchQuery}"
                  </div>
                ) : (
                  filteredClientes.map((cliente) => (
                    <div 
                      key={cliente.id} 
                      className={`p-3 rounded-md cursor-pointer transition-colors flex items-center space-x-2 ${selectedCliente?.id === cliente.id ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                      onClick={() => handleClienteClick(cliente)}
                    >
                      <Avatar className={selectedCliente?.id === cliente.id ? 'border-2 border-primary-foreground' : ''}>
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {getInitials(cliente.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-medium truncate">{cliente.nombre}</div>
                        <div className="text-sm opacity-70 truncate">{cliente.telefono}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Detalles del cliente en la columna derecha */}
            <div className="lg:col-span-2 border rounded-md p-4">
              {selectedCliente ? (
                <div>
                  <div className="flex items-center space-x-4 mb-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-lg">
                        {getInitials(selectedCliente.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold">{selectedCliente.nombre}</h2>
                      <p className="text-muted-foreground">{selectedCliente.documento_identidad || "Sin documento"}</p>
                    </div>
                  </div>
                  
                  <Tabs value={activeClienteTab} onValueChange={setActiveClienteTab} className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="info" className="flex-1">
                        <Info className="h-4 w-4 mr-2" /> Información
                      </TabsTrigger>
                      <TabsTrigger value="loans" className="flex-1">
                        <CreditCard className="h-4 w-4 mr-2" /> Préstamos
                      </TabsTrigger>
                      <TabsTrigger value="payments" className="flex-1">
                        <DollarSign className="h-4 w-4 mr-2" /> Pagos
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="info" className="space-y-4 mt-4">
                      {/* Botón para editar ruta y notas */}
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex items-center gap-1"
                          onClick={() => {
                            setClienteRuta(selectedCliente.ruta || "");
                            setClienteNotas(selectedCliente.notas || "");
                            setIsEditingCliente(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar ruta/notas
                        </Button>
                      </div>
                      
                      {/* Debt to Income Ratio Visualizer */}
                      {!isLoadingPrestamos && prestamosCliente.length > 0 && (
                        <div className="border rounded-md p-4 mb-4 space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold flex items-center gap-1.5">
                              <PieChart className="h-4 w-4 text-muted-foreground" />
                              Análisis Financiero
                            </h3>
                            {getDebtToIncomeRatio() < 35 ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-800">Saludable</Badge>
                            ) : getDebtToIncomeRatio() < 50 ? (
                              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-800">Moderado</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-800">Elevado</Badge>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between mb-1 text-sm">
                                <span>Ratio Deuda-Ingresos</span>
                                <span className={
                                  getDebtToIncomeRatio() < 35 ? "text-green-600" : 
                                  getDebtToIncomeRatio() < 50 ? "text-yellow-600" : 
                                  "text-red-600"
                                }>
                                  {getDebtToIncomeRatio()}%
                                </span>
                              </div>
                              <Progress 
                                value={getDebtToIncomeRatio()} 
                                max={100}
                                className={`h-2 ${
                                  getDebtToIncomeRatio() < 35 ? "bg-green-100" : 
                                  getDebtToIncomeRatio() < 50 ? "bg-yellow-100" : 
                                  "bg-red-100"
                                }`}
                                indicatorClassName={
                                  getDebtToIncomeRatio() < 35 ? "bg-green-500" : 
                                  getDebtToIncomeRatio() < 50 ? "bg-yellow-500" : 
                                  "bg-red-500"
                                }
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="flex items-center p-2 rounded-md bg-muted/50">
                                <ArrowUpCircle className="h-5 w-5 text-green-500 mr-2" />
                                <div>
                                  <div className="text-xs text-muted-foreground">Ingresos Est.</div>
                                  <div className="font-medium">{formatCurrency(getEstimatedIncome())}</div>
                                </div>
                              </div>
                              <div className="flex items-center p-2 rounded-md bg-muted/50">
                                <ArrowDownCircle className="h-5 w-5 text-red-500 mr-2" />
                                <div>
                                  <div className="text-xs text-muted-foreground">Pagos Mensuales</div>
                                  <div className="font-medium">{formatCurrency(getTotalMonthlyPayments())}</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              {getDebtToIncomeRatio() < 35 ? 
                                "El cliente mantiene un buen equilibrio financiero." : 
                                getDebtToIncomeRatio() < 50 ? 
                                "Considere monitorear los pagos del cliente más de cerca." : 
                                "El cliente tiene una carga de deuda potencialmente arriesgada."}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {isEditingCliente ? (
                        <div className="border rounded-md p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Modificar información</h3>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setIsEditingCliente(false)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </Button>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <div className="text-sm font-medium leading-none">Ruta</div>
                              <Input 
                                id="ruta"
                                value={clienteRuta}
                                onChange={(e) => setClienteRuta(e.target.value)}
                                placeholder="Asignar ruta (ej: Zona Norte, Ruta 5, etc.)"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-sm font-medium leading-none">Notas</div>
                              <textarea 
                                id="notas"
                                value={clienteNotas}
                                onChange={(e) => setClienteNotas(e.target.value)}
                                placeholder="Agregar notas sobre el cliente"
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </div>
                            
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                onClick={() => setIsEditingCliente(false)}
                              >
                                Cancelar
                              </Button>
                              <Button 
                                onClick={async () => {
                                  try {
                                    const res = await apiRequest("PUT", `/api/clientes/${selectedCliente.id}`, {
                                      ...selectedCliente,
                                      ruta: clienteRuta,
                                      notas: clienteNotas
                                    });
                                    
                                    if (!res.ok) {
                                      throw new Error("Error al actualizar cliente");
                                    }
                                    
                                    const clienteActualizado = await res.json();
                                    setSelectedCliente(clienteActualizado);
                                    setIsEditingCliente(false);
                                    
                                    // Actualizar la lista de clientes
                                    const nuevaLista = clientesCobrador.map((c) => 
                                      c.id === clienteActualizado.id ? clienteActualizado : c
                                    );
                                    setClientesCobrador(nuevaLista);
                                    
                                    toast({
                                      title: "Cliente actualizado",
                                      description: "La información del cliente ha sido actualizada correctamente",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: "No se pudo actualizar la información del cliente",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Guardar cambios
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Teléfono</p>
                            <p className="font-medium">{selectedCliente.telefono}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Dirección</p>
                            <p className="font-medium">{selectedCliente.direccion || "No disponible"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Ruta</p>
                            <div className="font-medium">
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{selectedCliente.ruta || "Sin asignar"}</Badge>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Fecha de registro</p>
                            <p className="font-medium">{formatDate(selectedCliente.fecha_registro)}</p>
                          </div>
                          {selectedCliente.email && (
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">Email</p>
                              <p className="font-medium">{selectedCliente.email}</p>
                            </div>
                          )}
                          
                          {/* Notas con estilo mejorado */}
                          <div className="space-y-1 md:col-span-2">
                            <p className="text-sm text-muted-foreground">Notas</p>
                            <div className="font-medium p-2 bg-muted/50 rounded-md">
                              {selectedCliente.notas || "Sin notas adicionales"}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="loans" className="space-y-4 mt-4">
                      {isLoadingPrestamos ? (
                        <div className="flex justify-center py-6">
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                            <span className="text-sm text-muted-foreground">Cargando préstamos...</span>
                          </div>
                        </div>
                      ) : !prestamosCliente || prestamosCliente.length === 0 ? (
                        <div className="text-center py-6 bg-muted/20 rounded-md">
                          <p className="text-muted-foreground">Este cliente no tiene préstamos registrados</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Préstamos ({prestamosCliente.length})</h3>
                          <div className="space-y-3">
                            {prestamosCliente.map((prestamo) => (
                              <Card key={prestamo.id || Math.random()}>
                                <CardContent className="pt-6">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">Préstamo #{prestamo.id}</span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <Calendar className="h-3 w-3 inline mr-1" /> 
                                        {prestamo.fecha_prestamo ? formatDate(prestamo.fecha_prestamo) : "Fecha no disponible"}
                                      </div>
                                    </div>
                                    <Badge className={prestamo.estado ? getLoanStatus(prestamo.estado).className : ""}>
                                      {prestamo.estado ? getLoanStatus(prestamo.estado).label : "Estado desconocido"}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Monto</p>
                                      <p className="font-medium">{prestamo.monto_prestado ? formatCurrency(prestamo.monto_prestado) : "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Total a pagar</p>
                                      <p className="font-medium">{prestamo.monto_total_pagar ? formatCurrency(prestamo.monto_total_pagar) : "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Plazo</p>
                                      <p className="font-medium">{prestamo.numero_semanas ? `${prestamo.numero_semanas} semanas` : "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Pago semanal</p>
                                      <p className="font-medium">{prestamo.pago_semanal ? formatCurrency(prestamo.pago_semanal) : "-"}</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="payments" className="space-y-4 mt-4">
                      {isLoadingPrestamos ? (
                        <div className="flex justify-center py-6">
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                            <span className="text-sm text-muted-foreground">Cargando pagos...</span>
                          </div>
                        </div>
                      ) : !pagosCliente || pagosCliente.length === 0 ? (
                        <div className="text-center py-6 bg-muted/20 rounded-md">
                          <p className="text-muted-foreground">Este cliente no tiene pagos registrados</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Pagos ({pagosCliente.length})</h3>
                            <div className="text-sm text-right">
                              <div className="font-medium">Total pagado</div>
                              <div className="text-primary">
                                {formatCurrency(pagosCliente.reduce((sum, pago) => 
                                  sum + (pago.monto_pagado ? parseFloat(pago.monto_pagado) : 0), 0))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 max-h-[300px] overflow-auto">
                            {Array.isArray(pagosCliente) && pagosCliente
                              .filter(pago => pago && pago.id)
                              .sort((a, b) => {
                                if (!a.fecha_pago || !b.fecha_pago) return 0;
                                return new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime();
                              })
                              .map((pago) => (
                                <div key={pago.id || Math.random()} className="flex items-center justify-between p-3 rounded-md border">
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center">
                                      <DollarSign className="h-4 w-4" />
                                    </Badge>
                                    <div>
                                      <div className="font-medium">Pago #{pago.id}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {pago.fecha_pago ? formatDate(pago.fecha_pago) : "Fecha no disponible"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {pago.monto_pagado ? formatCurrency(pago.monto_pagado) : "-"}
                                    </div>
                                    <span className="inline-flex items-center text-xs">
                                      <Badge variant="secondary">Préstamo #{pago.prestamo_id || "?"}</Badge>
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Selecciona un cliente</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Haz clic en un cliente de la lista para ver su información detallada, préstamos y pagos
                  </p>
                </div>
              )}
            </div>
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