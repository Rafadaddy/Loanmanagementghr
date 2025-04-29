import * as schema from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";

// Determinar si estamos en entorno de producción
const isProduction = process.env.NODE_ENV === 'production' || 
                    process.env.REPL_SLUG || 
                    process.env.REPL_OWNER;

// Configuración para determinar si usamos base de datos real o almacenamiento JSON
export const usingRealDatabase = isProduction;

let realDb;
let realPool;

if (usingRealDatabase && process.env.DATABASE_URL) {
  // En producción, usamos PostgreSQL
  console.log("Configurando conexión a PostgreSQL para producción");
  try {
    // Crear el pool de conexiones con configuración SSL modificada
    realPool = postgres(process.env.DATABASE_URL, { 
      ssl: {
        rejectUnauthorized: false // Permitir certificados autofirmados
      },
      max: 10
    });
    
    // Crear instancia de drizzle
    realDb = drizzle(realPool, { schema });
    
    console.log("Conexión a PostgreSQL establecida correctamente");
  } catch (error) {
    console.error("Error al conectar con PostgreSQL:", error);
    process.exit(1);
  }
} else {
  // En desarrollo, usamos almacenamiento JSON local
  console.log("Usando almacenamiento JSON local para persistencia de datos");
  
  // Objetos mock para mantener compatibilidad
  realPool = {};
  realDb = {
    select: () => ({ from: () => [], where: () => [] }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
    delete: () => ({ where: () => [] })
  };
}

// Exportar pool y db
export const pool = realPool;
export const db = realDb;
