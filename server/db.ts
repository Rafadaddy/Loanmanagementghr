import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Variable para rastrear si estamos usando una base de datos real o no
export const usingRealDatabase = !!process.env.DATABASE_URL;

let pool;
let db;

if (process.env.DATABASE_URL) {
  // Configuración para entorno de desarrollo con base de datos PostgreSQL
  console.log("Usando base de datos PostgreSQL");
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
} else {
  // Configuración para despliegue sin base de datos PostgreSQL
  console.log("DATABASE_URL no encontrada, configurando para modo de despliegue");
  // Creamos objetos mock que serán reemplazados en storage.ts
  pool = {};
  db = {
    select: () => ({ from: () => [] }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
    delete: () => ({ where: () => [] })
  };
}

export { pool, db };
