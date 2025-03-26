import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getLoanStatus, getPaymentStatus } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente, Pago, Cobrador } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { 
  Download, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  FileText,
  Users,
  CreditCard,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Activity
} from "lucide-react";

interface Estadisticas {
  prestamosActivos: number;
  totalPrestado: number;
  totalIntereses: number;
  interesesPorCobrar: number;
  montosPagosHoy: number;
  prestamosAtrasados: number;
  totalMoras: number;
  ultimosPrestamos: Prestamo[];
  ultimosPagos: Pago[];
  ultimosClientes: Cliente[];
}

export default function Reports() {
  const [reportType, setReportType] = useState("prestamos");
  const [periodoTiempo, setPeriodoTiempo] = useState("todo");
  const [vista, setVista] = useState("general");

  // Cargar datos
  const { data: prestamos = [] } = useQuery<Prestamo[]>({
    queryKey: ['/api/prestamos'],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  const { data: pagos = [] } = useQuery<Pago[]>({
    queryKey: ['/api/pagos'],
  });

  // Filtrar datos por período de tiempo
  const filtrarPorPeriodo = (fecha: Date | string) => {
    const fechaObj = new Date(fecha);
    const hoy = new Date();
    
    switch (periodoTiempo) {
      case "semana":
        // Últimos 7 días
        const unaSemanaAtras = new Date();
        unaSemanaAtras.setDate(hoy.getDate() - 7);
        return fechaObj >= unaSemanaAtras;
      case "mes":
        // Último mes
        const unMesAtras = new Date();
        unMesAtras.setMonth(hoy.getMonth() - 1);
        return fechaObj >= unMesAtras;
      case "trimestre":
        // Últimos 3 meses
        const tresMesesAtras = new Date();
        tresMesesAtras.setMonth(hoy.getMonth() - 3);
        return fechaObj >= tresMesesAtras;
      case "todo":
      default:
        return true;
    }
  };

  // Filtrar préstamos por período
  const prestamosFiltrados = prestamos.filter(prestamo => 
    filtrarPorPeriodo(prestamo.fecha_prestamo)
  );

  // Filtrar pagos por período
  const pagosFiltrados = pagos.filter(pago => 
    filtrarPorPeriodo(pago.fecha_pago)
  );

  // Preparar datos para gráficos
  const datosPrestamosEstado = [
    { name: "Activos", value: prestamos.filter(p => p.estado === "ACTIVO").length },
    { name: "Pagados", value: prestamos.filter(p => p.estado === "PAGADO").length },
    { name: "Atrasados", value: prestamos.filter(p => p.estado === "ATRASADO").length },
  ];

  const COLORS = ["#3B82F6", "#10B981", "#EF4444"];

  // Datos para gráfico de barras de montos
  const montosPorMes = () => {
    const meses: Record<string, { prestamos: number; pagos: number }> = {};
    
    // Inicializar últimos 6 meses
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(hoy.getMonth() - i);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      meses[mesKey] = { prestamos: 0, pagos: 0 };
    }
    
    // Sumar préstamos por mes
    prestamos.forEach(prestamo => {
      const fecha = new Date(prestamo.fecha_prestamo);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      if (meses[mesKey]) {
        meses[mesKey].prestamos += Number(prestamo.monto_prestado);
      }
    });
    
    // Sumar pagos por mes
    pagos.forEach(pago => {
      const fecha = new Date(pago.fecha_pago);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      if (meses[mesKey]) {
        meses[mesKey].pagos += Number(pago.monto_pagado);
      }
    });
    
    // Convertir a array para gráfico
    return Object.entries(meses).map(([mes, datos]) => ({
      mes,
      prestamos: datos.prestamos,
      pagos: datos.pagos,
    }));
  };

  // Función para exportar reporte a CSV
  const exportarCSV = () => {
    let data: any[] = [];
    let filename = "reporte";
    let headers: string[] = [];
    
    if (reportType === "prestamos") {
      data = prestamosFiltrados.map(prestamo => {
        const cliente = clientes.find(c => c.id === prestamo.cliente_id);
        return {
          id: prestamo.id,
          cliente: cliente?.nombre || "Desconocido",
          monto: prestamo.monto_prestado,
          interes: prestamo.tasa_interes,
          fecha: formatDate(prestamo.fecha_prestamo),
          semanas: prestamo.numero_semanas,
          estado: prestamo.estado,
        };
      });
      filename = "reporte_prestamos";
      headers = ["ID", "Cliente", "Monto", "Interés", "Fecha", "Semanas", "Estado"];
    } else if (reportType === "pagos") {
      data = pagosFiltrados.map(pago => {
        const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
        const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
        return {
          id: pago.id,
          cliente: cliente?.nombre || "Desconocido",
          prestamo_id: pago.prestamo_id,
          monto: pago.monto_pagado,
          fecha: formatDate(pago.fecha_pago),
          semana: pago.numero_semana,
          estado: pago.estado,
        };
      });
      filename = "reporte_pagos";
      headers = ["ID", "Cliente", "Préstamo ID", "Monto", "Fecha", "Semana", "Estado"];
    }
    
    // Generar CSV
    const csvContent = [
      headers.join(","),
      ...data.map(item => Object.values(item).join(","))
    ].join("\n");
    
    // Crear blob y enlace de descarga
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis y estadísticas del sistema</p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <Select 
            value={vista}
            onValueChange={setVista}
            className="w-40"
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de Análisis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="rentabilidad">Rentabilidad</SelectItem>
              <SelectItem value="cobradores">Por Cobrador</SelectItem>
              <SelectItem value="proyeccion">Proyección</SelectItem>
              <SelectItem value="cumplimiento">Cumplimiento</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            className="bg-primary hover:bg-blue-600"
            onClick={exportarCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>
      
      {/* Indicadores clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium">Capital prestado</p>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {formatCurrency(prestamos.reduce((sum, p) => sum + Number(p.monto_prestado), 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {prestamos.length} préstamos totales
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950 p-4 sm:p-6 flex items-center justify-center h-full">
                <TrendingUp className="h-10 w-10 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <p className="text-sm font-medium">Intereses generados</p>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {formatCurrency(prestamos.reduce((sum, p) => {
                    const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
                    return sum + interes;
                  }, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(pagos.reduce((sum, p) => sum + Number(p.monto_pagado), 0))} cobrado
                </p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950 p-4 sm:p-6 flex items-center justify-center h-full">
                <CreditCard className="h-10 w-10 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-medium">Préstamos activos</p>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {prestamos.filter(p => p.estado === "ACTIVO").length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {prestamos.filter(p => p.estado === "ATRASADO").length} atrasados
                </p>
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-950 p-4 sm:p-6 flex items-center justify-center h-full">
                <FileText className="h-10 w-10 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <p className="text-sm font-medium">Clientes activos</p>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {new Set(prestamos.filter(p => p.estado === "ACTIVO" || p.estado === "ATRASADO").map(p => p.cliente_id)).size}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  De {clientes.length} clientes totales
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-950 p-4 sm:p-6 flex items-center justify-center h-full">
                <BarChart3 className="h-10 w-10 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {vista === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="md:col-span-3">
            <CardHeader className="pb-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <CardTitle>Reporte de {reportType === "prestamos" ? "Préstamos" : "Pagos"}</CardTitle>
                
                <div className="flex items-center gap-2 mt-3 md:mt-0">
                  <Select 
                    defaultValue="todo" 
                    onValueChange={setPeriodoTiempo}
                  >
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Última semana</SelectItem>
                      <SelectItem value="mes">Último mes</SelectItem>
                      <SelectItem value="trimestre">Último trimestre</SelectItem>
                      <SelectItem value="todo">Todo el tiempo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          <CardContent>
            <Tabs defaultValue="grafica" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="grafica">Gráfica</TabsTrigger>
                <TabsTrigger value="tabla">Tabla</TabsTrigger>
              </TabsList>
              
              <TabsContent value="grafica">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={montosPorMes()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" stroke="currentColor" />
                      <YAxis stroke="currentColor" />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value as number)}
                        contentStyle={{ 
                          backgroundColor: 'var(--background)', 
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)'
                        }}
                        labelStyle={{ color: 'var(--foreground)' }}
                      />
                      <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
                      <Bar dataKey="prestamos" name="Préstamos" fill="#3B82F6" />
                      <Bar dataKey="pagos" name="Pagos" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              
              <TabsContent value="tabla">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {reportType === "prestamos" ? (
                          <>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Interés</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Semanas</TableHead>
                            <TableHead>Estado</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Préstamo</TableHead>
                            <TableHead>Monto Pagado</TableHead>
                            <TableHead>Fecha Pago</TableHead>
                            <TableHead>Semana</TableHead>
                            <TableHead>Estado</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportType === "prestamos" ? (
                        prestamosFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">No hay préstamos en este periodo</TableCell>
                          </TableRow>
                        ) : (
                          prestamosFiltrados.map(prestamo => {
                            const cliente = clientes.find(c => c.id === prestamo.cliente_id);
                            const { label, className } = getLoanStatus(prestamo.estado);
                            
                            return (
                              <TableRow key={prestamo.id}>
                                <TableCell className="font-medium">{cliente?.nombre || 'Cliente desconocido'}</TableCell>
                                <TableCell>{formatCurrency(prestamo.monto_prestado)}</TableCell>
                                <TableCell>{prestamo.tasa_interes}%</TableCell>
                                <TableCell>{formatDate(prestamo.fecha_prestamo)}</TableCell>
                                <TableCell>{prestamo.semanas_pagadas} / {prestamo.numero_semanas}</TableCell>
                                <TableCell>
                                  <Badge className={className}>{label}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      ) : (
                        pagosFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">No hay pagos en este periodo</TableCell>
                          </TableRow>
                        ) : (
                          pagosFiltrados.map(pago => {
                            const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
                            const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
                            const { label, className } = getPaymentStatus(pago.estado);
                            
                            return (
                              <TableRow key={pago.id}>
                                <TableCell className="font-medium">{cliente?.nombre || 'Cliente desconocido'}</TableCell>
                                <TableCell>{prestamo ? formatCurrency(prestamo.monto_prestado) : 'N/A'}</TableCell>
                                <TableCell className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(pago.monto_pagado)}</TableCell>
                                <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                                <TableCell>{pago.numero_semana}</TableCell>
                                <TableCell>
                                  <Badge className={className}>{label}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tipos de Reportes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant={reportType === "prestamos" ? "default" : "outline"}
                className={`w-full justify-start ${reportType === "prestamos" ? "bg-primary" : ""}`}
                onClick={() => setReportType("prestamos")}
              >
                <i className="fas fa-file-invoice-dollar mr-2"></i>
                Préstamos
              </Button>
              <Button 
                variant={reportType === "pagos" ? "default" : "outline"}
                className={`w-full justify-start ${reportType === "pagos" ? "bg-primary" : ""}`}
                onClick={() => setReportType("pagos")}
              >
                <i className="fas fa-money-bill-wave mr-2"></i>
                Pagos
              </Button>
              
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm font-medium mb-3">Estado de Préstamos</p>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datosPrestamosEstado}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => (
                          <text x={0} y={0} textAnchor="middle" fill="currentColor" style={{ fontWeight: 500 }}>
                            {`${name}: ${(percent * 100).toFixed(0)}%`}
                          </text>
                        )}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {datosPrestamosEstado.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => `${value} préstamos`}
                        contentStyle={{ 
                          backgroundColor: 'var(--background)', 
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}