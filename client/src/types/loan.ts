// Tipos compartidos para préstamos y componentes relacionados
export interface PrestamoDisplay {
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
  fecha_inicial_personalizada?: string | null;
  dia_pago?: number | null;
  cronograma_eliminado?: boolean;
}

export interface PagoDisplay {
  id: number;
  prestamo_id: number;
  monto_pagado: string;
  fecha_pago: string | Date;
  numero_semana: number;
  estado: string;
  es_pago_parcial: string;
  monto_restante: string;
  monto_mora?: string;
}