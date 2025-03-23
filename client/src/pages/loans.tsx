import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency, formatDate, getLoanStatus } from "@/lib/utils";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import LoanForm from "@/components/forms/loan-form";
import { Prestamo, Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, Eye, CreditCard, Trash2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingData } from "@/components/ui/loading";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Loans() {
  const [loanFormOpen, setLoanFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const [prestamoAEliminar, setPrestamoAEliminar] = useState<Prestamo | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const { toast } = useToast();
  const itemsPerPage = 10;

  // Cargar la lista de préstamos
  const { data: prestamos = [], isLoading: loadingPrestamos } = useQuery<Prestamo[]>({
    queryKey: ['/api/prestamos'],
  });

  // Cargar la lista de clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Filtrar y ordenar préstamos
  const filteredPrestamos = prestamos
    .filter(prestamo => {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      const clienteName = cliente?.nombre || '';
      
      // Filtrar por estado si es diferente de TODOS
      const matchesStatus = statusFilter === "TODOS" || prestamo.estado === statusFilter;
      
      // Filtrar por término de búsqueda (nombre de cliente o monto)
      const matchesSearch = clienteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          prestamo.monto_prestado.toString().includes(searchTerm);
      
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      // Ordenar por fecha de préstamo (más reciente primero)
      return new Date(b.fecha_prestamo).getTime() - new Date(a.fecha_prestamo).getTime();
    });

  // Paginación
  const totalPages = Math.ceil(filteredPrestamos.length / itemsPerPage);
  const paginatedPrestamos = filteredPrestamos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mutation para eliminar un préstamo
  const eliminarPrestamoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/prestamos/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Préstamo eliminado",
        description: "El préstamo ha sido eliminado correctamente.",
        variant: "default",
      });
      // Refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/prestamos'] });
      // Cerrar el diálogo
      setAlertDialogOpen(false);
      setPrestamoAEliminar(null);
      
      // Recargar la página después de un breve retraso
      // para que el usuario pueda ver el mensaje de éxito
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el préstamo: ${error.message}`,
        variant: "destructive",
      });
      setAlertDialogOpen(false);
    },
  });

  // Función para confirmar eliminación
  const confirmarEliminacion = () => {
    if (prestamoAEliminar) {
      // Mostrar el loading global
      startLoading("Eliminando préstamo...");
      eliminarPrestamoMutation.mutate(prestamoAEliminar.id, {
        onSettled: () => {
          // Detener el loading independientemente del resultado
          stopLoading();
        }
      });
    }
  };

  // Función para abrir el diálogo de confirmación
  const handleEliminarPrestamo = (prestamo: Prestamo) => {
    setPrestamoAEliminar(prestamo);
    setAlertDialogOpen(true);
  };

  const isLoading = loadingPrestamos || loadingClientes;
  const { startLoading, stopLoading } = useLoading();

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Préstamos</h1>
          <p className="text-sm text-muted-foreground">Gestión de préstamos del sistema</p>
        </div>
        
        <Button 
          className="mt-4 md:mt-0 bg-primary hover:bg-blue-600"
          onClick={() => setLoanFormOpen(true)}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Nuevo Préstamo
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <CardTitle>Lista de Préstamos</CardTitle>
            
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
                  <SelectItem value="ACTIVO">Activos</SelectItem>
                  <SelectItem value="PAGADO">Pagados</SelectItem>
                  <SelectItem value="ATRASADO">Atrasados</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por cliente o monto..."
                  className="pl-8 w-full md:w-64 bg-muted/50"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  autoComplete="off"
                />
                {searchTerm.trim() !== "" && (
                  <div className="absolute right-2 top-2.5 flex items-center">
                    <span className="text-xs text-muted-foreground mr-2">
                      {filteredPrestamos.length} coincidencias
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingData text="Cargando préstamos..." />
          ) : paginatedPrestamos.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {searchTerm || statusFilter !== "TODOS"
                ? "No se encontraron préstamos con esos criterios de búsqueda" 
                : "No hay préstamos registrados"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Interés</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Semanas</TableHead>
                    <TableHead>Pago Semanal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPrestamos.map((prestamo) => {
                    const cliente = clientes.find(c => c.id === prestamo.cliente_id);
                    const { label, className } = getLoanStatus(prestamo.estado);
                    
                    return (
                      <TableRow key={prestamo.id}>
                        <TableCell className="font-medium">{cliente?.nombre || 'Cliente desconocido'}</TableCell>
                        <TableCell>{formatCurrency(prestamo.monto_prestado)}</TableCell>
                        <TableCell>{prestamo.tasa_interes}%</TableCell>
                        <TableCell>{formatDate(prestamo.fecha_prestamo)}</TableCell>
                        <TableCell>{prestamo.semanas_pagadas} / {prestamo.numero_semanas}</TableCell>
                        <TableCell>{formatCurrency(prestamo.pago_semanal)}</TableCell>
                        <TableCell>
                          <Badge className={className}>{label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link href={`/prestamos/${prestamo.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {prestamo.estado === 'PAGADO' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleEliminarPrestamo(prestamo)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
      
      <LoanForm 
        open={loanFormOpen} 
        onOpenChange={setLoanFormOpen}
      />

      {/* Diálogo de confirmación para eliminar préstamo */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Eliminar préstamo
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar este préstamo? Esta acción no se puede deshacer.
              {prestamoAEliminar && clientes && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p><strong>Cliente:</strong> {clientes.find(c => c.id === prestamoAEliminar.cliente_id)?.nombre || 'Cliente desconocido'}</p>
                  <p><strong>Monto:</strong> {formatCurrency(prestamoAEliminar.monto_prestado)}</p>
                  <p><strong>Fecha:</strong> {formatDate(prestamoAEliminar.fecha_prestamo)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminarPrestamoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacion}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={eliminarPrestamoMutation.isPending}
            >
              {eliminarPrestamoMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}