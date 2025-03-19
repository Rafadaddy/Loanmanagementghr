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

export function formatDate(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

export function getShortDate(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dateObj);
}

export function formatTime(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    hour: "numeric",
    minute: "numeric",
  }).format(dateObj);
}

export function getDateTimeFormat(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return `${getShortDate(dateObj)}, ${formatTime(dateObj)}`;
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
