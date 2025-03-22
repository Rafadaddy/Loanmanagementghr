import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/hooks/use-loading";
import { LoadingData } from "@/components/ui/loading";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MovimientoCaja } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";

// Este componente se usará para crear nuevos formularios de movimientos
import MovimientoCajaForm from "../components/forms/movimiento-caja-form";

// Página principal de la caja (cash register)
export default function Caja() {
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [openMovimientoForm, setOpenMovimientoForm] = useState(false);
  const [selectedTab, setSelectedTab] = useState("todos");
  const [filteredMovimientos, setFilteredMovimientos] = useState<MovimientoCaja[]>([]);
  const [movimientoToDelete, setMovimientoToDelete] = useState<MovimientoCaja | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Consulta para obtener los movimientos de caja
  const { 
    data: movimientos = [], 
    isLoading: isLoadingMovimientos, 
    isError: isErrorMovimientos,
    error: errorMovimientos,
  } = useQuery<MovimientoCaja[]>({
    queryKey: ["/api/caja/movimientos"],
    retry: 1,
  });
  
  // Consulta para obtener el resumen de caja
  const { 
    data: resumenCaja, 
    isLoading: isLoadingResumen,
    isError: isErrorResumen,
    error: errorResumen,
  } = useQuery<{
    saldo_actual: number;
    total_ingresos: number;
    total_egresos: number;
    movimientos_por_dia: { fecha: string; ingreso: number; egreso: number }[];
  }>({
    queryKey: ["/api/caja/resumen"],
    retry: 1,
  });
  
  // Mutación para eliminar un movimiento
  const eliminarMovimientoMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/caja/movimientos/${id}`);
    },
    onMutate: () => {
      startLoading("Eliminando movimiento...");
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Movimiento eliminado correctamente",
      });
      
      // Invalidar consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["/api/caja/movimientos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/caja/resumen"] });
      setMovimientoToDelete(null);
      setShowDeleteConfirm(false);
      
      // Detener el indicador de carga
      stopLoading();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al eliminar el movimiento: ${error.message}`,
        variant: "destructive",
      });
      stopLoading();
    },
  });
  
  // Filtrar movimientos basados en la pestaña seleccionada y el término de búsqueda
  useEffect(() => {
    if (movimientos.length === 0) return;
    
    let filtered = [...movimientos];
    
    // Filtrar por tipo (ingreso/egreso)
    if (selectedTab === "ingresos") {
      filtered = filtered.filter(m => m.tipo === "INGRESO");
    } else if (selectedTab === "egresos") {
      filtered = filtered.filter(m => m.tipo === "EGRESO");
    }
    
    // Aplicar búsqueda por término si existe
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.categoria.toLowerCase().includes(term) || 
        (m.descripcion && m.descripcion.toLowerCase().includes(term))
      );
    }
    
    // Ordenar por fecha (más recientes primero)
    filtered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    setFilteredMovimientos(filtered);
  }, [movimientos, selectedTab, searchTerm]);
  
  // Manejar la confirmación de eliminación
  const handleDeleteConfirm = () => {
    if (movimientoToDelete) {
      eliminarMovimientoMutation.mutate(movimientoToDelete.id);
    }
  };
  
  // Mostrar diálogo de confirmación de eliminación
  const promptDelete = (movimiento: MovimientoCaja) => {
    setMovimientoToDelete(movimiento);
    setShowDeleteConfirm(true);
  };
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-4 mt-16 md:mt-0">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Caja</h1>
          <p className="text-sm text-gray-600">Administra los movimientos de caja, ingresos y egresos</p>
        </header>
        
        <div className="mb-6">
          <Button 
            className="float-right"
            onClick={() => setOpenMovimientoForm(true)}
          >
            <i className="fas fa-plus mr-2"></i>
            Nuevo Movimiento
          </Button>
        </div>
        
        {/* Resumen de Caja */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingResumen ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
              ) : (
                <div className="text-2xl font-bold text-primary">
                  {resumenCaja ? formatCurrency(resumenCaja.saldo_actual) : "$0.00"}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingResumen ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
              ) : (
                <div className="text-2xl font-bold text-green-500">
                  {resumenCaja ? formatCurrency(resumenCaja.total_ingresos) : "$0.00"}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Egresos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingResumen ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
              ) : (
                <div className="text-2xl font-bold text-red-500">
                  {resumenCaja ? formatCurrency(resumenCaja.total_egresos) : "$0.00"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Filtros y búsqueda */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <Tabs defaultValue="todos" className="w-full" value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
              <TabsTrigger value="egresos">Egresos</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="relative">
              <input
                type="search"
                placeholder="Buscar movimientos..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
          </div>
        </div>
        
        {/* Lista de Movimientos */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle>Movimientos de Caja</CardTitle>
            <CardDescription>
              Registro de todos los ingresos y egresos de la caja
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {isLoadingMovimientos ? (
              <LoadingData />
            ) : isErrorMovimientos ? (
              <div className="text-center p-4 text-red-500">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Error al cargar los movimientos: {errorMovimientos?.message}
              </div>
            ) : filteredMovimientos.length === 0 ? (
              <div className="text-center p-4 text-gray-500">
                <i className="fas fa-info-circle mr-2"></i>
                No hay movimientos registrados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-2 text-left">Fecha</th>
                      <th className="py-3 px-2 text-left">Tipo</th>
                      <th className="py-3 px-2 text-left">Categoría</th>
                      <th className="py-3 px-2 text-left">Descripción</th>
                      <th className="py-3 px-2 text-right">Monto</th>
                      <th className="py-3 px-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovimientos.map((movimiento) => (
                      <tr key={movimiento.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 whitespace-nowrap">
                          {formatDate(movimiento.fecha)}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant={movimiento.tipo === "INGRESO" ? "success" : "destructive" as any}>
                            {movimiento.tipo}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">{movimiento.categoria}</td>
                        <td className="py-3 px-2">{movimiento.descripcion || "-"}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          <span className={movimiento.tipo === "INGRESO" ? "text-green-500" : "text-red-500"}>
                            {formatCurrency(movimiento.monto)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => promptDelete(movimiento)}
                            className="text-red-500 hover:text-red-700 focus:outline-none"
                            title="Eliminar movimiento"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Modal de confirmación para eliminar movimiento */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar este movimiento?
                <div className="mt-2 p-3 bg-gray-100 rounded-md">
                  <p>
                    <span className="font-semibold">Fecha:</span>{" "}
                    {movimientoToDelete && formatDate(movimientoToDelete.fecha)}
                  </p>
                  <p>
                    <span className="font-semibold">Tipo:</span>{" "}
                    {movimientoToDelete?.tipo}
                  </p>
                  <p>
                    <span className="font-semibold">Categoría:</span>{" "}
                    {movimientoToDelete?.categoria}
                  </p>
                  <p>
                    <span className="font-semibold">Monto:</span>{" "}
                    {movimientoToDelete && formatCurrency(movimientoToDelete.monto)}
                  </p>
                </div>
                <p className="mt-2 text-red-500">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm} 
                className="bg-red-500 hover:bg-red-600"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Formulario para crear nuevo movimiento de caja */}
        <MovimientoCajaForm 
          open={openMovimientoForm} 
          onOpenChange={setOpenMovimientoForm} 
          onSuccess={() => {
            // Invalidar consultas para actualizar los datos
            queryClient.invalidateQueries({ queryKey: ["/api/caja/movimientos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/caja/resumen"] });
            
            // Mostrar mensaje de éxito
            toast({
              title: "Éxito",
              description: "Movimiento registrado correctamente",
            });
          }}
        />
      </main>
    </div>
  );
}