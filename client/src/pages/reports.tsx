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
import BackupRestoreSection from "@/components/reports/backup-restore";

// Componente de tabla responsiva con scroll horizontal
const ResponsiveTable = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <div className="min-w-[800px] md:min-w-0">
      {children}
    </div>
  </div>
);
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
import { utils, writeFile } from "xlsx";
import { jsPDF } from "jspdf";
import 'jspdf-autotable';

// Extender el tipo de jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Tipo personalizado para los formateadores de tooltips de recharts
type TooltipFormatter = (value: any, name?: string, props?: any) => [string | number, string];

// Función auxiliar para formatear valores en tooltips
const tooltipFormatter: TooltipFormatter = (value, name) => {
  if (typeof value === 'number') {
    return [formatCurrency(value), name || ""];
  }
  return [String(value), name || ""];
};

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

// Función para calcular datos de intereses por préstamo
const datosInteresesPorPrestamo = (prestamos: Prestamo[], clientes: Cliente[], pagos: Pago[]) => {
  return prestamos.map(prestamo => {
    const cliente = clientes.find(c => c.id === prestamo.cliente_id);
    const pagosPrestamo = pagos.filter(p => p.prestamo_id === prestamo.id);
    
    const montoPrestado = Number(prestamo.monto_prestado);
    const montoTotal = Number(prestamo.monto_total_pagar);
    const interesTotal = montoTotal - montoPrestado;
    
    // Calcular interés ya pagado
    const montoPagado = pagosPrestamo.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
    const tasaInteres = Number(prestamo.tasa_interes) / 100;
    const interesYaPagado = pagosPrestamo.reduce((sum, p) => {
      const montoPagoActual = Number(p.monto_pagado);
      // Cálculo simplificado: en cada pago, una porción es interés
      const interesPago = montoPagoActual * tasaInteres / (1 + tasaInteres);
      return sum + interesPago;
    }, 0);
    
    const interesRestante = Math.max(0, interesTotal - interesYaPagado);
    const porcentajeCompletado = montoPrestado > 0 ? (montoPagado / montoTotal) * 100 : 0;
    
    return {
      id: prestamo.id,
      cliente: cliente?.nombre || "Desconocido",
      fecha: prestamo.fecha_prestamo,
      montoPrestado: montoPrestado,
      interesTotal: interesTotal,
      interesYaPagado: interesYaPagado,
      interesRestante: interesRestante,
      porcentajeCompletado: porcentajeCompletado,
      estado: prestamo.estado
    };
  });
};

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

  const { data: cobradores = [] } = useQuery<Cobrador[]>({
    queryKey: ['/api/cobradores'],
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

  // Gráfico de rentabilidad mensual
  const datosRentabilidadMensual = () => {
    const meses: Record<string, { interes: number; capital: number; total: number }> = {};
    
    // Inicializar últimos 6 meses
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(hoy.getMonth() - i);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      meses[mesKey] = { interes: 0, capital: 0, total: 0 };
    }
    
    // Calcular intereses y capital por mes
    pagos.forEach(pago => {
      const fecha = new Date(pago.fecha_pago);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      if (meses[mesKey]) {
        const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
        if (prestamo) {
          const montoPagado = Number(pago.monto_pagado);
          const tasaInteres = Number(prestamo.tasa_interes) / 100;
          const interes = montoPagado * tasaInteres / (1 + tasaInteres);
          const capital = montoPagado - interes;
          
          meses[mesKey].interes += interes;
          meses[mesKey].capital += capital;
          meses[mesKey].total += montoPagado;
        }
      }
    });
    
    // Convertir a array para gráfico
    return Object.entries(meses).map(([mes, datos]) => ({
      mes,
      interes: datos.interes,
      capital: datos.capital,
      total: datos.total,
    }));
  };

  // Datos para gráfico de cobros por cobrador
  const datosPorCobrador = () => {
    const datos = cobradores.map(cobrador => {
      const clientesDeCobrador = clientes.filter(c => c.cobrador_id === cobrador.id);
      const clientesIds = clientesDeCobrador.map(c => c.id);
      
      const prestamosDeCobrador = prestamos.filter(p => 
        clientesIds.includes(p.cliente_id) && 
        (p.estado === "ACTIVO" || p.estado === "ATRASADO")
      );
      
      const prestamoIds = prestamosDeCobrador.map(p => p.id);
      
      const pagosDeCobrador = pagos.filter(p => 
        prestamoIds.includes(p.prestamo_id) && 
        filtrarPorPeriodo(p.fecha_pago)
      );
      
      const montoPrestado = prestamosDeCobrador.reduce((sum, p) => sum + Number(p.monto_prestado), 0);
      const montoRecaudado = pagosDeCobrador.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
      
      return {
        nombre: cobrador.nombre,
        montoPrestado,
        montoRecaudado,
        clientes: clientesDeCobrador.length,
        prestamos: prestamosDeCobrador.length,
        pagos: pagosDeCobrador.length,
        eficiencia: montoPrestado > 0 ? (montoRecaudado / montoPrestado) * 100 : 0
      };
    });
    
    return datos;
  };

  // Generar datos para proyección de flujo de caja
  const datosProyeccionFlujo = () => {
    const proyeccion: Record<string, { entrada: number; salida: number }> = {};
    const hoy = new Date();
    
    // Inicializar 3 meses hacia adelante
    for (let i = 0; i < 12; i++) {
      const fecha = new Date();
      fecha.setDate(1); // Primer día del mes
      fecha.setMonth(hoy.getMonth() + i);
      const mesKey = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      proyeccion[mesKey] = { entrada: 0, salida: 0 };
    }
    
    // Proyectar pagos futuros
    prestamos
      .filter(p => p.estado === "ACTIVO" || p.estado === "ATRASADO")
      .forEach(prestamo => {
        const prestamoId = prestamo.id;
        const pagoActual = prestamo.semanas_pagadas;
        const pagosTotales = prestamo.numero_semanas;
        const pagosPendientes = pagosTotales - pagoActual;
        
        if (pagosPendientes <= 0) return;
        
        // Distribuir pagos futuros
        const montoSemanal = Number(prestamo.pago_semanal);
        let fechaPago = new Date(prestamo.proxima_fecha_pago);
        
        for (let i = 0; i < pagosPendientes; i++) {
          const mesKey = `${fechaPago.getMonth() + 1}/${fechaPago.getFullYear()}`;
          if (proyeccion[mesKey]) {
            proyeccion[mesKey].entrada += montoSemanal;
          }
          
          // Avanzar a la siguiente semana
          fechaPago = new Date(fechaPago);
          fechaPago.setDate(fechaPago.getDate() + 7);
        }
      });
    
    return Object.entries(proyeccion).map(([mes, datos]) => ({
      mes,
      entrada: datos.entrada,
      salida: datos.salida,
      neto: datos.entrada - datos.salida
    }));
  };

  // Datos para análisis de cumplimiento
  const datosCumplimiento = () => {
    const prestamosTerminados = prestamos.filter(p => p.estado === "PAGADO");
    const totalPrestamos = prestamosTerminados.length;
    
    // Calcular días de atraso promedio
    const diasAtraso = prestamosTerminados.map(prestamo => {
      const fechaFinal = new Date(prestamo.fecha_prestamo);
      fechaFinal.setDate(fechaFinal.getDate() + (prestamo.numero_semanas * 7));
      
      const ultimoPago = pagos
        .filter(p => p.prestamo_id === prestamo.id)
        .sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime())[0];
      
      if (!ultimoPago) return 0;
      
      const fechaPago = new Date(ultimoPago.fecha_pago);
      const diferencia = fechaPago.getTime() - fechaFinal.getTime();
      return Math.max(0, Math.ceil(diferencia / (1000 * 60 * 60 * 24)));
    });
    
    const promedioDiasAtraso = diasAtraso.reduce((sum, dias) => sum + dias, 0) / 
      (diasAtraso.length || 1);
    
    // Calcular porcentaje de préstamos pagados a tiempo
    const prestamosATiempo = diasAtraso.filter(dias => dias <= 0).length;
    const porcentajeATiempo = totalPrestamos > 0 ? (prestamosATiempo / totalPrestamos) * 100 : 0;
    
    // Distribuir por categorías de atraso
    const distribucionAtraso = [
      { nombre: "A tiempo", valor: diasAtraso.filter(d => d === 0).length },
      { nombre: "1-7 días", valor: diasAtraso.filter(d => d > 0 && d <= 7).length },
      { nombre: "8-15 días", valor: diasAtraso.filter(d => d > 7 && d <= 15).length },
      { nombre: "16-30 días", valor: diasAtraso.filter(d => d > 15 && d <= 30).length },
      { nombre: ">30 días", valor: diasAtraso.filter(d => d > 30).length },
    ];
    
    return {
      promedioDiasAtraso,
      porcentajeATiempo,
      distribucionAtraso,
      totalPrestamos
    };
  };

  // Función para exportar reporte a Excel
  const exportarExcel = () => {
    let data: any[] = [];
    let filename = "reporte";
    let headers: string[] = [];
    
    // Seleccionar datos según el tipo de reporte
    if (reportType === "prestamos") {
      data = prestamosFiltrados.map(prestamo => {
        const cliente = clientes.find(c => c.id === prestamo.cliente_id);
        return {
          ID: prestamo.id,
          Cliente: cliente?.nombre || "Desconocido",
          Monto: Number(prestamo.monto_prestado),
          Interes: `${prestamo.tasa_interes}%`,
          Fecha: formatDate(prestamo.fecha_prestamo),
          Semanas: `${prestamo.semanas_pagadas}/${prestamo.numero_semanas}`,
          Estado: prestamo.estado,
        };
      });
      filename = "reporte_prestamos";
    } else if (reportType === "pagos") {
      data = pagosFiltrados.map(pago => {
        const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
        const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
        return {
          ID: pago.id,
          Cliente: cliente?.nombre || "Desconocido",
          "Préstamo ID": pago.prestamo_id,
          "Monto Pagado": Number(pago.monto_pagado),
          "Fecha Pago": formatDate(pago.fecha_pago),
          Semana: pago.numero_semana,
          Estado: pago.estado,
        };
      });
      filename = "reporte_pagos";
    } else if (vista === "rentabilidad") {
      data = datosRentabilidadMensual();
      filename = "reporte_rentabilidad";
    } else if (vista === "cobradores") {
      data = datosPorCobrador();
      filename = "reporte_cobradores";
    } else if (vista === "proyeccion") {
      data = datosProyeccionFlujo();
      filename = "reporte_proyeccion";
    }
    
    // Crear libro de Excel
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Datos");
    
    // Generar archivo
    writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
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

  // Función para exportar reporte a PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const titulo = vista === "general" 
      ? `Reporte de ${reportType === "prestamos" ? "Préstamos" : "Pagos"}`
      : `Análisis de ${vista}`;
      
    // Añadir título
    doc.setFontSize(18);
    doc.text(titulo, 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${formatDate(new Date())}`, 14, 30);
    
    // Añadir datos según el tipo de reporte
    if (vista === "general") {
      if (reportType === "prestamos") {
        const data = prestamosFiltrados.map(prestamo => {
          const cliente = clientes.find(c => c.id === prestamo.cliente_id);
          return [
            prestamo.id,
            cliente?.nombre || "Desconocido",
            formatCurrency(prestamo.monto_prestado),
            `${prestamo.tasa_interes}%`,
            formatDate(prestamo.fecha_prestamo),
            `${prestamo.semanas_pagadas}/${prestamo.numero_semanas}`,
            prestamo.estado
          ];
        });
        
        doc.autoTable({
          head: [["ID", "Cliente", "Monto", "Interés", "Fecha", "Semanas", "Estado"]],
          body: data,
          startY: 40,
          theme: 'striped',
        });
      } else {
        const data = pagosFiltrados.map(pago => {
          const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
          const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
          return [
            pago.id,
            cliente?.nombre || "Desconocido",
            pago.prestamo_id,
            formatCurrency(pago.monto_pagado),
            formatDate(pago.fecha_pago),
            pago.numero_semana,
            pago.estado
          ];
        });
        
        doc.autoTable({
          head: [["ID", "Cliente", "Préstamo ID", "Monto", "Fecha", "Semana", "Estado"]],
          body: data,
          startY: 40,
          theme: 'striped',
        });
      }
    } else if (vista === "rentabilidad") {
      const data = datosRentabilidadMensual().map(item => [
        item.mes,
        formatCurrency(item.interes),
        formatCurrency(item.capital),
        formatCurrency(item.total),
        item.interes > 0 ? `${((item.interes / item.total) * 100).toFixed(2)}%` : "0%"
      ]);
      
      doc.autoTable({
        head: [["Mes", "Interés", "Capital", "Total", "% Interés"]],
        body: data,
        startY: 40,
        theme: 'striped',
      });
    } else if (vista === "cobradores") {
      const data = datosPorCobrador().map(item => [
        item.nombre,
        item.clientes,
        item.prestamos,
        formatCurrency(item.montoPrestado),
        formatCurrency(item.montoRecaudado),
        `${item.eficiencia.toFixed(2)}%`
      ]);
      
      doc.autoTable({
        head: [["Cobrador", "Clientes", "Préstamos", "Prestado", "Recaudado", "Eficiencia"]],
        body: data,
        startY: 40,
        theme: 'striped',
      });
    } else if (vista === "proyeccion") {
      const data = datosProyeccionFlujo().map(item => [
        item.mes,
        formatCurrency(item.entrada),
        formatCurrency(item.salida),
        formatCurrency(item.neto)
      ]);
      
      doc.autoTable({
        head: [["Mes", "Entradas", "Salidas", "Flujo Neto"]],
        body: data,
        startY: 40,
        theme: 'striped',
      });
    } else if (vista === "cumplimiento") {
      const datos = datosCumplimiento();
      
      // Resumen
      doc.text(`Total de préstamos pagados: ${datos.totalPrestamos}`, 14, 40);
      doc.text(`Promedio de días de atraso: ${datos.promedioDiasAtraso.toFixed(2)} días`, 14, 48);
      doc.text(`Porcentaje de préstamos pagados a tiempo: ${datos.porcentajeATiempo.toFixed(2)}%`, 14, 56);
      
      // Tabla de distribución
      const data = datos.distribucionAtraso.map(item => [
        item.nombre,
        item.valor,
        datos.totalPrestamos > 0 ? `${((item.valor / datos.totalPrestamos) * 100).toFixed(2)}%` : "0%"
      ]);
      
      doc.autoTable({
        head: [["Categoría", "Cantidad", "Porcentaje"]],
        body: data,
        startY: 65,
        theme: 'striped',
      });
    }
    
    // Guardar PDF
    doc.save(`reporte_${vista}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis y estadísticas del sistema</p>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
          <Select 
            value={vista}
            onValueChange={setVista}
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
              <SelectItem value="intereses">Intereses por Préstamo</SelectItem>
              <SelectItem value="sistema">Sistema</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              size="icon"
              onClick={exportarCSV}
              title="Exportar a CSV"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline"
              size="icon"
              onClick={exportarExcel}
              title="Exportar a Excel"
            >
              <span className="font-bold text-xs">XLS</span>
            </Button>
            <Button 
              variant="outline"
              size="icon"
              onClick={exportarPDF}
              title="Exportar a PDF"
            >
              <span className="font-bold text-xs">PDF</span>
            </Button>
          </div>
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
      
      {/* VISTA GENERAL */}
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
                          formatter={(value: any, name: string | undefined): [string | number, string] => {
                            if (typeof value === 'number') {
                              return [formatCurrency(value), name || ""];
                            }
                            return [String(value), name || ""];
                          }}
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
                  <ResponsiveTable>
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
                  </ResponsiveTable>
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
                  <FileText className="h-4 w-4 mr-2" />
                  Préstamos
                </Button>
                <Button 
                  variant={reportType === "pagos" ? "default" : "outline"}
                  className={`w-full justify-start ${reportType === "pagos" ? "bg-primary" : ""}`}
                  onClick={() => setReportType("pagos")}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
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
                          label={({ name, percent }) => {
                            const p = percent as number;
                            return `${name}: ${(p * 100).toFixed(0)}%`;
                          }}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {datosPrestamosEstado.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value): [string | number, string] => [`${value} préstamos`, ""]}
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
      )}
      
      {/* VISTA RENTABILIDAD */}
      {vista === "rentabilidad" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Rentabilidad Mensual</CardTitle>
              <CardDescription>Análisis de intereses vs capital por mes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={datosRentabilidadMensual()}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    />
                    <Area 
                      type="monotone" 
                      dataKey="interes" 
                      stackId="1"
                      name="Interés" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="capital" 
                      stackId="1"
                      name="Capital"  
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Rentabilidad</CardTitle>
              <CardDescription>Análisis de retorno de inversión</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-b pb-2 border-border">
                  <p className="text-sm font-medium">Capital total prestado</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(prestamos.reduce((sum, p) => sum + Number(p.monto_prestado), 0))}
                  </p>
                </div>
                
                <div className="border-b pb-2 border-border">
                  <p className="text-sm font-medium">Interés total generado</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(prestamos.reduce((sum, p) => {
                      const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
                      return sum + interes;
                    }, 0))}
                  </p>
                </div>
                
                <div className="border-b pb-2 border-border">
                  <p className="text-sm font-medium">Porcentaje de ganancia</p>
                  <p className="text-2xl font-bold">
                    {(() => {
                      const prestado = prestamos.reduce((sum, p) => sum + Number(p.monto_prestado), 0);
                      const intereses = prestamos.reduce((sum, p) => {
                        const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
                        return sum + interes;
                      }, 0);
                      
                      return prestado > 0 ? `${((intereses / prestado) * 100).toFixed(2)}%` : "0%";
                    })()}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Morosidad</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(prestamos.reduce((sum, p) => sum + Number(p.monto_mora_acumulada || 0), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* VISTA COBRADORES */}
      {vista === "cobradores" && (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis por Cobrador</CardTitle>
              <CardDescription>Desempeño y eficiencia de los cobradores</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cobrador</TableHead>
                      <TableHead>Clientes</TableHead>
                      <TableHead>Préstamos</TableHead>
                      <TableHead>Capital Prestado</TableHead>
                      <TableHead>Monto Recaudado</TableHead>
                      <TableHead>Eficiencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datosPorCobrador().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">No hay datos de cobradores</TableCell>
                      </TableRow>
                    ) : (
                      datosPorCobrador().map((cobrador, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{cobrador.nombre}</TableCell>
                          <TableCell>{cobrador.clientes}</TableCell>
                          <TableCell>{cobrador.prestamos}</TableCell>
                          <TableCell>{formatCurrency(cobrador.montoPrestado)}</TableCell>
                          <TableCell>{formatCurrency(cobrador.montoRecaudado)}</TableCell>
                          <TableCell>
                            <Badge className={cobrador.eficiencia > 80 ? "bg-green-600" : cobrador.eficiencia > 50 ? "bg-amber-600" : "bg-red-600"}>
                              {cobrador.eficiencia.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
              
              <div className="mt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={datosPorCobrador()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nombre" stroke="currentColor" />
                    <YAxis stroke="currentColor" />
                    <Tooltip 
                      formatter={(value: any) => {
                        // Usamos any para evitar problemas de tipo en esta función específica
                        if (typeof value === 'number') {
                          return formatCurrency(value);
                        }
                        return value;
                      }}
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="montoPrestado" name="Capital Prestado" fill="#3B82F6" />
                    <Bar dataKey="montoRecaudado" name="Recaudado" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* VISTA PROYECCIÓN */}
      {vista === "proyeccion" && (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Proyección de Flujo de Caja</CardTitle>
              <CardDescription>Ingresos estimados para los próximos meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={datosProyeccionFlujo()}
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
                    />
                    <Legend />
                    <Line type="monotone" dataKey="entrada" name="Ingresos" stroke="#3B82F6" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="salida" name="Egresos" stroke="#EF4444" />
                    <Line type="monotone" dataKey="neto" name="Flujo Neto" stroke="#10B981" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead>Ingresos Estimados</TableHead>
                        <TableHead>Egresos Estimados</TableHead>
                        <TableHead>Flujo Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {datosProyeccionFlujo().map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.mes}</TableCell>
                          <TableCell className="text-green-600 dark:text-green-400">{formatCurrency(item.entrada)}</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">{formatCurrency(item.salida)}</TableCell>
                          <TableCell>{formatCurrency(item.neto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* VISTA INTERESES POR PRÉSTAMO */}
      {vista === "intereses" && (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Intereses por Préstamo</CardTitle>
              <CardDescription>Desglose detallado de intereses ganados en cada préstamo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">Total préstamos</p>
                        <p className="text-2xl font-bold">{prestamos.length}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {prestamos.filter(p => p.estado === "ACTIVO" || p.estado === "ATRASADO").length} activos
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">Total intereses</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(prestamos.reduce((sum, p) => {
                            const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
                            return sum + interes;
                          }, 0))}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Calculado según tasas de interés
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">Intereses ya cobrados</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(pagos.reduce((sum, pago) => {
                            const prestamo = prestamos.find(p => p.id === pago.prestamo_id);
                            if (!prestamo) return sum;
                            
                            const tasaInteres = Number(prestamo.tasa_interes) / 100;
                            const montoPagado = Number(pago.monto_pagado);
                            const interesPago = montoPagado * tasaInteres / (1 + tasaInteres);
                            
                            return sum + interesPago;
                          }, 0))}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {Math.round(pagos.length / prestamos.length * 100)}% de pagos completados
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Préstamo</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Interés Total</TableHead>
                        <TableHead>Interés Pagado</TableHead>
                        <TableHead>Interés Pendiente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>% Completado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {datosInteresesPorPrestamo(prestamos, clientes, pagos).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">No hay datos de préstamos</TableCell>
                      </TableRow>
                    ) : (
                      datosInteresesPorPrestamo(prestamos, clientes, pagos).map((item) => {
                        const { label, className } = getLoanStatus(item.estado);
                        
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente}</TableCell>
                            <TableCell>{item.id}</TableCell>
                            <TableCell>{formatCurrency(item.montoPrestado)}</TableCell>
                            <TableCell className="text-green-600 dark:text-green-400 font-medium">
                              {formatCurrency(item.interesTotal)}
                            </TableCell>
                            <TableCell>{formatCurrency(item.interesYaPagado)}</TableCell>
                            <TableCell className="text-red-600 dark:text-red-400">
                              {formatCurrency(item.interesRestante)}
                            </TableCell>
                            <TableCell>
                              <Badge className={className}>{label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="bg-primary h-2.5"
                                  style={{ width: `${Math.min(100, item.porcentajeCompletado)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium">{item.porcentajeCompletado.toFixed(1)}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* VISTA CUMPLIMIENTO */}
      {vista === "cumplimiento" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Cumplimiento</CardTitle>
              <CardDescription>Métricas de pago y atrasos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm font-medium">Préstamos pagados</p>
                    <p className="text-2xl font-bold mt-1">{datosCumplimiento().totalPrestamos}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm font-medium">Días promedio de atraso</p>
                    <p className="text-2xl font-bold mt-1">{datosCumplimiento().promedioDiasAtraso.toFixed(1)}</p>
                  </div>
                </div>
                
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium mb-2">Porcentaje de pagos a tiempo</p>
                  <div className="h-4 bg-muted rounded overflow-hidden">
                    <div 
                      className="h-full bg-green-600" 
                      style={{ width: `${datosCumplimiento().porcentajeATiempo}%` }}
                    ></div>
                  </div>
                  <p className="text-sm mt-1 text-muted-foreground">{datosCumplimiento().porcentajeATiempo.toFixed(2)}%</p>
                </div>
              </div>
              
              <div className="mt-8 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosCumplimiento().distribucionAtraso}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => {
                        const p = percent as number;
                        return `${name}: ${(p * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="valor"
                      nameKey="nombre"
                    >
                      {datosCumplimiento().distribucionAtraso.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[
                          "#10B981", // Verde para a tiempo
                          "#FBBF24", // Amarillo para 1-7 días
                          "#FB923C", // Naranja para 8-15 días
                          "#F97316", // Naranja más oscuro para 16-30 días
                          "#EF4444", // Rojo para >30 días
                        ][index % 5]} />
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
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Desglose por Categoría</CardTitle>
              <CardDescription>Distribución de préstamos por tiempo de pago</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Porcentaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datosCumplimiento().distribucionAtraso.map((item, index) => {
                      const porcentaje = datosCumplimiento().totalPrestamos > 0 
                        ? (item.valor / datosCumplimiento().totalPrestamos) * 100 
                        : 0;
                      
                      let badgeClass = "";
                      switch(index) {
                        case 0: badgeClass = "bg-green-600"; break;
                        case 1: badgeClass = "bg-amber-500"; break;
                        case 2: badgeClass = "bg-orange-500"; break;
                        case 3: badgeClass = "bg-orange-600"; break;
                        case 4: badgeClass = "bg-red-600"; break;
                      }
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          <TableCell>{item.valor}</TableCell>
                          <TableCell>
                            <Badge className={badgeClass}>
                              {porcentaje.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
              
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-semibold mb-2">Recomendaciones</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>
                    {datosCumplimiento().porcentajeATiempo < 60 ? (
                      <span>Mejorar sistema de recordatorios de pago para aumentar cumplimiento a tiempo</span>
                    ) : datosCumplimiento().porcentajeATiempo < 80 ? (
                      <span>Considerar incentivos para pagos anticipados o puntuales</span>
                    ) : (
                      <span>El nivel de cumplimiento es bueno, mantener estrategias actuales</span>
                    )}
                  </li>
                  <li>
                    {datosCumplimiento().promedioDiasAtraso > 10 ? (
                      <span>Revisar proceso de cobro de morosos para reducir días de atraso</span>
                    ) : datosCumplimiento().promedioDiasAtraso > 5 ? (
                      <span>Mejorar seguimiento de préstamos con tendencia a atrasarse</span>
                    ) : (
                      <span>El tiempo promedio de atraso es bajo, continuar con las prácticas actuales</span>
                    )}
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}