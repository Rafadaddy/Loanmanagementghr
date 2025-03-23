import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency, formatDate, getDateTimeFormat, getPaymentStatus } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import PaymentForm from "@/components/forms/payment-form";
import { Pago, Prestamo, Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { LoadingData } from "@/components/ui/loading";
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
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Pagos</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Gestión de pagos de préstamos</p>
        </div>
        
        <Button 
          className="mt-3 md:mt-0 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
          size="sm"
          onClick={() => setPaymentFormOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Registrar Pago
        </Button>
      </div>
      
      {/* Filtros y búsqueda */}
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar cliente o monto..."
            className="pl-8 text-sm"
            value={searchTerm}
            autoComplete="off"
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm.trim() !== "" && (
            <div className="absolute right-2 top-2.5 flex items-center">
              <span className="text-xs text-muted-foreground mr-2">
                {filteredPagos.length}
              </span>
              <button 
                type="button"
                className="text-muted-foreground hover:text-foreground"
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
        
        <Select 
          defaultValue="TODOS" 
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-full md:w-40 text-sm h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="A_TIEMPO">A tiempo</SelectItem>
            <SelectItem value="ATRASADO">Atrasados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Tarjetas de estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-500">
              {formatCurrency(
                pagos.reduce((sum, pago) => sum + parseFloat(pago.monto_pagado), 0)
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">{pagos.length} pagos</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Promedio</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-500">
              {formatCurrency(
                pagos.length > 0
                  ? pagos.reduce((sum, pago) => sum + parseFloat(pago.monto_pagado), 0) / pagos.length
                  : 0
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">Por pago</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Atrasados</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-500">
              {pagos.filter(pago => pago.estado === "ATRASADO").length}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {Math.round(
                (pagos.filter(pago => pago.estado === "ATRASADO").length / (pagos.length || 1)) * 100
              )}% del total
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Lista de Pagos */}
      <Card className="shadow-sm">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base md:text-lg">Historial de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          {isLoading ? (
            <LoadingData text="Cargando pagos..." />
          ) : paginatedPagos.length === 0 ? (
            <div className="text-center py-6">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-medium">No se encontraron pagos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || statusFilter !== "TODOS"
                  ? "No hay pagos que coincidan con los criterios." 
                  : "No hay pagos registrados."}
              </p>
            </div>
          ) : (
            <>
              {/* Vista móvil como tarjetas */}
              <div className="md:hidden">
                <div className="p-3 space-y-2">
                  {paginatedPagos.map((pago) => {
                    const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
                    const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
                    const esPagoParcial = pago.es_pago_parcial === "true";
                    const { label, className } = getPaymentStatus(pago.estado);
                    
                    return (
                      <Card key={pago.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold truncate mr-2">{cliente?.nombre || 'Cliente desconocido'}</div>
                              <div className="text-xs text-muted-foreground">
                                Préstamo: {prestamo ? formatCurrency(prestamo.monto_prestado) : 'N/A'}
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => handleEliminarPago(pago)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              <div className="text-base font-semibold text-emerald-600 dark:text-emerald-500">
                                {formatCurrency(pago.monto_pagado)}
                              </div>
                              {esPagoParcial && pago.monto_restante && (
                                <div className="text-xs text-amber-600 dark:text-amber-500">
                                  Restante: {formatCurrency(pago.monto_restante)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end">
                              <Badge
                                className={className}
                              >
                                {label}
                              </Badge>
                              
                              {esPagoParcial ? (
                                <Badge 
                                  variant="outline" 
                                  className="mt-1 text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                >
                                  Parcial
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className="mt-1 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                >
                                  Completo
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <div className="text-muted-foreground">
                              {formatDate(pago.fecha_pago)}
                            </div>
                            
                            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                              Semana {pago.numero_semana}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
              
              {/* Vista Desktop como tabla */}
              <div className="hidden md:block overflow-x-auto">
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
                          <TableCell className="text-emerald-600 dark:text-emerald-500 font-medium">
                            {formatCurrency(pago.monto_pagado)}
                            {esPagoParcial && pago.monto_restante && (
                              <div className="text-xs text-amber-600 dark:text-amber-500">
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
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                Parcial
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                Completo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEliminarPago(pago)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950"
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

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-center py-3">
                  <Pagination>
                    <PaginationContent>
                      {/* Versión móvil simplificada */}
                      <div className="flex md:hidden items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
                          disabled={currentPage <= 1}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(currentPage - 1);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6"/>
                          </svg>
                        </Button>
                        
                        <span className="text-sm px-2">
                          Página {currentPage} de {totalPages}
                        </span>
                        
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
                          disabled={currentPage >= totalPages}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        </Button>
                      </div>
                      
                      {/* Versión desktop completa */}
                      <div className="hidden md:flex">
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
                      </div>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
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
                <div className="mt-4 p-3 bg-muted rounded-md text-sm">
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
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
            >
              {eliminarPagoMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Botón flotante para registrar pago en móviles */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          onClick={() => setPaymentFormOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </MainLayout>
  );
}