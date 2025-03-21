import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency, formatDate, getDateTimeFormat, getPaymentStatus } from "@/lib/utils";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import PaymentForm from "@/components/forms/payment-form";
import { Pago, Prestamo, Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, Plus, Trash2, AlertTriangle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function Payments() {
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagoAEliminar, setPagoAEliminar] = useState<Pago | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const { toast } = useToast();
  const itemsPerPage = 10;

  // Cargar la lista de pagos
  const { data: pagos = [], isLoading: loadingPagos } = useQuery<Pago[]>({
    queryKey: ['/api/pagos'],
  });

  // Cargar la lista de préstamos
  const { data: prestamos = [], isLoading: loadingPrestamos } = useQuery<Prestamo[]>({
    queryKey: ['/api/prestamos'],
  });

  // Cargar la lista de clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Filtrar y ordenar pagos
  const filteredPagos = pagos
    .filter(pago => {
      const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
      const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
      const clienteName = cliente?.nombre || '';
      
      // Filtrar por estado si es diferente de TODOS
      const matchesStatus = statusFilter === "TODOS" || pago.estado === statusFilter;
      
      // Filtrar por término de búsqueda (nombre de cliente, semana o monto)
      const matchesSearch = 
        clienteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        pago.numero_semana.toString().includes(searchTerm) ||
        pago.monto_pagado.toString().includes(searchTerm);
      
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      // Ordenar por fecha de pago (más reciente primero)
      return new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime();
    });

  // Paginación
  const totalPages = Math.ceil(filteredPagos.length / itemsPerPage);
  const paginatedPagos = filteredPagos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mutation para eliminar un pago
  const eliminarPagoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/pagos/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Pago eliminado",
        description: "El pago ha sido eliminado correctamente.",
        variant: "default",
      });
      // Refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/pagos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prestamos'] });
      // Cerrar el diálogo
      setAlertDialogOpen(false);
      setPagoAEliminar(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el pago: ${error.message}`,
        variant: "destructive",
      });
      setAlertDialogOpen(false);
    },
  });

  // Función para confirmar eliminación
  const confirmarEliminacion = () => {
    if (pagoAEliminar) {
      eliminarPagoMutation.mutate(pagoAEliminar.id);
    }
  };

  // Función para abrir el diálogo de confirmación
  const handleEliminarPago = (pago: Pago) => {
    setPagoAEliminar(pago);
    setAlertDialogOpen(true);
  };

  const isLoading = loadingPagos || loadingPrestamos || loadingClientes;

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-16 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pagos</h1>
            <p className="text-sm text-gray-600">Gestión de pagos de préstamos</p>
          </div>
          
          <Button 
            className="mt-4 md:mt-0 bg-primary hover:bg-blue-600"
            onClick={() => setPaymentFormOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </div>
        
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <CardTitle>Historial de Pagos</CardTitle>
              
              <div className="flex flex-col md:flex-row gap-2 mt-3 md:mt-0">
                <Select 
                  defaultValue="TODOS" 
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="A_TIEMPO">A tiempo</SelectItem>
                    <SelectItem value="ATRASADO">Atrasados</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Buscar por préstamo o cliente..."
                    className="pl-8 w-full md:w-64 bg-gray-50"
                    value={searchTerm}
                    autoComplete="off"
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  {searchTerm.trim() !== "" && (
                    <div className="absolute right-2 top-2.5 flex items-center">
                      <span className="text-xs text-gray-500 mr-2">
                        {filteredPagos.length} coincidencias
                      </span>
                      <button 
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Cargando pagos...</div>
            ) : paginatedPagos.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchTerm || statusFilter !== "TODOS"
                  ? "No se encontraron pagos con esos criterios de búsqueda" 
                  : "No hay pagos registrados"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Préstamo</TableHead>
                      <TableHead>Monto Pagado</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead>Semana</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPagos.map((pago) => {
                      const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
                      const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
                      const { label, className } = getPaymentStatus(pago.estado);
                      const esPagoParcial = pago.es_pago_parcial === "true";
                      
                      return (
                        <TableRow key={pago.id}>
                          <TableCell className="font-medium">{cliente?.nombre || 'Cliente desconocido'}</TableCell>
                          <TableCell>{prestamo ? formatCurrency(prestamo.monto_prestado) : 'N/A'}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatCurrency(pago.monto_pagado)}
                            {esPagoParcial && pago.monto_restante && (
                              <div className="text-xs text-amber-600">
                                Restante: {formatCurrency(pago.monto_restante)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getDateTimeFormat(pago.fecha_pago)}</TableCell>
                          <TableCell>{pago.numero_semana}</TableCell>
                          <TableCell>
                            <Badge className={className}>{label}</Badge>
                          </TableCell>
                          <TableCell>
                            {esPagoParcial ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Parcial
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Completo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEliminarPago(pago)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar pago"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
        
        <PaymentForm 
          open={paymentFormOpen} 
          onOpenChange={setPaymentFormOpen}
        />
        
        {/* Dialog de confirmación para eliminar pago */}
        <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirmar eliminación
              </AlertDialogTitle>
              <AlertDialogDescription>
                ¿Está seguro de que desea eliminar este pago? Esta acción revertirá el pago y actualizará el estado del préstamo.
                {pagoAEliminar && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
                    <div><strong>Cliente:</strong> {clientes.find(c => {
                      const prestamo = prestamos.find(p => p.id === pagoAEliminar.prestamo_id);
                      return prestamo ? c.id === prestamo.cliente_id : false;
                    })?.nombre || 'Cliente desconocido'}</div>
                    <div><strong>Monto:</strong> {formatCurrency(pagoAEliminar.monto_pagado)}</div>
                    <div><strong>Fecha:</strong> {getDateTimeFormat(pagoAEliminar.fecha_pago)}</div>
                    <div><strong>Semana:</strong> {pagoAEliminar.numero_semana}</div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarEliminacion}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar pago
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}