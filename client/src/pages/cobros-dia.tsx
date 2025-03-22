import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getDateTimeFormat, getShortDate } from "@/lib/utils";
import MainLayout from "@/components/layout/main-layout";
import { Prestamo, Cliente } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Search, X } from "lucide-react";
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
      const proxima_fecha = new Date(prestamo.proxima_fecha_pago).toISOString().split('T')[0];
      return proxima_fecha === filterDate && prestamo.estado === "ACTIVO";
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

  const handleDownloadRuta = async () => {
    try {
      toast({
        title: "Generando PDF de ruta",
        description: "El PDF de la ruta de cobro se está generando...",
      });

      // Esta es una función simulada. Aquí implementarías la descarga real del PDF
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "PDF generado",
        description: "La ruta de cobro ha sido generada exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error al generar PDF",
        description: "Ocurrió un error al generar el PDF de la ruta.",
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cobros del Día</h1>
          <p className="text-sm text-gray-600">Organiza tu ruta de cobros diarios</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="date"
              className="pl-8"
              value={filterDate}
              onChange={handleDateChange}
            />
          </div>
          
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={handleDownloadRuta}
          >
            Generar PDF de Ruta
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total a Cobrar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalACobrar)}</div>
            <p className="text-sm text-gray-500">{sortedPagos.length} préstamos activos</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Fecha de Cobro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatDate(filterDate)}</div>
            <p className="text-sm text-gray-500">
              {new Date(filterDate).toLocaleDateString('es-ES', { weekday: 'long' })}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Zonas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{Object.keys(zonas).length}</div>
            <p className="text-sm text-gray-500">Áreas de cobro</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <CardTitle>Lista de Cobros</CardTitle>
            
            <div className="flex flex-col md:flex-row gap-2 mt-3 md:mt-0">
              <Select 
                defaultValue="direccion" 
                onValueChange={setSortBy}
              >
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direccion">Por dirección</SelectItem>
                  <SelectItem value="nombre">Por nombre</SelectItem>
                  <SelectItem value="monto">Por monto</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Buscar cliente o préstamo..."
                  className="pl-8 w-full md:w-64 bg-gray-50"
                  value={searchTerm}
                  autoComplete="off"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm.trim() !== "" && (
                  <div className="absolute right-2 top-2.5 flex items-center">
                    <span className="text-xs text-gray-500 mr-2">
                      {sortedPagos.length} coincidencias
                    </span>
                    <button 
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="lista">
            <TabsList className="mb-4">
              <TabsTrigger value="lista">Vista de Lista</TabsTrigger>
              <TabsTrigger value="zonas">Por Zonas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="lista">
              {isLoading ? (
                <LoadingData text="Cargando cobros del día..." />
              ) : sortedPagos.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No hay cobros programados para esta fecha</h3>
                  <p className="text-gray-500 mt-2">
                    Selecciona otra fecha o revisa que existan préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span>{item.cliente?.direccion || 'Sin dirección'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{item.cliente?.telefono || 'Sin teléfono'}</TableCell>
                          <TableCell>{formatCurrency(item.monto_prestado)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {item.semanas_pagadas + 1}/{item.numero_semanas}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(item.pago_semanal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="zonas">
              {isLoading ? (
                <LoadingData text="Cargando cobros por zonas..." />
              ) : Object.keys(zonas).length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No hay cobros programados para esta fecha</h3>
                  <p className="text-gray-500 mt-2">
                    Selecciona otra fecha o revisa que existan préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(zonas).map(([zona, prestamos]) => {
                    const totalZona = prestamos.reduce(
                      (total, p) => total + parseFloat(p.pago_semanal), 0
                    );
                    
                    return (
                      <Card key={zona} className="overflow-hidden border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2 bg-blue-50/50">
                          <div className="flex justify-between items-center">
                            <div>
                              <CardTitle className="text-lg flex items-center">
                                <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                                Zona: {zona}
                              </CardTitle>
                              <p className="text-sm text-gray-500">{prestamos.length} cobros</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrency(totalZona)}
                              </div>
                              <p className="text-xs text-gray-500">Total a cobrar</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
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
                                  <TableCell className="font-semibold text-green-600">
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
        </CardContent>
      </Card>
    </MainLayout>
  );
}