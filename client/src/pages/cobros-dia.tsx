import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getDateTimeFormat, getShortDate } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileSpreadsheet, FileText, MapPin, Search, X } from "lucide-react";
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
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortBy, setSortBy] = useState("direccion");

  // Cargar la lista de préstamos
  const { data: prestamos = [], isLoading: loadingPrestamos } = useQuery<Prestamo[]>({
    queryKey: ['/api/prestamos'],
  });

  // Cargar la lista de clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Filtrar préstamos que tienen pago hoy o en una fecha específica
  const pagosDia = prestamos
    .filter(prestamo => {
      // Convertimos las fechas a formato yyyy-mm-dd para evitar problemas por horas
      const fechaPrestamo = new Date(prestamo.proxima_fecha_pago);
      const fechaStr = fechaPrestamo.toISOString().split('T')[0];
      
      return fechaStr === filterDate && prestamo.estado === "ACTIVO";
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
      doc.text(`Fecha: ${formatDate(filterDate)}`, 14, 30);
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
            <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-500">{formatDate(filterDate)}</div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {new Date(filterDate).toLocaleDateString('es-ES', { weekday: 'long' })}
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
        
        <div className="flex flex-row gap-2">
          {/* Ordenar por */}
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
                  <div className="block sm:hidden space-y-3 px-2">
                    {sortedPagos.map((prestamo) => (
                      <div
                        key={prestamo.id}
                        className="border rounded-lg p-3 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium">
                              {prestamo.cliente?.nombre || "Cliente sin nombre"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {prestamo.cliente?.telefono || "Sin teléfono"}
                            </p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                            {formatCurrency(prestamo.pago_semanal)}
                          </Badge>
                        </div>
                        <div className="flex flex-col text-xs">
                          <div className="flex justify-between py-1 border-b">
                            <span className="text-muted-foreground">Dirección:</span>
                            <span className="font-medium text-right">
                              {prestamo.cliente?.direccion || "Sin dirección"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b">
                            <span className="text-muted-foreground">Préstamo:</span>
                            <span className="font-medium">
                              {formatCurrency(prestamo.monto_prestado)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Semana:</span>
                            <span className="font-medium">
                              {prestamo.semanas_pagadas + 1}/{prestamo.numero_semanas}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Vista de tabla para escritorio */}
                  <div className="hidden sm:block">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead className="text-right">Préstamo</TableHead>
                          <TableHead className="text-center">Semana</TableHead>
                          <TableHead className="text-right">A Cobrar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPagos.map((prestamo) => (
                          <TableRow key={prestamo.id}>
                            <TableCell className="font-medium py-2">
                              {prestamo.cliente?.nombre || "Cliente sin nombre"}
                            </TableCell>
                            <TableCell className="py-2">
                              {prestamo.cliente?.direccion || "Sin dirección"}
                            </TableCell>
                            <TableCell className="py-2">
                              {prestamo.cliente?.telefono || "Sin teléfono"}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              {formatCurrency(prestamo.monto_prestado)}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {prestamo.semanas_pagadas + 1}/{prestamo.numero_semanas}
                            </TableCell>
                            <TableCell className="text-right font-medium py-2">
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                {formatCurrency(prestamo.pago_semanal)}
                              </Badge>
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
                <LoadingData text="Cargando zonas..." />
              ) : sortedPagos.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-medium">No hay cobros programados</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona otra fecha o revisa los préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {Object.entries(zonas).map(([zona, prestamos]) => {
                    const totalZona = prestamos.reduce(
                      (total, p) => total + parseFloat(p.pago_semanal), 0
                    );
                    
                    return (
                      <Card key={zona} className="overflow-hidden">
                        <CardHeader className="py-2 px-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm md:text-base">
                              Zona: {zona}
                            </CardTitle>
                            <div className="text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-500">
                              {formatCurrency(totalZona)} ({prestamos.length})
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {/* Vista móvil como lista simple */}
                          <div className="block sm:hidden">
                            <div className="divide-y">
                              {prestamos.map((prestamo) => (
                                <div
                                  key={prestamo.id}
                                  className="flex justify-between items-center p-2 hover:bg-muted/50"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">
                                      {prestamo.cliente?.nombre || "Cliente desconocido"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {prestamo.cliente?.telefono || "Sin teléfono"}
                                    </span>
                                  </div>
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                    {formatCurrency(prestamo.pago_semanal)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Vista de escritorio como tabla */}
                          <div className="hidden sm:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Cliente</TableHead>
                                  <TableHead>Teléfono</TableHead>
                                  <TableHead className="text-right">A Cobrar</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {prestamos.map((prestamo) => (
                                  <TableRow key={prestamo.id}>
                                    <TableCell className="py-1 md:py-2">
                                      {prestamo.cliente?.nombre || "Cliente desconocido"}
                                    </TableCell>
                                    <TableCell className="py-1 md:py-2">
                                      {prestamo.cliente?.telefono || "Sin teléfono"}
                                    </TableCell>
                                    <TableCell className="text-right py-1 md:py-2">
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                        {formatCurrency(prestamo.pago_semanal)}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
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
    </MainLayout>
  );
}