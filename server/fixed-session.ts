// Archivo especial para resolver los problemas de Session Store
import session from 'express-session';
import pg from 'pg';
// En ES modules, usamos importaciones dinámicas pero en tiempo de startup

// Creamos nuestro propio store con un enfoque simplificado
export function createSessionStore(usePostgres: boolean = false) {
  // Siempre usamos el store por defecto para evitar problemas con require()
  // en ES modules
  try {
    console.log("Usando store por defecto de express-session");
    return new session.MemoryStore();
  } catch (error) {
    console.error("Error crítico al crear store de sesión:", error);
    throw error; // Propagamos el error para que sea visible
  }
}