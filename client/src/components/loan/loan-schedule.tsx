import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, addDaysToDate, normalizeDate, createConsistentDate } from "@/lib/utils";
import { FileText, FileSpreadsheet, Calendar, Edit, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrestamoDisplay, PagoDisplay } from "@/types/loan";
import { useToast } from "@/hooks/use-toast";

interface LoanScheduleProps {
  prestamo: PrestamoDisplay;
  pagosRealizados: Array<PagoDisplay>;
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
  // Log para verificar cuando se reconstruye el componente
  console.log("Componente LoanSchedule recreado con fechas:", prestamo.fecha_prestamo, prestamo.fecha_inicial_personalizada, prestamo.proxima_fecha_pago);
  console.log("Estado de eliminación del cronograma:", prestamo.cronograma_eliminado);
  // Garantizar que solo mostramos un número limitado de semanas en móvil para mejor rendimiento
  const MAX_MOBILE_ITEMS = 16;
  const [cronograma, setCronograma] = useState<CuotaProgramada[]>([]);
  
  // Hook de toast para mostrar mensajes
  const { toast } = useToast();
  
  // Contador para forzar la actualización completa del componente
  const [forceRefreshCounter, setForceRefreshCounter] = useState<number>(0);

  // Estado para la fecha personalizada de la primera cuota
  const [fechaInicial, setFechaInicial] = useState<string | null>(null);
  const [showFechaDialog, setShowFechaDialog] = useState(false);
  // Estado para controlar si el cronograma ha sido eliminado manualmente
  // Inicializar desde el valor almacenado en el préstamo
  const [cronogramaEliminado, setCronogramaEliminado] = useState<boolean>(prestamo.cronograma_eliminado || false);
  
  // Función para abrir el diálogo de cambio de fecha inicial
  const openFechaDialog = () => setShowFechaDialog(true);
  
