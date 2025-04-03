import * as schema from "@shared/schema";

// Ya no usamos NeonDB, ahora utilizamos JsonStorage para almacenamiento persistente
console.log("Usando almacenamiento JSON local para persistencia de datos");

// Configuración para mantener compatibilidad con el código existente
export const usingRealDatabase = false;

// Objetos mock para mantener compatibilidad con código existente
export const pool = {};
export const db = {
  select: () => ({ from: () => [], where: () => [] }),
  insert: () => ({ values: () => ({ returning: () => [] }) }),
  update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
  delete: () => ({ where: () => [] })
};
