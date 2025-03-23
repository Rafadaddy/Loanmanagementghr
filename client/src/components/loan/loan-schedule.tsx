import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, FileSpreadsheet, Calendar } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface LoanScheduleProps {
  prestamo: {
    id: number;
    cliente_id: number;
    monto_prestado: string;
    tasa_interes: string;
    fecha_prestamo: string;
    frecuencia_pago: string;
    numero_semanas: number;
    pago_semanal: string;
    monto_total_pagar: string;
    estado: string;
    semanas_pagadas: number;
    proxima_fecha_pago: string;
    tasa_mora?: string;
  };
  pagosRealizados: Array<{
    id: number;
    prestamo_id: number;
    monto_pagado: string;
    fecha_pago: string;
    numero_semana: number;
    estado: string;
    es_pago_parcial: string;
    monto_restante: string;
    monto_mora?: string;
  }>;
  nombreCliente: string;
}

interface CuotaProgramada {
  numero: number;
  fechaProgramada: string;
  montoProgramado: string;
  estado: "PENDIENTE" | "PAGADO" | "PARCIAL";
  montoPagado?: string;
  fechaPago?: string;
  resto?: string;
  mora?: string;
}

export default function LoanSchedule({ prestamo, pagosRealizados, nombreCliente }: LoanScheduleProps) {
  const [cronograma, setCronograma] = useState<CuotaProgramada[]>([]);

  useEffect(() => {
    // Generar el cronograma completo del préstamo
    const schedule: CuotaProgramada[] = [];
    const fechaInicio = new Date(prestamo.fecha_prestamo);
    const pagoSemanal = parseFloat(prestamo.pago_semanal);
    
    // Mapa para un acceso más rápido a los pagos realizados
    const pagosMap = new Map();
    pagosRealizados.forEach(pago => {
      pagosMap.set(pago.numero_semana, pago);
    });
    
    // Generar todas las semanas del préstamo
    for (let i = 1; i <= prestamo.numero_semanas; i++) {
      // Calcular fecha programada (sumando semanas)
      const fechaProgramada = new Date(fechaInicio);
      fechaProgramada.setDate(fechaProgramada.getDate() + ((i - 1) * 7));
      
      // Determinar estado basado en pagos realizados
      const pagoRealizado = pagosMap.get(i);
      
      const cuota: CuotaProgramada = {
        numero: i,
        fechaProgramada: fechaProgramada.toISOString().split('T')[0],
        montoProgramado: pagoSemanal.toFixed(2),
        estado: "PENDIENTE"
      };
      
      if (pagoRealizado) {
        cuota.estado = pagoRealizado.es_pago_parcial === "true" ? "PARCIAL" : "PAGADO";
        cuota.montoPagado = pagoRealizado.monto_pagado;
        cuota.fechaPago = pagoRealizado.fecha_pago;
        cuota.resto = pagoRealizado.monto_restante;
        cuota.mora = pagoRealizado.monto_mora;
      } else if (i <= prestamo.semanas_pagadas) {
        // Si no hay registro específico pero el contador de semanas pagadas indica que se pagó
        cuota.estado = "PAGADO";
      }
      
      schedule.push(cuota);
    }
    
    setCronograma(schedule);
  }, [prestamo, pagosRealizados]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título y encabezado
    doc.setFontSize(18);
    doc.text('Cronograma de Pagos', 14, 20);
    doc.setFontSize(12);
    doc.text(`Préstamo #${prestamo.id} - ${nombreCliente}`, 14, 30);
    doc.text(`Monto prestado: ${formatCurrency(prestamo.monto_prestado)}`, 14, 38);
    doc.text(`Monto total a pagar: ${formatCurrency(prestamo.monto_total_pagar)}`, 14, 46);
    doc.text(`Tasa de interés: ${prestamo.tasa_interes}%`, 14, 54);
    doc.text(`Número de cuotas: ${prestamo.numero_semanas}`, 14, 62);
    doc.text(`Cuota semanal: ${formatCurrency(prestamo.pago_semanal)}`, 14, 70);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 78);
    
    // Crear tabla
    autoTable(doc, {
      startY: 85,
      head: [['Nº Cuota', 'Fecha Programada', 'Monto', 'Estado', 'Fecha de Pago', 'Monto Pagado', 'Mora', 'Restante']],
      body: cronograma.map(cuota => [
        cuota.numero,
        formatDate(cuota.fechaProgramada),
        formatCurrency(cuota.montoProgramado),
        cuota.estado,
        cuota.fechaPago ? formatDate(cuota.fechaPago) : '-',
        cuota.montoPagado ? formatCurrency(cuota.montoPagado) : '-',
        cuota.mora && parseFloat(cuota.mora) > 0 ? formatCurrency(cuota.mora) : '-',
        cuota.resto && parseFloat(cuota.resto) > 0 ? formatCurrency(cuota.resto) : '-'
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    doc.save(`cronograma_prestamo_${prestamo.id}.pdf`);
  };

  const exportToExcel = () => {
    // Preparar los datos para Excel
    const excelData = [
      ['Cronograma de Préstamo', '', '', '', '', '', ''],
      [`Préstamo #${prestamo.id} - ${nombreCliente}`, '', '', '', '', '', ''],
      [`Monto prestado: ${formatCurrency(prestamo.monto_prestado)}`, '', '', '', '', '', ''],
      [`Monto total a pagar: ${formatCurrency(prestamo.monto_total_pagar)}`, '', '', '', '', '', ''],
      [`Tasa de interés: ${prestamo.tasa_interes}%`, '', '', '', '', '', ''],
      [`Número de cuotas: ${prestamo.numero_semanas}`, '', '', '', '', '', ''],
      [`Cuota semanal: ${formatCurrency(prestamo.pago_semanal)}`, '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Nº Cuota', 'Fecha Programada', 'Monto', 'Estado', 'Fecha de Pago', 'Monto Pagado', 'Mora', 'Restante'],
    ];
    
    cronograma.forEach(cuota => {
      excelData.push([
        cuota.numero,
        formatDate(cuota.fechaProgramada),
        cuota.montoProgramado,
        cuota.estado,
        cuota.fechaPago ? formatDate(cuota.fechaPago) : '-',
        cuota.montoPagado || '-',
        cuota.mora && parseFloat(cuota.mora) > 0 ? cuota.mora : '-',
        cuota.resto && parseFloat(cuota.resto) > 0 ? cuota.resto : '-'
      ]);
    });
    
    // Crear el libro de trabajo y la hoja
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cronograma");
    
    // Generar el archivo y guardarlo
    XLSX.writeFile(wb, `cronograma_prestamo_${prestamo.id}.xlsx`);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Cronograma de Pagos
        </CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToPDF}
            className="flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToExcel}
            className="flex items-center gap-1"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Cuota</TableHead>
                <TableHead>Fecha Programada</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha de Pago</TableHead>
                <TableHead>Monto Pagado</TableHead>
                <TableHead>Mora</TableHead>
                <TableHead>Restante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cronograma.map((cuota) => (
                <TableRow key={cuota.numero}>
                  <TableCell>Semana {cuota.numero}</TableCell>
                  <TableCell>{formatDate(cuota.fechaProgramada)}</TableCell>
                  <TableCell>{formatCurrency(cuota.montoProgramado)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        cuota.estado === "PAGADO"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : cuota.estado === "PARCIAL"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                      }
                    >
                      {cuota.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>{cuota.fechaPago ? formatDate(cuota.fechaPago) : "-"}</TableCell>
                  <TableCell>
                    {cuota.montoPagado ? formatCurrency(cuota.montoPagado) : "-"}
                  </TableCell>
                  <TableCell className="text-red-500">
                    {cuota.mora && parseFloat(cuota.mora) > 0 ? formatCurrency(cuota.mora) : "-"}
                  </TableCell>
                  <TableCell className="text-orange-500">
                    {cuota.resto && parseFloat(cuota.resto) > 0 ? formatCurrency(cuota.resto) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {cronograma.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No hay información de cronograma disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
}