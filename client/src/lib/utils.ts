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
 */
export function createConsistentDate(date: Date | string): Date {
  // Normalizar primero a formato YYYY-MM-DD
  const normalizedDate = normalizeDate(date);
  
  // Crear fecha a media noche UTC para evitar problemas de zona horaria
  return new Date(`${normalizedDate}T00:00:00Z`);
}

/**
 * Calcula una fecha en el futuro a partir de otra, añadiendo los días especificados.
 */
export function addDaysToDate(date: Date | string, days: number): string {
  const baseDate = createConsistentDate(date);
  baseDate.setDate(baseDate.getDate() + days);
  return normalizeDate(baseDate);
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
    case "ATRASADO":
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
