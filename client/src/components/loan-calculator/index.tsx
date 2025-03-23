import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { CalculoPrestamo, ResultadoCalculoPrestamo } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ChartConfig } from "@/components/ui/chart";
import { 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

// Configuración para el gráfico
const chartConfig: ChartConfig = {
  principal: {
    label: "Principal",
    color: "#3B82F6", // blue-500
  },
  interes: {
    label: "Interés",
    color: "#EF4444", // red-500
  },
  total: {
    label: "Total",
    color: "#10B981", // emerald-500
  },
};

interface Pago {
  semana: number;
  fecha: string;
  pago: number;
  principal: number;
  interes: number;
  balance: number;
}

interface LoanCalculatorProps {
  onSave?: (data: {
    monto: number;
    tasa: number;
    semanas: number;
    pagoSemanal: number;
    montoTotal: number;
  }) => void;
  className?: string;
}

export default function LoanCalculator({ onSave, className = "" }: LoanCalculatorProps) {
  const { toast } = useToast();
  const [monto, setMonto] = useState<number>(5000);
  const [tasa, setTasa] = useState<number>(10);
  const [semanas, setSemanas] = useState<number>(12);
  const [resultado, setResultado] = useState<ResultadoCalculoPrestamo | null>(null);
  const [amortizacion, setAmortizacion] = useState<Pago[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  // Mutation para calcular préstamo
  const calcularMutation = useMutation({
    mutationFn: async (datos: CalculoPrestamo) => {
      const res = await apiRequest("POST", "/api/calcular-prestamo", datos);
      return res.json() as Promise<ResultadoCalculoPrestamo>;
    },
    onSuccess: (data) => {
      setResultado(data);
      generarAmortizacion(monto, tasa, semanas, data.pago_semanal);
    },
    onError: (error) => {
      toast({
        title: "Error al calcular",
        description: `No se pudo calcular el préstamo: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Generar tabla de amortización
  const generarAmortizacion = (
    monto: number, 
    tasa: number, 
    semanas: number, 
    pagoSemanal: number
  ) => {
    const hoy = new Date();
    let balance = monto;
    const interesSemanal = tasa / 100 / semanas;
    const pagos: Pago[] = [];
    const chartPoints: any[] = [];
    
    let totalPrincipal = 0;
    let totalInteres = 0;

    for (let i = 1; i <= semanas; i++) {
      // Calcular fecha de pago (i semanas desde hoy)
      const fechaPago = new Date(hoy);
      fechaPago.setDate(fechaPago.getDate() + (i * 7));
      
      // Calcular interés para esta semana
      const interesPago = balance * interesSemanal;
      
      // Calcular cuánto del pago va a principal
      let principalPago = pagoSemanal - interesPago;
      
      // Ajustar el último pago si es necesario
      if (i === semanas) {
        principalPago = balance;
      }
      
      // Actualizar balance
      balance = Math.max(0, balance - principalPago);
      
      // Acumular totales
      totalPrincipal += principalPago;
      totalInteres += interesPago;
      
      // Añadir a la tabla de amortización
      pagos.push({
        semana: i,
        fecha: fechaPago.toISOString().split('T')[0],
        pago: pagoSemanal,
        principal: principalPago,
        interes: interesPago,
        balance: balance
      });
      
      // Añadir punto para el gráfico
      chartPoints.push({
        semana: i,
        principal: totalPrincipal,
        interes: totalInteres,
        total: totalPrincipal + totalInteres
      });
    }
    
    setAmortizacion(pagos);
    setChartData(chartPoints);
  };

  // Calcular préstamo cuando cambien los valores
  useEffect(() => {
    const timer = setTimeout(() => {
      calcularMutation.mutate({
        monto_prestado: monto,
        tasa_interes: tasa,
        numero_semanas: semanas
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [monto, tasa, semanas]);

  const handleSave = () => {
    if (resultado && onSave) {
      onSave({
        monto,
        tasa,
        semanas,
        pagoSemanal: resultado.pago_semanal,
        montoTotal: resultado.monto_total_pagar
      });
    }
  };

  return (
    <Card className={`shadow-md ${className}`}>
      <CardHeader>
        <CardTitle>Calculadora de Préstamos</CardTitle>
        <CardDescription>
          Calcula cuotas y proyecta intereses en tiempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles de entrada */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="monto">Monto del Préstamo</Label>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="monto"
                  type="number"
                  className="pl-6"
                  value={monto}
                  onChange={(e) => setMonto(Number(e.target.value))}
                  min={1000}
                  max={50000}
                  step={1000}
                />
              </div>
            </div>
            <Slider
              value={[monto]}
              min={1000}
              max={50000}
              step={1000}
              onValueChange={(value) => setMonto(value[0])}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$1,000</span>
              <span>$25,000</span>
              <span>$50,000</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="tasa">Tasa de Interés</Label>
              <div className="relative w-32">
                <Input
                  id="tasa"
                  type="number"
                  className="pr-6"
                  value={tasa}
                  onChange={(e) => setTasa(Number(e.target.value))}
                  min={1}
                  max={100}
                  step={0.5}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[tasa]}
              min={1}
              max={50}
              step={0.5}
              onValueChange={(value) => setTasa(value[0])}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="semanas">Número de Semanas</Label>
              <div className="w-32">
                <Input
                  id="semanas"
                  type="number"
                  value={semanas}
                  onChange={(e) => setSemanas(Number(e.target.value))}
                  min={4}
                  max={52}
                  step={1}
                />
              </div>
            </div>
            <Slider
              value={[semanas]}
              min={4}
              max={52}
              step={1}
              onValueChange={(value) => setSemanas(value[0])}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>4 semanas</span>
              <span>26 semanas</span>
              <span>52 semanas</span>
            </div>
          </div>
        </div>
        
        {/* Resumen del préstamo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Monto Total a Pagar</p>
            <p className="text-lg font-semibold text-foreground">
              {resultado 
                ? formatCurrency(resultado.monto_total_pagar)
                : formatCurrency(0)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Pago Semanal</p>
            <p className="text-lg font-semibold text-foreground">
              {resultado 
                ? formatCurrency(resultado.pago_semanal)
                : formatCurrency(0)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Interés Total</p>
            <p className="text-lg font-semibold text-foreground">
              {resultado 
                ? formatCurrency(resultado.monto_total_pagar - monto)
                : formatCurrency(0)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Tasa Efectiva</p>
            <p className="text-lg font-semibold text-foreground">
              {resultado 
                ? `${((resultado.monto_total_pagar / monto - 1) * 100).toFixed(2)}%`
                : "0.00%"}
            </p>
          </div>
        </div>
        
        {/* Tabs de proyección */}
        <Tabs defaultValue="grafico" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            <TabsTrigger value="tabla">Tabla de Amortización</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grafico" className="p-2">
            <div className="h-[250px] mt-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="semana" 
                      label={{ value: 'Semana', position: 'insideBottomRight', offset: -5 }}
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${formatCurrency(value)}`, '']}
                      labelFormatter={(label) => `Semana ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{
                        color: 'var(--foreground)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="principal" 
                      name="Principal" 
                      stroke={chartConfig.principal.color} 
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="interes" 
                      name="Interés" 
                      stroke={chartConfig.interes.color} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      name="Total" 
                      stroke={chartConfig.total.color} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Calculando proyección...</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="tabla">
            <div className="border rounded-md overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Semana</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs text-right">Pago</TableHead>
                    <TableHead className="text-xs text-right">Principal</TableHead>
                    <TableHead className="text-xs text-right">Interés</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amortizacion.map((pago) => (
                    <TableRow key={pago.semana}>
                      <TableCell className="text-xs">{pago.semana}</TableCell>
                      <TableCell className="text-xs">{pago.fecha}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(pago.pago)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(pago.principal)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(pago.interes)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(pago.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
        
        {onSave && (
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={!resultado}
            >
              Usar estos valores
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}