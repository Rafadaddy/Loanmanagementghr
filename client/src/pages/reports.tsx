import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getLoanStatus, getPaymentStatus } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente, Pago } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";
import { Download } from "lucide-react";

export default function Reports() {
  const [reportType, setReportType] = useState("prestamos");
  const [periodoTiempo, setPeriodoTiempo] = useState("todo");

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
        
        <Button 
          className="mt-4 md:mt-0 bg-primary hover:bg-blue-600"
          onClick={exportarCSV}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Reporte
        </Button>
      </div>
      
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