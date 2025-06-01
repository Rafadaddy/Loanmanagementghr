import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatTableDate, createConsistentDate } from "@/lib/utils";
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
    const today = new Date();
    return today.toISOString().split('T')[0];
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
    .filter(prestamo => prestamo.estado === "ACTIVO")
    .flatMap(prestamo => {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      if (!cliente) return [];

      const fechaInicio = new Date(prestamo.fecha_prestamo);
      const cronogramaPrestamo: CronogramaPago[] = [];

      for (let semana = 1; semana <= prestamo.numero_semanas; semana++) {
        // Calcular fecha de pago: fecha_inicio + (semana-1) * 7 días
        const fechaPago = new Date(fechaInicio);
        fechaPago.setDate(fechaPago.getDate() + (semana - 1) * 7);
        
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

      return cronogramaPrestamo;
    });

  // Aplicar filtros
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

    return coincideFecha && coincifeEstado && coincideCobrador && coincideBusqueda;
  });

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

      // Importar jsPDF dinámicamente
      const jsPDF = (await import('jspdf')).default;
      require('jspdf-autotable');

      const doc = new jsPDF();
      
      // Título del reporte
      doc.setFontSize(16);
      doc.text('Cronograma Global de Pagos', 14, 22);
      
      // Información de filtros aplicados
      doc.setFontSize(10);
      let yPos = 35;
      if (filterDate) {
        doc.text(`Fecha: ${formatTableDate(filterDate)}`, 14, yPos);
        yPos += 6;
      }
      if (statusFilter !== "todos") {
        doc.text(`Estado: ${statusFilter.toUpperCase()}`, 14, yPos);
        yPos += 6;
      }
      if (cobradorFilter !== "todos") {
        const cobrador = cobradores.find(c => c.id.toString() === cobradorFilter);
        doc.text(`Cobrador: ${cobrador?.nombre || 'Desconocido'}`, 14, yPos);
        yPos += 6;
      }
      
      // Resumen
      doc.text(`Total a cobrar: ${formatCurrency(totalACobrar)}`, 14, yPos);
      yPos += 6;
      doc.text(`Pagos: ${pagosPendientes} pendientes, ${pagosAtrasados} atrasados, ${pagosPagados} pagados`, 14, yPos);
      yPos += 10;

      // Preparar datos para la tabla
      const tableData = cronogramaOrdenado.map(pago => [
        pago.cliente_nombre,
        pago.cliente_telefono,
        formatTableDate(pago.fecha_pago),
        `${pago.semana}/${pago.total_semanas}`,
        formatCurrency(pago.monto_pago),
        pago.estado_pago,
        formatCurrency(pago.monto_prestado)
      ]);

      // Generar tabla
      (doc as any).autoTable({
        startY: yPos,
        head: [['Cliente', 'Teléfono', 'Fecha Pago', 'Semana', 'Monto', 'Estado', 'Préstamo']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 105, 176],
          textColor: 255,
        },
        margin: { left: 14 },
        tableWidth: 'auto'
      });

      // Guardar el PDF
      const fechaReporte = new Date().toISOString().split('T')[0];
      doc.save(`cronograma_global_${fechaReporte}.pdf`);
      
      toast({
        title: "PDF generado",
        description: "El reporte de cronograma ha sido descargado exitosamente.",
      });
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error al generar el reporte.",
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

      // Importar XLSX dinámicamente
      const XLSX = await import('xlsx');
      
      // Preparar datos para Excel
      const excelData = cronogramaOrdenado.map(pago => {
        const cliente = clientes.find(c => c.id === pago.cliente_id);
        const cobrador = cliente?.cobrador_id ? 
          cobradores.find(c => c.id === cliente.cobrador_id) : null;
        
        return {
          'Cliente': pago.cliente_nombre,
          'Teléfono': pago.cliente_telefono,
          'Dirección': pago.cliente_direccion,
          'Cobrador': cobrador?.nombre || 'Sin asignar',
          'Fecha de Pago': formatTableDate(pago.fecha_pago),
          'Semana': pago.semana,
          'Total Semanas': pago.total_semanas,
          'Monto a Pagar': pago.monto_pago,
          'Estado': pago.estado_pago,
          'Monto Préstamo': pago.monto_prestado,
          'Fecha Inicio': formatTableDate(pago.fecha_inicio),
        };
      });

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Ajustar anchos de columna
      const colWidths = [
        { wch: 20 }, // Cliente
        { wch: 15 }, // Teléfono
        { wch: 25 }, // Dirección
        { wch: 15 }, // Cobrador
        { wch: 12 }, // Fecha de Pago
        { wch: 8 },  // Semana
        { wch: 8 },  // Total Semanas
        { wch: 12 }, // Monto a Pagar
        { wch: 10 }, // Estado
        { wch: 12 }, // Monto Préstamo
        { wch: 12 }, // Fecha Inicio
      ];
      ws['!cols'] = colWidths;

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Cronograma Global');

      // Crear hoja de resumen
      const resumenData = [
        { 'Concepto': 'Total a Cobrar', 'Valor': formatCurrency(totalACobrar) },
        { 'Concepto': 'Pagos Pendientes', 'Valor': pagosPendientes },
        { 'Concepto': 'Pagos Atrasados', 'Valor': pagosAtrasados },
        { 'Concepto': 'Pagos Realizados', 'Valor': pagosPagados },
        { 'Concepto': 'Total de Pagos', 'Valor': cronogramaOrdenado.length },
        { 'Concepto': 'Fecha del Reporte', 'Valor': formatTableDate(new Date().toISOString().split('T')[0]) },
      ];

      const wsResumen = XLSX.utils.json_to_sheet(resumenData);
      wsResumen['!cols'] = [{ wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      // Descargar archivo
      const fechaReporte = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `cronograma_global_${fechaReporte}.xlsx`);
      
      toast({
        title: "Excel generado",
        description: "El reporte de cronograma ha sido descargado exitosamente.",
      });
    } catch (error) {
      console.error("Error al generar Excel:", error);
      toast({
        title: "Error al generar Excel",
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
