import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { formatCurrency, formatDate, getLoanStatus, getPaymentStatus } from "@/lib/utils";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import PaymentForm from "@/components/forms/payment-form";
import LoanSchedule from "@/components/loan/loan-schedule";
import { Prestamo, Cliente, Pago } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingData, LoadingButton } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  Percent, 
  Clock, 
  Banknote, 
  ArrowUpDown, 
  AlertTriangle,
  Edit
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function LoanDetails() {
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [nuevoMontoPagado, setNuevoMontoPagado] = useState<string>("");
  
  // Estado para cambiar el día de pago
  const [changeDayDialogOpen, setChangeDayDialogOpen] = useState(false);
  const [nuevaFechaPago, setNuevaFechaPago] = useState<string>("");
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const prestamoId = parseInt(params.id);

  if (isNaN(prestamoId)) {
    navigate("/prestamos");
    // Renderizamos un placeholder mientras se redirecciona
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span>Redirigiendo...</span>
      </div>
    );
  }

  // Cargar datos del préstamo
  const { data: prestamo, isLoading: loadingPrestamo } = useQuery<Prestamo>({
    queryKey: [`/api/prestamos/${prestamoId}`]
  });

  // Cargar datos del cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery<Cliente>({
    queryKey: ['/api/clientes', prestamo?.cliente_id],
    enabled: !!prestamo?.cliente_id,
    queryFn: async ({ queryKey }) => {
      const [_base, clienteId] = queryKey;
      const res = await fetch(`/api/clientes/${clienteId}`);
      if (!res.ok) throw new Error("No se pudo cargar el cliente");
      return res.json();
    }
  });

  // Cargar pagos del préstamo
  const { data: pagos = [], isLoading: loadingPagos } = useQuery<Pago[]>({
    queryKey: ['/api/pagos', { prestamo_id: prestamoId }],
    enabled: !!prestamoId,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/pagos?prestamo_id=${prestamoId}`);
      if (!res.ok) throw new Error("No se pudieron cargar los pagos");
      return res.json();
    }
  });

  // Cargar total pagado del préstamo
  const { data: totalPagadoData, isLoading: loadingTotalPagado } = useQuery<{totalPagado: number}>({
    queryKey: [`/api/prestamos/${prestamoId}/total-pagado`],
    enabled: !!prestamoId,
    queryFn: async () => {
      const res = await fetch(`/api/prestamos/${prestamoId}/total-pagado`);
      if (!res.ok) throw new Error("No se pudo cargar el total pagado");
      return res.json();
    }
  });

  // Mutation para actualizar estado del préstamo
  const actualizarEstadoMutation = useMutation({
    mutationFn: async (nuevoEstado: string) => {
      const res = await apiRequest("PUT", `/api/prestamos/${prestamoId}`, {
        estado: nuevoEstado
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidar todas las consultas relevantes
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pagos'] });
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      // Forzar la recarga de datos específicos de este préstamo
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.refetchQueries({ queryKey: ['/api/pagos', { prestamo_id: prestamoId }] });
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      toast({
        title: "Estado actualizado",
        description: "El estado del préstamo ha sido actualizado correctamente."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el estado: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para cambiar el día de pago
  const cambiarDiaPagoMutation = useMutation({
    mutationFn: async (nuevaFecha: string) => {
      const res = await apiRequest("POST", `/api/prestamos/${prestamoId}/cambiar-dia-pago`, { 
        nuevaFechaPago: nuevaFecha 
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidar todas las consultas relevantes
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/prestamos'] });
      
      // Cerrar el diálogo de cambio de día
      setChangeDayDialogOpen(false);
      setNuevaFechaPago("");
      
      toast({
        title: "Día de pago actualizado",
        description: `El día de pago ha sido cambiado a ${data.nuevoDiaSemana}.`,
      });
      
      // Recargar la página después de un breve retraso
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      }, 500);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo cambiar el día de pago: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutation para actualizar un pago
  const actualizarPagoMutation = useMutation({
    mutationFn: async ({ id, monto_pagado }: { id: number; monto_pagado: string }) => {
      const res = await apiRequest("PUT", `/api/pagos/${id}`, { monto_pagado });
      return res.json();
    },
    onSuccess: () => {
      // Invalidar todas las consultas relevantes
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pagos'] });
      queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      // Forzar la recarga de datos específicos de este préstamo
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
      queryClient.refetchQueries({ queryKey: ['/api/pagos', { prestamo_id: prestamoId }] });
      queryClient.refetchQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
      
      setEditPaymentDialogOpen(false);
      setSelectedPago(null);
      setNuevoMontoPagado("");
      
      toast({
        title: "Pago actualizado",
        description: "El pago ha sido actualizado correctamente."
      });
      
      // Recargar la página después de un breve retraso
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el pago: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const { startLoading, stopLoading } = useLoading();
  
  const handleUpdateStatus = (nuevoEstado: string) => {
    startLoading(`Cambiando estado a ${nuevoEstado}...`);
    actualizarEstadoMutation.mutate(nuevoEstado, {
      onSettled: () => {
        stopLoading();
      }
    });
  };
  
  const handleEditPayment = (pago: Pago) => {
    setSelectedPago(pago);
    setNuevoMontoPagado(pago.monto_pagado);
    setEditPaymentDialogOpen(true);
  };
  
  const handleUpdatePayment = () => {
    if (!selectedPago) return;
    
    startLoading("Actualizando pago...");
    actualizarPagoMutation.mutate(
      { 
        id: selectedPago.id, 
        monto_pagado: nuevoMontoPagado 
      },
      {
        onSettled: () => {
          stopLoading();
        }
      }
    );
  };
  
  const handleChangeDaySubmit = () => {
    startLoading("Cambiando día de pago...");
    cambiarDiaPagoMutation.mutate(
      nuevaFechaPago,
      {
        onSettled: () => {
          stopLoading();
        }
      }
    );
  };

  const isLoading = loadingPrestamo || loadingCliente || loadingPagos || loadingTotalPagado;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-16 md:mt-0">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                onClick={() => navigate("/prestamos")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Cargando detalles...</h1>
            </div>
            <div className="flex justify-center items-center h-96">
              <LoadingData text="Cargando información del préstamo..." />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!prestamo || !cliente) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-16 md:mt-0">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                onClick={() => navigate("/prestamos")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Préstamo no encontrado</h1>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-10">
                  <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Préstamo no encontrado</h2>
                  <p className="text-muted-foreground mb-6">El préstamo que estás buscando no existe o ha sido eliminado.</p>
                  <Button onClick={() => navigate("/prestamos")} className="bg-primary hover:bg-primary/90">
                    Volver a préstamos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  // Cálculo del progreso de pago
  const progresoSemanas = (prestamo.semanas_pagadas / prestamo.numero_semanas) * 100;
  const { label: estadoLabel, className: estadoClass } = getLoanStatus(prestamo.estado);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 z-50 w-full bg-background border-b">
        <div className="p-2 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="mr-2"
            onClick={() => navigate("/prestamos")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">Detalles del Préstamo</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Préstamo #{prestamo.id} - {cliente.nombre}</p>
          </div>
        </div>
      </div>
      <main className="w-full overflow-x-auto overflow-y-auto p-2 md:p-6 mt-14 pb-48">
          <div className="w-full mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2"
                  onClick={() => navigate("/prestamos")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Detalles del Préstamo</h1>
                  <p className="text-sm text-muted-foreground">Préstamo #{prestamo.id} - {cliente.nombre}</p>
                </div>
              </div>
              
              <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-2">
                {prestamo.estado !== "PAGADO" && (
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-sm sm:text-base w-full sm:w-auto"
                    onClick={() => setPaymentFormOpen(true)}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Registrar Pago
                  </Button>
                )}
                
                {prestamo.estado !== "PAGADO" && (
                  <Button 
                    variant="outline"
                    onClick={() => setChangeDayDialogOpen(true)}
                    className="text-sm sm:text-base w-full sm:w-auto"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Cambiar Día de Pago
                  </Button>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline"
                      className="text-sm sm:text-base w-full sm:w-auto"
                    >
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Cambiar Estado
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cambiar Estado del Préstamo</AlertDialogTitle>
                      <AlertDialogDescription>
                        Seleccione el nuevo estado para este préstamo.
                        Esto puede afectar los cálculos y reportes del sistema.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid grid-cols-1 gap-2 py-4">
                      <Button 
                        variant={prestamo.estado === "ACTIVO" ? "default" : "outline"}
                        className={prestamo.estado === "ACTIVO" ? "bg-blue-600" : ""}
                        onClick={() => handleUpdateStatus("ACTIVO")}
                      >
                        ACTIVO
                      </Button>
                      <Button 
                        variant={prestamo.estado === "PAGADO" ? "default" : "outline"}
                        className={prestamo.estado === "PAGADO" ? "bg-green-600" : ""}
                        onClick={() => handleUpdateStatus("PAGADO")}
                      >
                        PAGADO
                      </Button>
                      <Button 
                        variant={prestamo.estado === "ATRASADO" ? "default" : "outline"}
                        className={prestamo.estado === "ATRASADO" ? "bg-red-600" : ""}
                        onClick={() => handleUpdateStatus("ATRASADO")}
                      >
                        ATRASADO
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Información del Préstamo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-y-6 gap-x-4 md:gap-x-10">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-2 text-xs font-medium text-muted-foreground">
                          {cliente.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <p className="text-base font-medium">{cliente.nombre}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <Badge className={estadoClass}>{estadoLabel}</Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Monto Prestado</p>
                      <p className="text-xl font-semibold flex items-center">
                        <CreditCard className="h-4 w-4 mr-2 text-primary" />
                        {formatCurrency(prestamo.monto_prestado)}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Monto Total a Pagar</p>
                      <p className="text-xl font-semibold flex items-center">
                        <Banknote className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
                        {formatCurrency(prestamo.monto_total_pagar)}
                      </p>
                    </div>
    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Pagado</p>
                      <p className="text-xl font-semibold flex items-center">
                        <Banknote className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
                        {formatCurrency(totalPagadoData?.totalPagado || 0)}
                      </p>
                    </div>
    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Mora Acumulada</p>
                      <p className="text-xl font-semibold flex items-center">
                        <Percent className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />
                        {formatCurrency(prestamo.monto_mora_acumulada || 0)}
                      </p>
                    </div>
    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Balance Pendiente</p>
                      <p className="text-xl font-semibold flex items-center">
                        <Banknote className="h-4 w-4 mr-2 text-orange-500 dark:text-orange-400" />
                        {formatCurrency((parseFloat(prestamo.monto_total_pagar) + parseFloat(prestamo.monto_mora_acumulada || "0")) - (totalPagadoData?.totalPagado || 0))}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Fecha del Préstamo</p>
                      <p className="text-base font-medium flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(prestamo.fecha_prestamo)}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Tasa de Interés</p>
                      <p className="text-base font-medium flex items-center">
                        <Percent className="h-4 w-4 mr-2 text-muted-foreground" />
                        {prestamo.tasa_interes}%
                      </p>
                    </div>
    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Tasa de Mora</p>
                      <p className="text-base font-medium flex items-center">
                        <Percent className="h-4 w-4 mr-2 text-muted-foreground" />
                        {prestamo.tasa_mora || 0}%
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Frecuencia de Pago</p>
                      <p className="text-base font-medium flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {prestamo.frecuencia_pago}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Pago Semanal</p>
                      <p className="text-base font-medium flex items-center">
                        <Banknote className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatCurrency(prestamo.pago_semanal)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-8">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-muted-foreground">Progreso de Pago</p>
                      <p className="text-sm font-medium">{prestamo.semanas_pagadas} de {prestamo.numero_semanas} semanas</p>
                    </div>
                    <Progress value={progresoSemanas} className="h-2" />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-muted-foreground">0%</p>
                      <p className="text-xs text-muted-foreground">100%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Detalles del Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    <li className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Nombre</span>
                      <span className="font-medium">{cliente.nombre}</span>
                    </li>
                    <li className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Teléfono</span>
                      <span className="font-medium">{cliente.telefono}</span>
                    </li>
                    <li className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Dirección</span>
                      <span className="font-medium">{cliente.direccion}</span>
                    </li>
                    <li className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Documento de Identidad</span>
                      <span className="font-medium">{cliente.documento_identidad}</span>
                    </li>
                    <li className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Fecha de Registro</span>
                      <span className="font-medium">{formatDate(cliente.fecha_registro)}</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="flex justify-center border-t pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(`/clientes`)}
                  >
                    Ver Información Completa
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Historial de Pagos</CardTitle>
                {pagos.length > 0 && prestamo.estado !== "PAGADO" && (
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 h-7 px-2 text-xs"
                    onClick={() => setPaymentFormOpen(true)}
                  >
                    Registrar Pago
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-2 py-2 sm:p-6">
                {pagos.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm">No hay pagos registrados para este préstamo</p>
                    {prestamo.estado !== "PAGADO" && (
                      <Button 
                        className="mt-3 bg-primary hover:bg-primary/90 h-8 px-3 text-xs"
                        onClick={() => setPaymentFormOpen(true)}
                      >
                        Registrar Primer Pago
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Vista móvil - Tarjetas individuales */}
                    <div className="block md:hidden space-y-2">
                      {pagos.map(pago => {
                        const { label, className } = getPaymentStatus(pago.estado);
                        
                        return (
                          <div key={pago.id} className="border rounded-lg p-2 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-sm">Semana {pago.numero_semana}</span>
                              <Badge className={`${className} text-xs h-5`}>{label}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2">
                              <div>
                                <p className="text-muted-foreground">Fecha:</p>
                                <p className="font-medium">{formatDate(pago.fecha_pago)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Monto:</p>
                                <p className="font-medium text-green-500">{formatCurrency(pago.monto_pagado)}</p>
                              </div>
                              
                              {parseFloat(pago.monto_mora || "0") > 0 && (
                                <div>
                                  <p className="text-muted-foreground">Mora:</p>
                                  <p className="font-medium text-red-500">{formatCurrency(pago.monto_mora)}</p>
                                </div>
                              )}
                              
                              {parseFloat(pago.monto_restante || "0") > 0 && (
                                <div>
                                  <p className="text-muted-foreground">Restante:</p>
                                  <p className="font-medium text-orange-500">{formatCurrency(pago.monto_restante)}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleEditPayment(pago)}
                              >
                                Editar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Vista desktop - Tabla horizontal */}
                    <div className="hidden md:block overflow-x-auto rounded-md border">
                      <Table className="cronograma-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16 whitespace-nowrap">Sem.</TableHead>
                            <TableHead className="whitespace-nowrap">Fecha de Pago</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Monto Pagado</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Mora</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Restante</TableHead>
                            <TableHead className="whitespace-nowrap">Estado</TableHead>
                            <TableHead className="w-16 text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagos.map((pago) => {
                            const { label, className } = getPaymentStatus(pago.estado);
                            
                            return (
                              <TableRow key={pago.id}>
                                <TableCell className="font-medium">{pago.numero_semana}</TableCell>
                                <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                                <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                                  {formatCurrency(pago.monto_pagado)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-500">
                                  {parseFloat(pago.monto_mora || "0") > 0 ? formatCurrency(pago.monto_mora) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-medium text-orange-500">
                                  {parseFloat(pago.monto_restante || "0") > 0 ? formatCurrency(pago.monto_restante) : "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge className={className}>{label}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0" 
                                    onClick={() => handleEditPayment(pago)}
                                  >
                                    <span className="sr-only">Editar</span>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Cronograma de Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <LoanSchedule 
                  prestamo={prestamo} 
                  pagosRealizados={pagos} 
                  nombreCliente={cliente.nombre} 
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Formulario de pago */}
          <PaymentForm 
            open={paymentFormOpen} 
            onOpenChange={setPaymentFormOpen} 
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}`] });
              queryClient.invalidateQueries({ queryKey: ['/api/pagos', { prestamo_id: prestamoId }] });
              queryClient.invalidateQueries({ queryKey: [`/api/prestamos/${prestamoId}/total-pagado`] });
            }} 
          />
          
          {/* Dialog para editar un pago */}
          <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Pago</DialogTitle>
                <DialogDescription>
                  Modifique el monto pagado para la semana {selectedPago?.numero_semana || ""}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="monto-pagado" className="text-right">
                    Monto Pagado
                  </Label>
                  <Input
                    id="monto-pagado"
                    type="number"
                    step="0.01"
                    min="0"
                    value={nuevoMontoPagado}
                    onChange={(e) => setNuevoMontoPagado(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setEditPaymentDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUpdatePayment} 
                  disabled={actualizarPagoMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {actualizarPagoMutation.isPending ? (
                    <span className="flex items-center gap-1">
                      <LoadingButton className="h-3 w-3" />
                      <span>Actualizando</span>
                    </span>
                  ) : (
                    "Actualizar Pago"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Dialog para cambiar día de pago */}
          <Dialog open={changeDayDialogOpen} onOpenChange={setChangeDayDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cambiar Día de Pago</DialogTitle>
                <DialogDescription>
                  Seleccione una nueva fecha para reprogramar los pagos.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fecha-pago" className="text-right">
                    Nueva Fecha
                  </Label>
                  <Input
                    id="fecha-pago"
                    type="date"
                    value={nuevaFechaPago}
                    onChange={(e) => setNuevaFechaPago(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setChangeDayDialogOpen(false)}
                  className="w-full sm:w-auto h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleChangeDaySubmit} 
                  disabled={cambiarDiaPagoMutation.isPending || !nuevaFechaPago}
                  className="w-full sm:w-auto h-8 text-xs"
                >
                  {cambiarDiaPagoMutation.isPending ? (
                    <span className="flex items-center gap-1">
                      <LoadingButton className="h-3 w-3" />
                      <span>Actualizando</span>
                    </span>
                  ) : (
                    "Cambiar Día de Pago"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}