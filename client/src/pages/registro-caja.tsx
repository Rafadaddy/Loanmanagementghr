import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { MovimientoCaja } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingData } from "@/components/ui/loading";
import { formatCurrency, getDateTimeFormat } from "@/lib/utils";
// Importación del formulario
import RegistroMovimientoForm from "../components/forms/registro-movimiento-form";

export default function RegistroCaja() {
  const { toast } = useToast();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoCaja | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>(new Date());
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>(new Date());
  const [isRangeSelector, setIsRangeSelector] = useState(false);

  // Obtener todos los movimientos de caja
  const { data: movimientos, isLoading, refetch } = useQuery({
    queryKey: ['/api/caja/movimientos'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/caja/movimientos");
      return res.json();
    }
  });

  // Obtener el resumen de caja (saldo, ingresos, egresos)
  const { data: resumenCaja, isLoading: isLoadingResumen } = useQuery({
    queryKey: ['/api/caja/resumen'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/caja/resumen");
      return res.json();
    }
  });

  // Mutación para eliminar un movimiento
  const eliminarMovimientoMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/caja/movimientos/${id}`);
      if (!res.ok) throw new Error("Error al eliminar el movimiento");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Movimiento eliminado",
        description: "El movimiento ha sido eliminado correctamente",
        variant: "default",
      });
      
      // Refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/caja/movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/caja/resumen'] });
      
      setDeleteDialogOpen(false);
      setSelectedMovimiento(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filtrar movimientos por fecha seleccionada
  const movimientosFiltrados = movimientos ? 
    (isRangeSelector && dateRangeStart && dateRangeEnd ? 
      // Filtrar por rango de fechas
      movimientos.filter((mov: MovimientoCaja) => {
        const fechaMovimiento = new Date(mov.fecha);
        return fechaMovimiento >= dateRangeStart && fechaMovimiento <= dateRangeEnd;
      })
      : 
      // Filtrar por día específico
      movimientos.filter((mov: MovimientoCaja) => {
        if (!selectedDate) return true;
        const fechaMovimiento = new Date(mov.fecha);
        return fechaMovimiento.toDateString() === selectedDate.toDateString();
      })
    ) 
    : [];

  const handleFormSuccess = () => {
    refetch();
    setFormDialogOpen(false);
  };

  const promptDelete = (movimiento: MovimientoCaja) => {
    setSelectedMovimiento(movimiento);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (selectedMovimiento) {
      eliminarMovimientoMutation.mutate(selectedMovimiento.id);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-4 mt-16 md:mt-0">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Registro de Caja</h1>
          <p className="text-sm text-gray-600">Administra los ingresos y egresos de la caja</p>
        </header>
        
        <div className="mb-6">
          <Button 
            onClick={() => setFormDialogOpen(true)}
            className="float-right"
          >
            <i className="fas fa-plus mr-2"></i>
            Registrar Movimiento
          </Button>
        </div>

        {/* Resumen de caja */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
              <i className="fas fa-cash-register text-muted-foreground"></i>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingResumen ? (
                  <LoadingData text="Calculando..." />
                ) : (
                  formatCurrency(resumenCaja?.saldo_actual || 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Balance actual en caja
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <i className="fas fa-arrow-up text-green-500"></i>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {isLoadingResumen ? (
                  <LoadingData text="Calculando..." />
                ) : (
                  formatCurrency(resumenCaja?.total_ingresos || 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de ingresos registrados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Egresos Totales</CardTitle>
              <i className="fas fa-arrow-down text-red-500"></i>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {isLoadingResumen ? (
                  <LoadingData text="Calculando..." />
                ) : (
                  formatCurrency(resumenCaja?.total_egresos || 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de egresos registrados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro por fecha */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtrar por Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue="dia" 
              onValueChange={(value) => setIsRangeSelector(value === "rango")}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="dia">Por Día</TabsTrigger>
                <TabsTrigger value="rango">Por Rango</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dia" className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-full sm:w-auto">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                          {selectedDate ? (
                            format(selectedDate, 'PPP', { locale: es })
                          ) : (
                            <span>Seleccione fecha</span>
                          )}
                          <i className="fas fa-calendar-alt ml-2"></i>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Hoy
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="rango" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="block text-sm mb-2">Fecha Inicial:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {dateRangeStart ? (
                            format(dateRangeStart, 'PPP', { locale: es })
                          ) : (
                            <span>Seleccione fecha inicial</span>
                          )}
                          <i className="fas fa-calendar-alt ml-2"></i>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRangeStart}
                          onSelect={setDateRangeStart}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <span className="block text-sm mb-2">Fecha Final:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {dateRangeEnd ? (
                            format(dateRangeEnd, 'PPP', { locale: es })
                          ) : (
                            <span>Seleccione fecha final</span>
                          )}
                          <i className="fas fa-calendar-alt ml-2"></i>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRangeEnd}
                          onSelect={setDateRangeEnd}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Tabla de movimientos */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de Caja</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingData />
            ) : movimientosFiltrados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No hay movimientos para mostrar en esta fecha
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    {isRangeSelector 
                      ? `Movimientos desde ${format(dateRangeStart!, 'PPP', { locale: es })} hasta ${format(dateRangeEnd!, 'PPP', { locale: es })}`
                      : `Movimientos del ${format(selectedDate!, 'PPP', { locale: es })}`
                    }
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosFiltrados.map((movimiento: MovimientoCaja) => (
                      <TableRow key={movimiento.id}>
                        <TableCell>
                          {getDateTimeFormat(movimiento.fecha)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={movimiento.tipo === "INGRESO" ? "success" : "destructive"}
                            className="whitespace-nowrap"
                          >
                            {movimiento.tipo === "INGRESO" ? 
                              <><i className="fas fa-arrow-up mr-1"></i> Ingreso</> : 
                              <><i className="fas fa-arrow-down mr-1"></i> Egreso</>
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {movimiento.categoria}
                        </TableCell>
                        <TableCell>
                          {movimiento.descripcion || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={movimiento.tipo === "INGRESO" ? "text-green-600" : "text-red-600"}>
                            {formatCurrency(Number(movimiento.monto))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="destructive"
                            size="sm"
                            onClick={() => promptDelete(movimiento)}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal para confirmar eliminación */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente el movimiento de caja.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {eliminarMovimientoMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Eliminando...
                  </>
                ) : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Formulario para registrar movimiento */}
        <RegistroMovimientoForm 
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          onSuccess={handleFormSuccess}
        />
      </main>
    </div>
  );
}