import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, Trash2, Edit, Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User as SelectUser } from "@shared/schema";

// Esquema de validación para el formulario de cambiar credenciales
const credencialesFormSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  username: z
    .string()
    .email("Ingrese una dirección de correo válida")
    .min(1, "El correo electrónico es obligatorio"),
  passwordActual: z
    .string()
    .min(6, "La contraseña actual debe tener al menos 6 caracteres"),
  password: z
    .string()
    .min(6, "La nueva contraseña debe tener al menos 6 caracteres")
    .optional(),
  confirmarPassword: z.string().optional(),
}).refine(data => !data.password || data.password === data.confirmarPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarPassword"],
});

// Esquema de validación para crear un nuevo usuario
const nuevoUsuarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  username: z
    .string()
    .email("Ingrese una dirección de correo válida")
    .min(1, "El correo electrónico es obligatorio"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmarPassword: z.string(),
  rol: z.enum(["ADMIN", "COBRADOR", "OPERADOR", "CONSULTA"], {
    required_error: "Debes seleccionar un rol",
  }),
}).refine(data => data.password === data.confirmarPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarPassword"],
});

type CredencialesFormValues = z.infer<typeof credencialesFormSchema>;
type NuevoUsuarioFormValues = z.infer<typeof nuevoUsuarioSchema>;

