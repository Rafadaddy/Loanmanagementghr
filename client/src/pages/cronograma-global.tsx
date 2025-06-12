import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatTableDate, createConsistentDate, getTodayLocalDate } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente, Cobrador } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Search, Filter, Eye, FileText, FileSpreadsheet, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CronogramaPago = {
  prestamo_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  semana: number;
  fecha_pago: string;
  monto_pago: number;
  estado_pago: 'PENDIENTE' | 'PAGADO' | 'ATRASADO';
  monto_prestado: number;
  fecha_inicio: string;
  total_semanas: number;
};

export default function CronogramaGlobal() {
  const [filterDate, setFilterDate] = useState(() => {
    return getTodayLocalDate();
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [cobradorFilter, setCobradorFilter] = useState("todos");
  const { toast } = useToast();

  // Obtener préstamos activos
  const { data: prestamos = [], isLoading: isLoadingPrestamos } = useQuery<Prestamo[]>({
    queryKey: ["/api/prestamos"],
  });

  // Obtener clientes
  const { data: clientes = [], isLoading: isLoadingClientes } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  // Obtener cobradores
  const { data: cobradores = [], isLoading: isLoadingCobradores } = useQuery<Cobrador[]>({
    queryKey: ["/api/cobradores"],
  });

  const isLoading = isLoadingPrestamos || isLoadingClientes || isLoadingCobradores;

  // Generar cronograma completo de todos los préstamos
  const cronogramaCompleto: CronogramaPago[] = prestamos
    .filter(prestamo => {
      const esActivo = prestamo.estado === "ACTIVO";
      if (!esActivo) {
        console.log(`Préstamo ${prestamo.id} excluido - Estado: ${prestamo.estado}`);
      }
      return esActivo;
    })
    .flatMap(prestamo => {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      if (!cliente) {
        console.warn(`Cliente no encontrado para préstamo ${prestamo.id}, cliente_id: ${prestamo.cliente_id}`);
        return [];
      }

      const cronogramaPrestamo: CronogramaPago[] = [];
      
      // Determinar la fecha de la primera cuota, considerando fechas personalizadas
      let primeraFechaPago: Date;
      const semanasYaPagadas = prestamo.semanas_pagadas || 0;
      
      if (prestamo.fecha_inicial_personalizada) {
        // Si hay una fecha inicial personalizada, la usamos
        primeraFechaPago = new Date(prestamo.fecha_inicial_personalizada);
      } else if (semanasYaPagadas === 0) {
        // Si no hay semanas pagadas, la primera fecha es 7 días después del préstamo
        primeraFechaPago = new Date(prestamo.fecha_prestamo);
        primeraFechaPago.setDate(primeraFechaPago.getDate() + 7);
      } else {
        // Si hay semanas pagadas, calculamos la primera fecha a partir de la próxima fecha de pago
        primeraFechaPago = new Date(prestamo.proxima_fecha_pago);
        primeraFechaPago.setDate(primeraFechaPago.getDate() - (semanasYaPagadas * 7));
      }

      for (let semana = 1; semana <= prestamo.numero_semanas; semana++) {
        // Calcular fecha de pago basada en la primera fecha + incrementos semanales
        const fechaPago = new Date(primeraFechaPago);
        fechaPago.setDate(primeraFechaPago.getDate() + (semana - 1) * 7);
        
        // Determinar estado del pago
        let estadoPago: 'PENDIENTE' | 'PAGADO' | 'ATRASADO' = 'PENDIENTE';
        if (semana <= (prestamo.semanas_pagadas || 0)) {
          estadoPago = 'PAGADO';
        } else if (fechaPago < new Date()) {
          estadoPago = 'ATRASADO';
        }

        cronogramaPrestamo.push({
          prestamo_id: prestamo.id,
          cliente_id: cliente.id,
          cliente_nombre: cliente.nombre,
          cliente_telefono: cliente.telefono,
          cliente_direccion: cliente.direccion,
          semana: semana,
          fecha_pago: fechaPago.toISOString().split('T')[0],
          monto_pago: parseFloat(prestamo.pago_semanal),
          estado_pago: estadoPago,
          monto_prestado: parseFloat(prestamo.monto_prestado),
          fecha_inicio: prestamo.fecha_prestamo,
          total_semanas: prestamo.numero_semanas
        });
      }

      console.log(`Préstamo ${prestamo.id} - Cliente: ${cliente.nombre} - Generadas ${cronogramaPrestamo.length} cuotas`);
      return cronogramaPrestamo;
    });

  // Agregar estadísticas de debug
  console.log('--- Estadísticas del Cronograma Global ---');
  console.log(`Total préstamos en base: ${prestamos.length}`);
  console.log(`Préstamos activos: ${prestamos.filter(p => p.estado === "ACTIVO").length}`);
  console.log(`Total clientes en base: ${clientes.length}`);
  console.log(`Total cuotas generadas: ${cronogramaCompleto.length}`);
  
  // Verificar si hay préstamos activos sin cronograma
  const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO");
  const prestamosIdsConCronograma = cronogramaCompleto.map(c => c.prestamo_id);
  const prestamosUnicos = prestamosIdsConCronograma.filter((id, index) => prestamosIdsConCronograma.indexOf(id) === index);
  const prestamosSinCronograma = prestamosActivos.filter(p => !prestamosUnicos.includes(p.id));
  
  if (prestamosSinCronograma.length > 0) {
    console.warn(`⚠️ Préstamos activos sin cronograma:`, prestamosSinCronograma.map(p => ({
      id: p.id,
      cliente_id: p.cliente_id,
      monto: p.monto_prestado,
      estado: p.estado,
      semanas: p.numero_semanas
    })));
  }

  // Aplicar filtros con logging detallado
  const cronogramaFiltrado = cronogramaCompleto.filter(pago => {
    // Filtro por fecha
    const coincideFecha = !filterDate || pago.fecha_pago === filterDate;
    
    // Filtro por estado
    const coincifeEstado = statusFilter === "todos" || pago.estado_pago.toLowerCase() === statusFilter;
    
    // Filtro por cobrador
    const cliente = clientes.find(c => c.id === pago.cliente_id);
    const coincideCobrador = cobradorFilter === "todos" || 
      (cliente && cliente.cobrador_id && cliente.cobrador_id.toString() === cobradorFilter);
    
    // Filtro por búsqueda
    const coincideBusqueda = !searchTerm || 
      pago.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.cliente_telefono.includes(searchTerm) ||
      pago.cliente_direccion.toLowerCase().includes(searchTerm.toLowerCase());

    const pasaFiltros = coincideFecha && coincifeEstado && coincideCobrador && coincideBusqueda;
    
    // Debug de filtros aplicados
    if (!pasaFiltros && (filterDate || statusFilter !== "todos" || cobradorFilter !== "todos" || searchTerm)) {
      console.log(`Pago filtrado - Préstamo ${pago.prestamo_id}, Cliente: ${pago.cliente_nombre}`, {
        fecha: { valor: pago.fecha_pago, filtro: filterDate, pasa: coincideFecha },
        estado: { valor: pago.estado_pago, filtro: statusFilter, pasa: coincifeEstado },
        cobrador: { cliente_cobrador_id: cliente?.cobrador_id, filtro: cobradorFilter, pasa: coincideCobrador },
        busqueda: { termino: searchTerm, pasa: coincideBusqueda }
      });
    }

    return pasaFiltros;
  });
  
  // Estadísticas de filtrado
  console.log(`Filtros aplicados - Fecha: ${filterDate}, Estado: ${statusFilter}, Cobrador: ${cobradorFilter}, Búsqueda: "${searchTerm}"`);
  console.log(`Cuotas después del filtrado: ${cronogramaFiltrado.length} de ${cronogramaCompleto.length}`);

  // Ordenar por fecha de pago y luego por nombre del cliente
  const cronogramaOrdenado = cronogramaFiltrado.sort((a, b) => {
    const fechaComparison = a.fecha_pago.localeCompare(b.fecha_pago);
    if (fechaComparison !== 0) return fechaComparison;
    return a.cliente_nombre.localeCompare(b.cliente_nombre);
  });

  // Estadísticas
  const totalACobrar = cronogramaFiltrado
    .filter(p => p.estado_pago !== 'PAGADO')
    .reduce((sum, p) => sum + p.monto_pago, 0);

  const pagosPendientes = cronogramaFiltrado.filter(p => p.estado_pago === 'PENDIENTE').length;
  const pagosAtrasados = cronogramaFiltrado.filter(p => p.estado_pago === 'ATRASADO').length;
  const pagosPagados = cronogramaFiltrado.filter(p => p.estado_pago === 'PAGADO').length;

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Pagado</Badge>;
      case 'ATRASADO':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Atrasado</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Pendiente</Badge>;
    }
  };

  // Función para generar reporte PDF
  const handleDownloadPDF = async () => {
    try {
      if (cronogramaOrdenado.length === 0) {
        toast({
          title: "No hay datos para exportar",
          description: "No hay pagos con los filtros aplicados.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generando PDF",
        description: "El reporte de cronograma se está generando...",
      });

      // Crear contenido HTML para el PDF
      const filtrosAplicados = [];
      if (filterDate) filtrosAplicados.push(`Fecha: ${formatTableDate(filterDate)}`);
      if (statusFilter !== "todos") filtrosAplicados.push(`Estado: ${statusFilter.toUpperCase()}`);
      if (cobradorFilter !== "todos") {
        const cobrador = cobradores.find(c => c.id.toString() === cobradorFilter);
        filtrosAplicados.push(`Cobrador: ${cobrador?.nombre || 'Desconocido'}`);
      }

      // Crear tabla HTML
      const tablaHTML = `
        <html>
          <head>
            <meta charset="utf-8">
            <title>Cronograma Global de Pagos</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; text-align: center; }
              .filtros { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
              .resumen { background: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
              th { background-color: #2969b0; color: white; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .pendiente { background-color: #cce5ff; }
              .atrasado { background-color: #ffcccc; }
              .pagado { background-color: #ccffcc; }
            </style>
          </head>
          <body>
            <h1>Cronograma Global de Pagos</h1>
            ${filtrosAplicados.length > 0 ? `<div class="filtros"><strong>Filtros aplicados:</strong> ${filtrosAplicados.join(' | ')}</div>` : ''}
            <div class="resumen">
              <strong>Resumen:</strong> Total a cobrar: ${formatCurrency(totalACobrar)} | 
              Pendientes: ${pagosPendientes} | Atrasados: ${pagosAtrasados} | Pagados: ${pagosPagados}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Fecha Pago</th>
                  <th>Semana</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Préstamo</th>
                </tr>
              </thead>
              <tbody>
                ${cronogramaOrdenado.map(pago => `
                  <tr class="${pago.estado_pago.toLowerCase()}">
                    <td>${pago.cliente_nombre}</td>
                    <td>${pago.cliente_telefono}</td>
                    <td>${formatTableDate(pago.fecha_pago)}</td>
                    <td>${pago.semana}/${pago.total_semanas}</td>
                    <td>${formatCurrency(pago.monto_pago)}</td>
                    <td>${pago.estado_pago}</td>
                    <td>${formatCurrency(pago.monto_prestado)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #666;">
              Reporte generado el ${formatTableDate(new Date().toISOString().split('T')[0])}
            </div>
          </body>
        </html>
      `;

      // Abrir ventana de impresión
      const ventana = window.open('', '_blank');
      if (ventana) {
        ventana.document.write(tablaHTML);
        ventana.document.close();
        
        // Esperar a que se cargue y luego imprimir
        ventana.onload = () => {
          ventana.print();
        };
        
        toast({
          title: "PDF generado",
          description: "Se abrió la ventana de impresión. Guarda como PDF desde ahí.",
        });
      } else {
        throw new Error("No se pudo abrir la ventana de impresión");
      }
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error al generar el reporte. Revisa que no estén bloqueadas las ventanas emergentes.",
        variant: "destructive",
      });
    }
  };

  // Función para generar reporte Excel
  const handleDownloadExcel = async () => {
    try {
      if (cronogramaOrdenado.length === 0) {
        toast({
          title: "No hay datos para exportar",
          description: "No hay pagos con los filtros aplicados.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generando Excel",
        description: "El reporte de cronograma se está generando...",
      });

      // Preparar datos para CSV (como alternativa simple)
      const csvHeader = "Cliente,Teléfono,Dirección,Cobrador,Fecha de Pago,Semana,Total Semanas,Monto a Pagar,Estado,Monto Préstamo,Fecha Inicio\n";
      
      const csvData = cronogramaOrdenado.map(pago => {
        const cliente = clientes.find(c => c.id === pago.cliente_id);
        const cobrador = cliente?.cobrador_id ? 
          cobradores.find(c => c.id === cliente.cobrador_id) : null;
        
        return [
          `"${pago.cliente_nombre}"`,
          `"${pago.cliente_telefono}"`,
          `"${pago.cliente_direccion}"`,
          `"${cobrador?.nombre || 'Sin asignar'}"`,
          `"${formatTableDate(pago.fecha_pago)}"`,
          pago.semana,
          pago.total_semanas,
          pago.monto_pago,
          `"${pago.estado_pago}"`,
          pago.monto_prestado,
          `"${formatTableDate(pago.fecha_inicio)}"`
        ].join(',');
      }).join('\n');

      const csvContent = csvHeader + csvData;

      // Crear archivo CSV
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      const fechaReporte = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `cronograma_global_${fechaReporte}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Archivo CSV generado",
        description: "El reporte de cronograma ha sido descargado como archivo CSV.",
      });
    } catch (error) {
      console.error("Error al generar CSV:", error);
      toast({
        title: "Error al generar reporte",
        description: "Ocurrió un error al generar el reporte.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Cronograma Global de Pagos</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Todos los pagos programados de todos los préstamos activos
          </p>
        </div>
        
        <div className="flex gap-2 mt-2 md:mt-0">
          <Button 
            variant="default"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white"
            onClick={handleDownloadPDF}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Total a Cobrar</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-emerald-600">{formatCurrency(totalACobrar)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-blue-600">{pagosPendientes}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Atrasados</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-red-600">{pagosAtrasados}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Pagados</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-green-600">{pagosPagados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar cliente, teléfono, dirección..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            className="pl-8"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="pagado">Pagados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={cobradorFilter} onValueChange={setCobradorFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Cobrador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los cobradores</SelectItem>
            {cobradores.map((cobrador) => (
              <SelectItem key={cobrador.id} value={cobrador.id.toString()}>
                {cobrador.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => {
            setFilterDate("");
            setSearchTerm("");
            setStatusFilter("todos");
            setCobradorFilter("todos");
          }}
        >
          Limpiar filtros
        </Button>
      </div>

      {/* Tabla de cronograma */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center">Cargando cronograma...</div>
          ) : cronogramaOrdenado.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No se encontraron pagos con los filtros aplicados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Fecha Pago</TableHead>
                    <TableHead>Semana</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Préstamo</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronogramaOrdenado.map((pago, index) => (
                    <TableRow key={`${pago.prestamo_id}-${pago.semana}`}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{pago.cliente_nombre}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {pago.cliente_direccion}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`tel:${pago.cliente_telefono}`}
                          className="text-blue-600 hover:underline"
                        >
                          {pago.cliente_telefono}
                        </a>
                      </TableCell>
                      <TableCell>{formatTableDate(pago.fecha_pago)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {pago.semana}/{pago.total_semanas}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(pago.monto_pago)}
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(pago.estado_pago)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatCurrency(pago.monto_prestado)}</div>
                          <div className="text-xs text-muted-foreground">
                            Inicio: {formatTableDate(pago.fecha_inicio)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/loans/${pago.prestamo_id}`}>
                            <Eye className="h-4 w-4" />
                          </a>
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

      <div className="mt-4 text-sm text-muted-foreground">
        Mostrando {cronogramaOrdenado.length} pagos de {cronogramaCompleto.length} total
      </div>
    </MainLayout>
  );
}