  // Función para aplicar la nueva fecha inicial y guardarla de forma persistente
  const aplicarFechaInicial = async (fecha: string) => {
    // Guardar en el estado local
    setFechaInicial(fecha);
    setShowFechaDialog(false);
    
    console.log("Aplicando nueva fecha inicial y reactivando cronograma");
    
    // Si el cronograma estaba eliminado, lo volvemos a activar
    if (cronogramaEliminado) {
      setCronogramaEliminado(false);
    }
    
    // Guardar en el préstamo para persistencia
    try {
      console.log("Guardando nueva fecha inicial en la base de datos:", fecha);
      // Realizar petición para actualizar la fecha inicial del préstamo
      const response = await fetch(`/api/prestamos/${prestamo.id}/set-fecha-inicial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fecha_inicial_personalizada: fecha,
          cronograma_eliminado: false 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error al guardar la fecha inicial: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Fecha inicial y estado del cronograma actualizados correctamente:", data);
      
      // Incrementar el contador para forzar actualización
      setForceRefreshCounter(prev => prev + 1);
      console.log("Forzando regeneración del cronograma con la nueva fecha");
    } catch (error) {
      console.error("Error al guardar la fecha inicial:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la nueva fecha inicial en la base de datos.",
        variant: "destructive"
      });
    }
  };
  
  // Función para resetear la fecha inicial a la del préstamo
  const resetFechaInicial = async () => {
    setFechaInicial(null);
    setShowFechaDialog(false);
    
    // Si el cronograma estaba eliminado, lo volvemos a activar
    if (cronogramaEliminado) {
      setCronogramaEliminado(false);
      
      // Guardar el estado restaurado en la base de datos
      try {
        await fetch(`/api/prestamos/${prestamo.id}/set-fecha-inicial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fecha_inicial_personalizada: null,
            cronograma_eliminado: false 
          })
        });
        console.log("Estado de cronograma restaurado en la base de datos");
      } catch (error) {
        console.error("Error al restaurar el estado del cronograma:", error);
      }
    }
  };

  // Clave para forzar la recarga del cronograma cuando cambia el día de pago
  // Este useEffect se ejecutará cada vez que el préstamo o los pagos cambien
  useEffect(() => {
    console.log("Evaluando si regenerar cronograma - Estado eliminado:", cronogramaEliminado);
    
    // Solo actualizamos si el cronograma no ha sido eliminado manualmente
    if (!cronogramaEliminado) {
      // Resetear el estado local de fecha inicial cuando el préstamo cambia
      // Esto asegura que se use siempre la fecha más actualizada del préstamo
      setFechaInicial(null);
      
      // Incrementar el contador del cronograma para forzar su recreación
      setForceRefreshCounter(prev => prev + 1);
      console.log("Reseteando fecha inicial y forzando actualización del cronograma");
    } else {
      console.log("Cronograma marcado como eliminado, no se regenerará");
    }
  }, [prestamo.dia_pago, prestamo.fecha_inicial_personalizada, prestamo.proxima_fecha_pago]);
    
  useEffect(() => {
    // Si el cronograma ha sido eliminado manualmente, no lo recreamos
    if (cronogramaEliminado) {
      console.log("Cronograma marcado como eliminado, no se generará ninguna cuota");
      // Asegurar que el cronograma esté vacío
      setCronograma([]);
      return;
    }
    
    console.log("Generando cronograma de cuotas");
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
    // Vamos a usar nuestras funciones de utilidad para manejar fechas de manera consistente
    let primeraFechaISO: string;
    
    if (fechaInicial) {
      // Si hay una fecha inicial personalizada desde nuestro estado local, la usamos
      primeraFechaISO = normalizeDate(fechaInicial);
    } else if (prestamo.fecha_inicial_personalizada) {
      // Si el préstamo tiene una fecha inicial personalizada guardada, la usamos
      // Esta será actualizada cuando se cambie el día de pago
      primeraFechaISO = normalizeDate(prestamo.fecha_inicial_personalizada);
    } else if (semanasYaPagadas === 0) {
      // Si no hay semanas pagadas, la primera fecha es 7 días después del préstamo
      primeraFechaISO = addDaysToDate(prestamo.fecha_prestamo, 7);
    } else {
      // Si hay semanas pagadas, calculamos la primera fecha a partir de la próxima fecha de pago
      primeraFechaISO = addDaysToDate(prestamo.proxima_fecha_pago, -(semanasYaPagadas * 7));
    }
    
    // Crear una función auxiliar para calcular la fecha de una semana específica
    const calcularFechaSemana = (numeroSemana: number): Date => {
      // Calcular la fecha para la semana especificada
      // Para garantizar que no haya inconsistencias en el cálculo, usamos el método más preciso:
      // 1. Convertir la fecha inicial a un objeto Date
      const fechaInicial = createConsistentDate(primeraFechaISO);
      // 2. Crear una nueva fecha para no modificar la original
      const fechaSemana = new Date(fechaInicial);
      // 3. Sumar exactamente el número de días: (numeroSemana - 1) * 7
      // Es "numeroSemana - 1" porque la primera semana es la fecha inicial (no sumamos días)
      fechaSemana.setDate(fechaInicial.getDate() + ((numeroSemana - 1) * 7));
      return fechaSemana;
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
  }, [prestamo, pagosRealizados, forceRefreshCounter, cronogramaEliminado]);

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
        const primerPagoISO = addDaysToDate(prestamo.fecha_prestamo, 7);
        setNuevaFecha(primerPagoISO);
      } else {
        // Calcular la primera fecha basada en la próxima fecha de pago
        const primeraFechaISO = addDaysToDate(prestamo.proxima_fecha_pago, -(prestamo.semanas_pagadas * 7));
        setNuevaFecha(primeraFechaISO);
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
        <DialogContent className="sm:max-w-md w-[calc(100%-24px)] p-4 md:p-6 rounded-lg">
          <DialogHeader className="mb-2 space-y-2">
            <DialogTitle className="text-center text-lg md:text-xl">Establecer fecha inicial</DialogTitle>
            <DialogDescription className="text-center text-xs md:text-sm">
              Esta acción establecerá la fecha de la primera cuota y recalculará todas las fechas del cronograma.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="fecha-inicial" className="text-sm font-medium">
                Primera cuota:
              </Label>
              <Input
                id="fecha-inicial"
                type="date"
                value={nuevaFecha}
                onChange={handleFechaChange}
                className="h-10 px-3 w-full text-base"
              />
            </div>
            
            <div className="p-3 bg-muted rounded-md text-xs md:text-sm text-muted-foreground">
              <p className="font-semibold mb-1">Información importante:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Esta fecha será utilizada como fecha de la primera cuota.</li>
                <li>Las cuotas posteriores se programarán cada 7 días a partir de esta fecha.</li>
                <li className="break-words">
                  La fecha inicial recomendada es {
                    prestamo.semanas_pagadas === 0 
                      ? <span className="font-medium">{formatDate(addDaysToDate(prestamo.fecha_prestamo, 7))}</span>
                      : <span className="font-medium">{formatDate(addDaysToDate(prestamo.proxima_fecha_pago, -(prestamo.semanas_pagadas * 7)))}</span>
                  }
                </li>
              </ul>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
            <Button 
              variant="default" 
              onClick={() => {
                // Establecer la fecha recomendada
                let fechaRecomendada = "";
                if (prestamo.semanas_pagadas === 0) {
                  fechaRecomendada = addDaysToDate(prestamo.fecha_prestamo, 7);
                } else {
                  fechaRecomendada = addDaysToDate(prestamo.proxima_fecha_pago, -(prestamo.semanas_pagadas * 7));
                }
                aplicarFechaInicial(fechaRecomendada);
                
                toast({
                  title: "Fecha establecida",
                  description: `Se ha establecido la fecha inicial recomendada: ${formatDate(fechaRecomendada)}`
                });
              }} 
              className="bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm h-10 py-1"
            >
              Usar recomendada
            </Button>
            <Button 
              type="submit" 
              onClick={handleAplicarFecha} 
              disabled={!nuevaFecha}
              className="text-xs md:text-sm h-10 py-1"
            >
              Aplicar personalizada
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowFechaDialog(false)}
              className="text-xs md:text-sm h-10 py-1"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-1 text-base">
            <Calendar className="h-4 w-4" />
            Cronograma de Pagos
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Botón para establecer fecha de inicio manualmente */}
            <Button 
              variant="default" 
              size="sm"
              onClick={openFechaDialog}
              className="flex items-center h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
              title="Establecer fecha de inicio del cronograma"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Cambiar Día de Pago
            </Button>
            
            {/* Botón para eliminar el cronograma con confirmación */}
            <Button 
              variant="destructive" 
              size="sm"
              className="flex items-center h-7 px-2 text-xs"
              title="Eliminar cronograma"
              onClick={() => {
                // Confirmar antes de eliminar
                if (window.confirm("¿Estás seguro de eliminar el cronograma? Podrás recrearlo usando la opción 'Cambiar Día de Pago'.")) {
                  // Eliminar completamente el cronograma
                  setCronograma([]);
                  // Resetear el estado local
                  setFechaInicial(null);
                  // Marcar que el cronograma ha sido eliminado manualmente para evitar regeneración
                  setCronogramaEliminado(true);
                  
                  // Intentar eliminar la fecha personalizada del préstamo y guardar el estado de eliminación
                  console.log("Iniciando petición para eliminar cronograma del préstamo:", prestamo.id);
                  fetch(`/api/prestamos/${prestamo.id}/set-fecha-inicial`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      fecha_inicial_personalizada: null,
                      cronograma_eliminado: true
                    })
                  })
                  .then(response => {
                    if (!response.ok) {
                      console.error("Error al eliminar cronograma. Status:", response.status);
                      throw new Error(`Error al eliminar cronograma: ${response.status}`);
                    }
                    return response.json();
                  })
                  .then(data => {
                    console.log("Cronograma eliminado correctamente en la base de datos:", data);
                    // Forzar refresco del préstamo para asegurarnos de obtener el estado actualizado
                    // Esto debería ocurrir automáticamente por la reacción de React Query, pero lo forzamos por seguridad
                  })
                  .catch(err => {
                    console.error("Error al eliminar cronograma:", err);
                    toast({
                      title: "Error",
                      description: "No se pudo guardar el estado de eliminación del cronograma en la base de datos.",
                      variant: "destructive"
                    });
                  });
                  
                  // Mostrar mensaje de confirmación
                  toast({
                    title: "Cronograma eliminado",
                    description: "Se ha eliminado el cronograma. Utilice 'Cambiar Día de Pago' para crear uno nuevo.",
                    variant: "destructive"
                  });
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar Cronograma
            </Button>
          </div>
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
                <TableHead className="table-header w-[10%] font-semibold">Nº Cuota</TableHead>
                <TableHead className="table-header w-[16%] pl-3 font-semibold">Fecha Programada</TableHead>
                <TableHead className="table-header w-[12%] pl-3 font-semibold">Monto</TableHead>
                <TableHead className="table-header w-[10%] text-center font-semibold">Estado</TableHead>
                <TableHead className="table-header w-[16%] pl-3 font-semibold">Fecha de Pago</TableHead>
                <TableHead className="table-header w-[12%] pl-3 font-semibold">Monto Pagado</TableHead>
                <TableHead className="table-header w-[12%] pl-3 font-semibold">Mora</TableHead>
                <TableHead className="table-header w-[12%] pl-3 font-semibold">Restante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cronograma.map((cuota) => (
                <TableRow key={cuota.numero} className="table-row">
                  <TableCell className="table-cell font-medium">Semana {cuota.numero}</TableCell>
                  <TableCell className="table-cell pl-3 pr-4">{formatDate(cuota.fechaProgramada)}</TableCell>
                  <TableCell className="table-cell pl-3 pr-4">{formatCurrency(cuota.montoProgramado)}</TableCell>
                  <TableCell className="table-cell text-center">
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
                  <TableCell className="table-cell pl-3 pr-4">{cuota.fechaPago ? formatDate(cuota.fechaPago) : "-"}</TableCell>
                  <TableCell className="table-cell pl-3 pr-4">
                    {cuota.montoPagado ? formatCurrency(cuota.montoPagado) : "-"}
                  </TableCell>
                  <TableCell className="table-cell pl-3 pr-4 text-red-500">
                    {cuota.mora && parseFloat(cuota.mora) > 0 ? formatCurrency(cuota.mora) : "-"}
                  </TableCell>
                  <TableCell className="table-cell pl-3 pr-4 text-orange-500">
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