export default function UserManagementSection() {
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevoUsuarioDialogOpen, setNuevoUsuarioDialogOpen] = useState(false);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("misCredenciales");

  // Obtener todos los usuarios
  const { data: usuarios = [], refetch: refetchUsuarios } = useQuery<SelectUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return await res.json();
    },
    enabled: activeTab === "listaUsuarios",
  });

  const form = useForm<CredencialesFormValues>({
    resolver: zodResolver(credencialesFormSchema),
    defaultValues: {
      nombre: user?.nombre || "",
      username: user?.username || "",
      passwordActual: "",
      password: "",
      confirmarPassword: "",
    },
  });

  const nuevoUsuarioForm = useForm<NuevoUsuarioFormValues>({
    resolver: zodResolver(nuevoUsuarioSchema),
    defaultValues: {
      nombre: "",
      username: "",
      password: "",
      confirmarPassword: "",
      rol: "OPERADOR",
    },
  });

  // Mutación para cambiar credenciales
  const mutation = useMutation({
    mutationFn: async (values: CredencialesFormValues) => {
      // Eliminar confirmarPassword antes de enviar al servidor
      const { confirmarPassword, ...dataToSend } = values;
      
      // Si password está vacío, no lo enviamos
      if (!dataToSend.password) {
        const { password, ...dataWithoutPassword } = dataToSend;
        return apiRequest("POST", "/api/cambiar-credenciales", dataWithoutPassword);
      }
      
      return apiRequest("POST", "/api/cambiar-credenciales", dataToSend);
    },
    onSuccess: async () => {
      toast({
        title: "Credenciales actualizadas",
        description: "Tus credenciales han sido actualizadas correctamente."
      });
      
      // Recargar datos del usuario
      await refetchUser();
      
      // Cerrar el diálogo y resetear el formulario
      setDialogOpen(false);
      form.reset({
        nombre: user?.nombre || "",
        username: user?.username || "",
        passwordActual: "",
        password: "",
        confirmarPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudieron actualizar las credenciales: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutación para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (values: NuevoUsuarioFormValues) => {
      const { confirmarPassword, ...dataToSend } = values;
      return apiRequest("POST", "/api/users", dataToSend);
    },
    onSuccess: async () => {
      toast({
        title: "Usuario creado",
        description: "El nuevo usuario ha sido creado correctamente."
      });
      
      // Recargar la lista de usuarios
      await refetchUsuarios();
      
      // Cerrar el diálogo y resetear el formulario
      setNuevoUsuarioDialogOpen(false);
      nuevoUsuarioForm.reset({
        nombre: "",
        username: "",
        password: "",
        confirmarPassword: "",
        rol: "OPERADOR",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo crear el usuario: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutación para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: async () => {
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente."
      });
      
      // Recargar la lista de usuarios
      await refetchUsuarios();
      
      // Cerrar el diálogo de confirmación
      setConfirmDeleteDialogOpen(false);
      setSelectedUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el usuario: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  function onSubmit(values: CredencialesFormValues) {
    mutation.mutate(values);
  }

  function onNuevoUsuarioSubmit(values: NuevoUsuarioFormValues) {
    createUserMutation.mutate(values);
  }

  function confirmarEliminarUsuario(userId: number) {
    setSelectedUserId(userId);
    setConfirmDeleteDialogOpen(true);
  }

  function eliminarUsuario() {
    if (selectedUserId) {
      deleteUserMutation.mutate(selectedUserId);
    }
  }

  function getRolLabel(rol: string): string {
    switch (rol) {
      case "ADMIN": return "Administrador";
      case "COBRADOR": return "Cobrador";
      case "OPERADOR": return "Operador";
      case "CONSULTA": return "Consulta";
      default: return rol;
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Gestión de Usuarios</CardTitle>
        <CardDescription>
          Administra las credenciales y permisos de los usuarios del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="misCredenciales">Mis Credenciales</TabsTrigger>
            <TabsTrigger value="listaUsuarios">Usuarios del Sistema</TabsTrigger>
          </TabsList>
          
          <TabsContent value="misCredenciales">
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Nombre</h3>
                  <p className="text-sm text-muted-foreground">{user?.nombre || "No especificado"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Correo Electrónico</h3>
                  <p className="text-sm text-muted-foreground">{user?.username}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Rol</h3>
                  <p className="text-sm text-muted-foreground">{getRolLabel(user?.rol || "")}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Contraseña</h3>
                  <p className="text-sm text-muted-foreground">••••••••</p>
                </div>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mt-4">Cambiar Mis Credenciales</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cambiar Credenciales</DialogTitle>
                    <DialogDescription>
                      Actualiza tu nombre, correo electrónico o contraseña. Deja la nueva contraseña en blanco si no deseas cambiarla.
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="passwordActual"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña Actual</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nueva Contraseña (opcional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormDescription>
                              Deja en blanco para mantener la contraseña actual
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmarPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={mutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {mutation.isPending ? "Actualizando..." : "Actualizar Credenciales"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
          
          <TabsContent value="listaUsuarios">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Usuarios del Sistema</h2>
              <Dialog open={nuevoUsuarioDialogOpen} onOpenChange={setNuevoUsuarioDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                      Ingresa los datos del nuevo usuario y asígnale un rol en el sistema.
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...nuevoUsuarioForm}>
                    <form onSubmit={nuevoUsuarioForm.handleSubmit(onNuevoUsuarioSubmit)} className="space-y-4">
                      <FormField
                        control={nuevoUsuarioForm.control}
                        name="nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={nuevoUsuarioForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={nuevoUsuarioForm.control}
                        name="rol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rol</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="COBRADOR">Cobrador</SelectItem>
                                <SelectItem value="OPERADOR">Operador</SelectItem>
                                <SelectItem value="CONSULTA">Consulta</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              El rol determina qué permisos tendrá el usuario en el sistema.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={nuevoUsuarioForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={nuevoUsuarioForm.control}
                        name="confirmarPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Contraseña</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={createUserMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {createUserMutation.isPending ? "Creando..." : "Crear Usuario"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {usuarios.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground">No hay usuarios registrados todavía.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Lista de usuarios del sistema</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>{usuario.id}</TableCell>
                        <TableCell>{usuario.nombre}</TableCell>
                        <TableCell>{usuario.username}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            {getRolLabel(usuario.rol)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                ...
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar Usuario
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => confirmarEliminarUsuario(usuario.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar Usuario
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Diálogo de confirmación para eliminar */}
            <Dialog open={confirmDeleteDialogOpen} onOpenChange={setConfirmDeleteDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Confirmar Eliminación</DialogTitle>
                  <DialogDescription>
                    ¿Estás seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setConfirmDeleteDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={eliminarUsuario}
                    disabled={deleteUserMutation.isPending}
                  >
                    {deleteUserMutation.isPending ? "Eliminando..." : "Eliminar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}