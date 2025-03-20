import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate, getInitials } from "@/lib/utils";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import ClientForm from "@/components/forms/client-form";
import { Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Edit, Trash2 } from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Clients() {
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | undefined>(undefined);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  // Cargar la lista de clientes
  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });
  
  // Mutación para eliminar cliente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await apiRequest("DELETE", `/api/clientes/${id}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Error al eliminar el cliente');
        }
        return await res.json();
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error al eliminar el cliente');
      }
    },
    onSuccess: () => {
      // Invalidar consultas para actualizar los datos automáticamente
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/estadisticas'] });
      
      // Invalidar consultas relacionadas con clientes en préstamos y pagos
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/prestamos" ||
          (query.queryKey[0] === "/api/clientes" && query.queryKey.length > 1)
      });
      
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado con éxito"
      });
      
      setDeleteDialogOpen(false);
      setClienteToDelete(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar cliente",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filtrar clientes por búsqueda
  const filteredClientes = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefono.includes(searchTerm) ||
    cliente.documento_identidad.includes(searchTerm)
  );

  // Paginación
  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const paginatedClientes = filteredClientes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEditCliente = (cliente: Cliente) => {
    setClienteToEdit(cliente);
    setClientFormOpen(true);
  };

  const handleNewCliente = () => {
    setClienteToEdit(undefined);
    setClientFormOpen(true);
  };

  const handleFormClose = () => {
    setClientFormOpen(false);
    setClienteToEdit(undefined);
  };
  
  const handleDeleteCliente = (cliente: Cliente) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (clienteToDelete) {
      deleteMutation.mutate(clienteToDelete.id);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-16 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
            <p className="text-sm text-gray-600">Gestión de clientes del sistema</p>
          </div>
          
          <Button 
            className="mt-4 md:mt-0 bg-primary hover:bg-blue-600"
            onClick={handleNewCliente}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
        
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <CardTitle>Lista de Clientes</CardTitle>
              <div className="relative mt-2 md:mt-0 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Buscar cliente..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Cargando clientes...</div>
            ) : paginatedClientes.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchTerm 
                  ? "No se encontraron clientes con ese criterio de búsqueda" 
                  : "No hay clientes registrados"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              {getInitials(cliente.nombre)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{cliente.nombre}</TableCell>
                        <TableCell>{cliente.telefono}</TableCell>
                        <TableCell>{cliente.direccion}</TableCell>
                        <TableCell>{cliente.documento_identidad}</TableCell>
                        <TableCell>{formatDate(cliente.fecha_registro)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditCliente(cliente)}
                              title="Editar cliente"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteCliente(cliente)}
                              title="Eliminar cliente"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }} 
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1;
                    // Mostrar primeras, última y páginas alrededor de la actual
                    if (
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === currentPage}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    
                    // Añadir elipsis solo una vez entre bloques
                    if (
                      (page === 2 && currentPage > 3) ||
                      (page === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }} 
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardContent>
        </Card>
        
        <ClientForm 
          open={clientFormOpen} 
          onOpenChange={handleFormClose}
          cliente={clienteToEdit}
        />
        
        {/* Diálogo de confirmación para eliminar cliente */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                {clienteToDelete ? (
                  <>
                    <p>Estás a punto de eliminar al cliente:</p>
                    <p className="font-semibold mt-2">{clienteToDelete.nombre}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta acción no se puede deshacer. Si el cliente tiene préstamos asociados,
                      no podrá ser eliminado.
                    </p>
                  </>
                ) : (
                  "Estás a punto de eliminar este cliente. Esta acción no se puede deshacer."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-500 hover:bg-red-600"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}