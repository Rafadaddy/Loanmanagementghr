import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getDateTimeFormat, getShortDate } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente, Cobrador } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Download, FileSpreadsheet, FileText, MapPin, Search, UserCircle2, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LoadingData } from "@/components/ui/loading";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function CobrosDia() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  // Configurar fecha actual (sin offset adicional)
  const todayDate = new Date();
  const [filterDate, setFilterDate] = useState(todayDate.toISOString().split('T')[0]);
  const [sortBy, setSortBy] = useState("direccion");

  // Cargar la lista de préstamos
  const { data: prestamos = [], isLoading: loadingPrestamos } = useQuery<Prestamo[]>({
    queryKey: ['/api/prestamos'],
  });

  // Cargar la lista de clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Filtrar préstamos que tienen pago programado para la fecha seleccionada
  const pagosDia = prestamos
    .filter(prestamo => {
      // Solo procesar préstamos activos
      if (prestamo.estado !== "ACTIVO") return false;
      
      // Usar directamente la próxima fecha de pago del préstamo
      // Esta es la forma más precisa y coherente con el resto del sistema
      const proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
      
      // Convertir a formato YYYY-MM-DD para comparar
      const fechaFormateada = proximaFechaPago.toISOString().split('T')[0];
      
      // Verificar si coincide con la fecha filtrada
      return fechaFormateada === filterDate;
    })
    .map(prestamo => {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      return { ...prestamo, cliente };
    })
    .filter(prestamo => {
      const clienteNombre = prestamo.cliente?.nombre || '';
      const clienteDireccion = prestamo.cliente?.direccion || '';
      const clienteTelefono = prestamo.cliente?.telefono || '';
      
      // Filtrar por término de búsqueda
      return (
        clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        clienteDireccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clienteTelefono.includes(searchTerm) ||
        prestamo.monto_prestado.toString().includes(searchTerm) ||
        prestamo.pago_semanal.toString().includes(searchTerm)
      );
    });

  // Ordenar por criterios específicos
  const sortedPagos = [...pagosDia].sort((a, b) => {
    if (sortBy === "direccion") {
      return (a.cliente?.direccion || '').localeCompare(b.cliente?.direccion || '');
    } else if (sortBy === "nombre") {
      return (a.cliente?.nombre || '').localeCompare(b.cliente?.nombre || '');
    } else if (sortBy === "monto") {
      return parseFloat(b.pago_semanal) - parseFloat(a.pago_semanal);
    }
    return 0;
  });

  const handleDownloadPDF = async () => {
    try {
      if (sortedPagos.length === 0) {
        toast({
          title: "No hay datos para exportar",
          description: "No hay cobros programados para esta fecha.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Generando PDF de ruta",
        description: "El PDF de la ruta de cobro se está generando...",
      });

      const doc = new jsPDF();
      
      // Título y encabezado
      doc.setFontSize(18);
      doc.text('Ruta de Cobros Diarios', 14, 20);
      
      doc.setFontSize(12);
      // Ya no necesitamos corregir la zona horaria
      const fechaPDF = new Date(filterDate);
      doc.text(`Fecha: ${formatDate(fechaPDF.toISOString().split('T')[0])}`, 14, 30);
      doc.text(`Total a cobrar: ${formatCurrency(totalACobrar)}`, 14, 38);
      doc.text(`Total de clientes: ${sortedPagos.length}`, 14, 46);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 54);
      
      // Crear tabla
      autoTable(doc, {
        startY: 60,
        head: [['Cliente', 'Dirección', 'Teléfono', 'Préstamo', 'Semana', 'A Cobrar']],
        body: sortedPagos.map(item => [
          item.cliente?.nombre || 'Cliente desconocido',
          item.cliente?.direccion || 'Sin dirección',
          item.cliente?.telefono || 'Sin teléfono',
          formatCurrency(item.monto_prestado),
          `${item.semanas_pagadas + 1}/${item.numero_semanas}`,
          formatCurrency(item.pago_semanal)
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
      
      // Si hay zonas, crear páginas adicionales con detalle por zonas
      if (Object.keys(zonas).length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Detalle por Zonas', 14, 20);
        doc.setFontSize(10);
        
        let yPos = 30;
        
        Object.entries(zonas).forEach(([zona, prestamos]) => {
          const totalZona = prestamos.reduce(
            (total, p) => total + parseFloat(p.pago_semanal), 0
          );
          
          // Si no hay espacio suficiente en la página actual, crear una nueva
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(12);
          doc.text(`Zona: ${zona}`, 14, yPos);
          doc.setFontSize(10);
          doc.text(`Total a cobrar: ${formatCurrency(totalZona)} - ${prestamos.length} clientes`, 14, yPos + 7);
          
          autoTable(doc, {
            startY: yPos + 10,
            head: [['Cliente', 'Teléfono', 'A Cobrar']],
            body: prestamos.map(item => [
              item.cliente?.nombre || 'Cliente desconocido',
              item.cliente?.telefono || 'Sin teléfono',
              formatCurrency(item.pago_semanal)
            ]),
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
          
          yPos = (doc as any).lastAutoTable.finalY + 15;
        });
      }
      
      // Guardar el PDF
      doc.save(`ruta_cobros_${filterDate}.pdf`);
      
      toast({
        title: "PDF generado",
        description: "La ruta de cobro ha sido generada exitosamente.",
      });
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error al generar el PDF de la ruta.",
        variant: "destructive",
      });
    }
  };
  
  const handleDownloadExcel = async () => {
    try {
      if (sortedPagos.length === 0) {
        toast({
          title: "No hay datos para exportar",
          description: "No hay cobros programados para esta fecha.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Generando Excel de ruta",
        description: "El archivo Excel de la ruta de cobro se está generando...",
      });
      
      // Preparar los datos para Excel
      // Usar nuestras funciones de utilidad para manejar fechas
      const excelData = [
        ['Ruta de Cobros Diarios', '', '', '', '', ''],
        [`Fecha: ${formatDate(filterDate)}`, '', '', '', '', ''],
        [`Total a cobrar: ${formatCurrency(totalACobrar)}`, '', '', '', '', ''],
        [`Total de clientes: ${sortedPagos.length}`, '', '', '', '', ''],
        [`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, '', '', '', '', ''],
        ['', '', '', '', '', ''],
        ['Cliente', 'Dirección', 'Teléfono', 'Préstamo', 'Semana', 'A Cobrar'],
      ];
      
      // Añadir los datos de todos los cobros
      sortedPagos.forEach(item => {
        excelData.push([
          item.cliente?.nombre || 'Cliente desconocido',
          item.cliente?.direccion || 'Sin dirección',
          item.cliente?.telefono || 'Sin teléfono',
          item.monto_prestado,
          `${item.semanas_pagadas + 1}/${item.numero_semanas}`,
          item.pago_semanal
        ]);
      });
      
      // Añadir una hoja con el detalle por zonas
      const zonasData = [
        ['Detalle por Zonas', '', '', ''],
        ['', '', '', ''],
      ];
      
      Object.entries(zonas).forEach(([zona, prestamos]) => {
        const totalZona = prestamos.reduce(
          (total, p) => total + parseFloat(p.pago_semanal), 0
        );
        
        zonasData.push([`Zona: ${zona}`, '', '', '']);
        zonasData.push([`Total a cobrar: ${formatCurrency(totalZona)}`, `Clientes: ${prestamos.length}`, '', '']);
        zonasData.push(['Cliente', 'Teléfono', 'Dirección', 'A Cobrar']);
        
        prestamos.forEach(item => {
          zonasData.push([
            item.cliente?.nombre || 'Cliente desconocido',
            item.cliente?.telefono || 'Sin teléfono',
            item.cliente?.direccion || 'Sin dirección',
            item.pago_semanal
          ]);
        });
        
        zonasData.push(['', '', '', '']);
      });
      
      // Crear el libro de trabajo y las hojas
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(excelData);
      const ws2 = XLSX.utils.aoa_to_sheet(zonasData);
      
      XLSX.utils.book_append_sheet(wb, ws1, "Ruta General");
      XLSX.utils.book_append_sheet(wb, ws2, "Por Zonas");
      
      // Generar el archivo y guardarlo
      XLSX.writeFile(wb, `ruta_cobros_${filterDate}.xlsx`);
      
      toast({
        title: "Excel generado",
        description: "El archivo Excel de la ruta de cobro ha sido generado exitosamente.",
      });
    } catch (error) {
      console.error("Error al generar Excel:", error);
      toast({
        title: "Error al generar Excel",
        description: "Ocurrió un error al generar el archivo Excel de la ruta.",
        variant: "destructive",
      });
    }
  };

  // Agrupar por zonas (usando las primeras palabras de la dirección como proxy para zonas)
  const obtenerZona = (direccion = '') => {
    const partes = direccion.split(' ');
    return partes.length > 0 ? partes[0] : 'Sin zona';
  };

  const zonas = sortedPagos.reduce((acc, item) => {
    const zona = obtenerZona(item.cliente?.direccion);
    if (!acc[zona]) {
      acc[zona] = [];
    }
    acc[zona].push(item);
    return acc;
  }, {} as Record<string, typeof sortedPagos>);

  const totalACobrar = sortedPagos.reduce((total, prestamo) => {
    return total + parseFloat(prestamo.pago_semanal);
  }, 0);

  const isLoading = loadingPrestamos || loadingClientes;

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Usar la fecha seleccionada directamente sin modificarla
    setFilterDate(event.target.value);
  };

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Cobros del Día</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Organiza tu ruta de cobros diarios</p>
        </div>
        
        <div className="flex flex-row items-center gap-2 mt-2 md:mt-0">
          <div className="relative flex-grow">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              className="pl-8 text-sm"
              value={filterDate}
              onChange={handleDateChange}
            />
          </div>
          
          <Button 
            variant="default"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white px-2 flex items-center gap-1"
            onClick={handleDownloadPDF}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            className="px-2 flex items-center gap-1"
            onClick={handleDownloadExcel}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Total a Cobrar</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-500">{formatCurrency(totalACobrar)}</div>
            <p className="text-xs md:text-sm text-muted-foreground">{sortedPagos.length} préstamos</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Fecha</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-500">
              {formatDate(filterDate)}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {new Date(filterDate).toLocaleDateString('es-ES', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())}
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-lg">Zonas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-500">{Object.keys(zonas).length}</div>
            <p className="text-xs md:text-sm text-muted-foreground">Áreas</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar cliente, teléfono, dirección..."
            className="pl-8 text-sm"
            value={searchTerm}
            autoComplete="off"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm.trim() !== "" && (
            <div className="absolute right-2 top-2.5 flex items-center">
              <span className="text-xs text-muted-foreground mr-2">
                {sortedPagos.length}
              </span>
              <button 
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        <Select 
          defaultValue="direccion" 
          onValueChange={setSortBy}
        >
          <SelectTrigger className="w-full md:w-40 text-sm h-9">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="direccion">Por dirección</SelectItem>
            <SelectItem value="nombre">Por nombre</SelectItem>
            <SelectItem value="monto">Por monto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Vista de cobros del día */}
      <Card className="shadow-sm">
        <CardHeader className="p-2">
          <Tabs defaultValue="zonas" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="zonas">Por Zonas</TabsTrigger>
              <TabsTrigger value="lista">Vista de Lista</TabsTrigger>
            </TabsList>
            
            <TabsContent value="lista" className="mt-2">
              {isLoading ? (
                <LoadingData text="Cargando cobros del día..." />
              ) : sortedPagos.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-medium">No hay cobros programados</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona otra fecha o revisa los préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  {/* Vista para móviles como tarjetas */}
                  <div className="md:hidden space-y-2 px-2">
                    {sortedPagos.map((item) => (
                      <Card key={item.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex justify-between mb-2">
                            <div className="font-semibold truncate mr-2">{item.cliente?.nombre || 'Cliente desconocido'}</div>
                            <div className="text-emerald-600 dark:text-emerald-500 font-semibold">
                              {formatCurrency(item.pago_semanal)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-1 text-sm">
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate text-muted-foreground">{item.cliente?.direccion || 'Sin dirección'}</span>
                            </div>
                            
                            <a 
                              href={`tel:${item.cliente?.telefono}`} 
                              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500 hover:underline"
                            >
                              📞 {item.cliente?.telefono || 'Sin teléfono'}
                            </a>
                            
                            <div className="flex items-center justify-between text-xs mt-1">
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs">
                                Semana {item.semanas_pagadas + 1}/{item.numero_semanas}
                              </Badge>
                              <span className="text-muted-foreground">
                                Préstamo: {formatCurrency(item.monto_prestado)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Vista para desktop como tabla */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Cliente</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Préstamo</TableHead>
                          <TableHead>Semana</TableHead>
                          <TableHead>Monto a Cobrar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPagos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.cliente?.nombre || 'Cliente desconocido'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-1">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <span>{item.cliente?.direccion || 'Sin dirección'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{item.cliente?.telefono || 'Sin teléfono'}</TableCell>
                            <TableCell>{formatCurrency(item.monto_prestado)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                {item.semanas_pagadas + 1}/{item.numero_semanas}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-emerald-600 dark:text-emerald-500">
                              {formatCurrency(item.pago_semanal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="zonas" className="mt-2">
              {isLoading ? (
                <LoadingData text="Cargando cobros por zonas..." />
              ) : Object.keys(zonas).length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-medium">No hay cobros programados</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona otra fecha o revisa los préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(zonas).map(([zona, prestamos]) => {
                    const totalZona = prestamos.reduce(
                      (total, p) => total + parseFloat(p.pago_semanal), 0
                    );
                    
                    return (
                      <Card key={zona} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="p-3 pb-2 bg-blue-50/50 dark:bg-blue-950/20">
                          <div className="flex justify-between items-center">
                            <div>
                              <CardTitle className="text-base md:text-lg flex items-center">
                                <MapPin className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                                Zona: {zona}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">{prestamos.length} cobros</p>
                            </div>
                            <div className="text-right">
                              <div className="text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-500">
                                {formatCurrency(totalZona)}
                              </div>
                              <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                          </div>
                        </CardHeader>
                        
                        {/* Vista móvil como tarjetas */}
                        <div className="md:hidden px-3 py-2 space-y-2">
                          {prestamos.map((item) => (
                            <div key={item.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                              <div className="flex justify-between mb-1">
                                <div className="font-semibold text-sm truncate mr-2">
                                  {item.cliente?.nombre || 'Cliente desconocido'}
                                </div>
                                <div className="text-emerald-600 dark:text-emerald-500 font-semibold text-sm">
                                  {formatCurrency(item.pago_semanal)}
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <a 
                                  href={`tel:${item.cliente?.telefono}`} 
                                  className="text-xs text-blue-600 dark:text-blue-500 hover:underline"
                                >
                                  📞 {item.cliente?.telefono || 'Sin teléfono'}
                                </a>
                                
                                <div className="text-xs text-muted-foreground truncate text-right">
                                  {item.cliente?.direccion || 'Sin dirección'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Vista desktop como tabla */}
                        <CardContent className="p-0 hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Cliente</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Monto a Cobrar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {prestamos.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {item.cliente?.nombre || 'Cliente desconocido'}
                                  </TableCell>
                                  <TableCell>{item.cliente?.direccion || 'Sin dirección'}</TableCell>
                                  <TableCell>{item.cliente?.telefono || 'Sin teléfono'}</TableCell>
                                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-500">
                                    {formatCurrency(item.pago_semanal)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>
      
      {/* Botón flotante para generar PDF en móviles */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          onClick={handleDownloadPDF}
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </Button>
      </div>
    </MainLayout>
  );
}