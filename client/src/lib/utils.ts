import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string) {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(numAmount);
}

/**
 * Normaliza una fecha en formato ISO YYYY-MM-DD.
 * Esta función asegura que tengamos una representación unificada de fechas en todo el sistema
 * sin problemas de zona horaria.
 */
export function normalizeDate(date: Date | string): string {
  if (!date) return "";
  
  // Si es un string, asegurar que sea una fecha válida
  if (typeof date === 'string') {
    // Si es formato ISO, extraer solo la parte de la fecha
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    
    // Si es un formato de fecha simple (YYYY-MM-DD), usarlo directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Convertir a Fecha y luego a formato ISO
    const dateObj = new Date(date);
    return dateObj.toISOString().split('T')[0];
  }
  
  // Si es una instancia de Date, convertir a ISO y tomar solo la parte de fecha
  return date.toISOString().split('T')[0];
}

/**
 * Crea una fecha nueva con correcto manejo de timezone.
 * Acepta tanto formato YYYY-MM-DD como instancias de Date.
 * Garantiza que se muestre la fecha exacta ingresada, sin ajustes de zona horaria.
 */
export function createConsistentDate(date: Date | string): Date {
  // Normalizar primero a formato YYYY-MM-DD
  const normalizedDate = normalizeDate(date);
  
  // Separar el año, mes y día
  const [year, month, day] = normalizedDate.split('-').map(Number);
  
  // Crear la fecha usando el constructor que respeta la fecha local
  // month-1 porque en JavaScript los meses son 0-indexados
  return new Date(year, month-1, day, 12, 0, 0);
}

/**
 * Calcula una fecha en el futuro a partir de otra, añadiendo los días especificados.
 * Esta función asegura que el día calculado sea exactamente 'days' después
 * del día indicado, sin problemas de zona horaria.
 */
export function addDaysToDate(date: Date | string, days: number): string {
  // Normalizar primero el formato de la fecha a YYYY-MM-DD
  const normalizedDate = normalizeDate(date);
  
  // Separar la fecha en componentes
  const [year, month, day] = normalizedDate.split('-').map(Number);
  
  // Crear una fecha UTC para evitar problemas de zona horaria
  // Nota: month-1 porque los meses en JavaScript son 0-indexados
  const utcDate = new Date(Date.UTC(year, month-1, day, 12, 0, 0));
  
  // Agregar los días (usando 12:00 UTC asegura que no hay problemas de DST)
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  
  // Convertir de vuelta a formato YYYY-MM-DD
  return utcDate.toISOString().split('T')[0];
}

export function formatDate(date: Date | string) {
  if (!date) return "-";
  
  // Usar nuestra función de creación de fecha consistente
  const consistentDate = createConsistentDate(date);
  
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(consistentDate);
}

export function getShortDate(date: Date | string) {
  // Usar nuestra función de creación de fecha consistente
  const consistentDate = createConsistentDate(date);
  
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(consistentDate);
}

export function formatTime(date: Date | string) {
  // Usar nuestra función de creación de fecha consistente
  const consistentDate = createConsistentDate(date);
  
  return new Intl.DateTimeFormat("es-ES", {
    hour: "numeric",
    minute: "numeric",
  }).format(consistentDate);
}

export function getDateTimeFormat(date: Date | string) {
  // Usar nuestra función de creación de fecha consistente
  const consistentDate = createConsistentDate(date);
  
  return `${getShortDate(consistentDate)}, ${formatTime(consistentDate)}`;
}

// Formato de fecha para tablas: DD/MM/YYYY
export function formatTableDate(date: Date | string) {
  if (!date) return "-";
  
  // Usar nuestra función de creación de fecha consistente
  const consistentDate = createConsistentDate(date);
  
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
  }).format(consistentDate);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getLoanStatus(status: string) {
  switch (status) {
    case "ACTIVO":
      return { label: "Activo", className: "bg-blue-100 text-blue-800" };
    case "PAGADO":
      return { label: "Pagado", className: "bg-green-100 text-green-800" };
    case "ATRASO":
      return { label: "Atrasado", className: "bg-red-100 text-red-800" };
    case "ATRASADO": // Mantener compatibilidad por si hay datos antiguos
      return { label: "Atrasado", className: "bg-red-100 text-red-800" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-800" };
  }
}

export function getPaymentStatus(status: string) {
  switch (status) {
    case "A_TIEMPO":
      return { label: "A tiempo", className: "bg-green-100 text-green-800" };
    case "ATRASADO":
      return { label: "Atrasado", className: "bg-red-100 text-red-800" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-800" };
  }
}
