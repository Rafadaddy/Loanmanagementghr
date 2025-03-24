import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, FileSpreadsheet, Calendar, RefreshCw, Edit, Clock, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";

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
    fecha_inicial_personalizada?: string;
    dia_pago?: number;
  };
  pagosRealizados: Array<{
    id: number;
    prestamo_id: number;
    monto_pagado: string;
    fecha_pago: string | Date;
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
  fechaPago?: string | Date;
  resto?: string;
  mora?: string;
}

export default function LoanSchedule({ prestamo, pagosRealizados, nombreCliente }: LoanScheduleProps) {
  // Garantizar que solo mostramos un número limitado de semanas en móvil para mejor rendimiento
  const MAX_MOBILE_ITEMS = 12;
  const [cronograma, setCronograma] = useState<CuotaProgramada[]>([]);

  // Estado para la fecha personalizada de la primera cuota
  const [fechaInicial, setFechaInicial] = useState<string | null>(null);
  const [showFechaDialog, setShowFechaDialog] = useState(false);
  
  // Estado para manejar la carga durante los cambios de fecha
  const [isLoading, setIsLoading] = useState(false);
  
  // Función para abrir el diálogo de cambio de fecha inicial
  const openFechaDialog = () => setShowFechaDialog(true);
  
  // Función para aplicar la nueva fecha inicial
  const aplicarFechaInicial = (fecha: string) => {
    setIsLoading(true); // Activar estado de carga
    setFechaInicial(fecha);
    setShowFechaDialog(false);
    
    // Simular un tiempo de carga breve para mostrar el efecto visual
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };
  
  // Función para resetear la fecha inicial a la del préstamo
  const resetFechaInicial = () => {
    setIsLoading(true); // Activar estado de carga
    setFechaInicial(null);
    setShowFechaDialog(false);
    
    // Simular un tiempo de carga breve para mostrar el efecto visual
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };

  useEffect(() => {
    // Generar el cronograma completo del préstamo
    const schedule: CuotaProgramada[] = [];
    const pagoSemanal = parseFloat(prestamo.pago_semanal);
    
    // Mapa para un acceso más rápido a los pagos realizados
    const pagosMap = new Map();
    pagosRealizados.forEach(pago => {
      pagosMap.set(pago.numero_semana, pago);
    });
    
    // Si el préstamo tiene semanas pagadas, necesitamos calcular en base a la próxima fecha de pago
    // y retroceder para las semanas anteriores
    const semanasYaPagadas = prestamo.semanas_pagadas || 0;
    
    // Usamos una nueva fecha para evitar errores de zona horaria
    // Si hay una fecha personalizada, la usamos como primera cuota
    // Esto permite al usuario cambiar manualmente la fecha de inicio del cronograma
    let primeraFechaPago: Date;
    
    if (fechaInicial) {
      // Si hay una fecha inicial personalizada desde nuestro estado local, la usamos
      primeraFechaPago = new Date(fechaInicial);
    } else if (prestamo.fecha_inicial_personalizada) {
      // Si el préstamo tiene una fecha inicial personalizada guardada, la usamos
      primeraFechaPago = new Date(prestamo.fecha_inicial_personalizada);
    } else if (semanasYaPagadas === 0) {
      // Si no hay semanas pagadas, la primera fecha es 7 días después del préstamo
      const fechaPrestamo = new Date(prestamo.fecha_prestamo);
      primeraFechaPago = new Date(fechaPrestamo);
      primeraFechaPago.setDate(fechaPrestamo.getDate() + 7);
    } else {
      // Si hay semanas pagadas, calculamos la primera fecha a partir de la próxima fecha de pago
      const proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
      primeraFechaPago = new Date(proximaFechaPago);
      primeraFechaPago.setDate(proximaFechaPago.getDate() - (semanasYaPagadas * 7));
    }
    
    // Crear una función auxiliar para calcular la fecha de una semana específica
    const calcularFechaSemana = (numeroSemana: number): Date => {
      const fecha = new Date(primeraFechaPago);
      // Ajustamos la fecha sumando las semanas (número de semana - 1) * 7 días
      // Restamos 1 porque la primera semana ya tiene la fecha correcta (primeraFechaPago)
      fecha.setDate(primeraFechaPago.getDate() + ((numeroSemana - 1) * 7));
      return fecha;
    };
    
    // Generar todas las semanas del préstamo
    for (let i = 1; i <= prestamo.numero_semanas; i++) {
      // Calculamos la fecha programada para esta semana
      const fechaProgramada = calcularFechaSemana(i);
      
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
        cuota.numero.toString(),
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
        cuota.numero.toString(),
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

  // Estado para el formulario de cambio de fecha
  const [nuevaFecha, setNuevaFecha] = useState<string>("");
  
  // Función para manejar el cambio de fecha
  const handleFechaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNuevaFecha(e.target.value);
  };
  
  // Al abrir el diálogo, establecer la fecha actual o la fecha inicial personalizada
  useEffect(() => {
    if (showFechaDialog) {
      if (fechaInicial) {
        // Si hay una fecha personalizada, la usamos
        setNuevaFecha(fechaInicial);
      } else if (prestamo.semanas_pagadas === 0) {
        // Primera fecha de pago calculada (7 días después del préstamo)
        const fechaPrestamo = new Date(prestamo.fecha_prestamo);
        const primerPago = new Date(fechaPrestamo);
        primerPago.setDate(fechaPrestamo.getDate() + 7);
        setNuevaFecha(primerPago.toISOString().split('T')[0]);
      } else {
        // Calcular la primera fecha basada en la próxima fecha de pago
        const proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
        const primeraFecha = new Date(proximaFechaPago);
        primeraFecha.setDate(proximaFechaPago.getDate() - (prestamo.semanas_pagadas * 7));
        setNuevaFecha(primeraFecha.toISOString().split('T')[0]);
      }
    }
  }, [showFechaDialog]);
  
  // Función para aplicar la nueva fecha
  const handleAplicarFecha = () => {
    if (nuevaFecha) {
      aplicarFechaInicial(nuevaFecha);
    }
  };

  return (
    <Card className="mt-4 mb-6 w-full max-w-full overflow-hidden">
      {/* Diálogo para cambiar la fecha inicial */}
      <Dialog open={showFechaDialog} onOpenChange={setShowFechaDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cambiar fecha inicial del cronograma</DialogTitle>
            <DialogDescription>
              Esta acción modificará la fecha de la primera cuota y recalculará todas las fechas del cronograma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fecha-inicial" className="text-right">
                Fecha
              </Label>
              <Input
                id="fecha-inicial"
                type="date"
                value={nuevaFecha}
                onChange={handleFechaChange}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFechaDialog(false)}>
              Cancelar
            </Button>
            <Button type="submit" onClick={handleAplicarFecha}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-1 text-base">
            <Calendar className="h-4 w-4" />
            Cronograma de Pagos
          </CardTitle>
          {/* Botón para cambiar la fecha inicial del cronograma */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={openFechaDialog}
            className="flex items-center h-7 px-2 text-xs hover:bg-secondary"
            title="Cambiar fecha inicial del cronograma"
          >
            <Clock className="h-3.5 w-3.5 mr-1" />
            Cambiar fecha
          </Button>
          {fechaInicial && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={resetFechaInicial}
              className="flex items-center h-7 px-1 text-xs text-muted-foreground hover:bg-secondary"
              title="Restaurar fecha inicial predeterminada"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToPDF}
            className="flex items-center h-7 px-2 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToExcel}
            className="flex items-center h-7 px-2 text-xs"
          >
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 py-2 sm:p-6 max-w-full overflow-x-auto">
        {/* Mostrar indicador de carga cuando se está calculando el cronograma */}
        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loading text="Recalculando fechas..." />
          </div>
        ) : (
          <>
            {/* Vista móvil - Tarjetas individuales */}
            <div className="block md:hidden space-y-2">
              {cronograma.length > 0 ? (
                cronograma.slice(0, MAX_MOBILE_ITEMS).map((cuota) => (
                  <div key={cuota.numero} className="border rounded-lg p-2 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm">Semana {cuota.numero}</span>
                      <Badge
                        className={
                          cuota.estado === "PAGADO"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs h-5"
                            : cuota.estado === "PARCIAL"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs h-5"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs h-5"
                        }
                      >
                        {cuota.estado}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      <div>
                        <p className="text-muted-foreground">Fecha:</p>
                        <p className="font-medium">{formatDate(cuota.fechaProgramada)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monto:</p>
                        <p className="font-medium">{formatCurrency(cuota.montoProgramado)}</p>
                      </div>
                      {cuota.estado !== "PENDIENTE" && (
                        <>
                          <div>
                            <p className="text-muted-foreground">Pagó el:</p>
                            <p className="font-medium">{cuota.fechaPago ? formatDate(cuota.fechaPago) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pagó:</p>
                            <p className="font-medium text-green-500">{cuota.montoPagado ? formatCurrency(cuota.montoPagado) : "-"}</p>
                          </div>
                        </>
                      )}
                      {(cuota.mora && parseFloat(cuota.mora) > 0) && (
                        <div>
                          <p className="text-muted-foreground">Mora:</p>
                          <p className="font-medium text-red-500">{formatCurrency(cuota.mora)}</p>
                        </div>
                      )}
                      {(cuota.resto && parseFloat(cuota.resto) > 0) && (
                        <div>
                          <p className="text-muted-foreground">Restante:</p>
                          <p className="font-medium text-orange-500">{formatCurrency(cuota.resto)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-muted-foreground text-sm">
                  No hay información de cronograma disponible
                </div>
              )}
              {cronograma.length > MAX_MOBILE_ITEMS && (
                <div className="text-center text-xs text-muted-foreground mt-2 p-2 border rounded-lg">
                  Mostrando {MAX_MOBILE_ITEMS} de {cronograma.length} semanas.
                  <br />Para ver todas las semanas, descargue el PDF o Excel.
                </div>
              )}
            </div>

            {/* Vista desktop - Tabla horizontal */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table className="cronograma-table">
                <TableHeader>
                  <TableRow className="table-row">
                    <TableHead className="table-header w-[12%]">Nº Cuota</TableHead>
                    <TableHead className="table-header w-[12%]">Fecha Programada</TableHead>
                    <TableHead className="table-header w-[12%]">Monto</TableHead>
                    <TableHead className="table-header w-[12%]">Estado</TableHead>
                    <TableHead className="table-header w-[12%]">Fecha de Pago</TableHead>
                    <TableHead className="table-header w-[12%]">Monto Pagado</TableHead>
                    <TableHead className="table-header w-[12%]">Mora</TableHead>
                    <TableHead className="table-header w-[12%]">Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronograma.map((cuota) => (
                    <TableRow key={cuota.numero} className="table-row">
                      <TableCell className="table-cell">Semana {cuota.numero}</TableCell>
                      <TableCell className="table-cell">{formatDate(cuota.fechaProgramada)}</TableCell>
                      <TableCell className="table-cell">{formatCurrency(cuota.montoProgramado)}</TableCell>
                      <TableCell className="table-cell">
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
                      <TableCell className="table-cell">{cuota.fechaPago ? formatDate(cuota.fechaPago) : "-"}</TableCell>
                      <TableCell className="table-cell">
                        {cuota.montoPagado ? formatCurrency(cuota.montoPagado) : "-"}
                      </TableCell>
                      <TableCell className="table-cell text-red-500">
                        {cuota.mora && parseFloat(cuota.mora) > 0 ? formatCurrency(cuota.mora) : "-"}
                      </TableCell>
                      <TableCell className="table-cell text-orange-500">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}