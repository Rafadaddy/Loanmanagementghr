import { pgTable, text, serial, numeric, timestamp, date, integer, boolean, check, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Usuarios para autenticación
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nombre: text("nombre").notNull(),
  rol: text("rol").default("USUARIO").notNull(), // Roles: ADMIN, USUARIO, COBRADOR
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  nombre: true,
  rol: true,
});

// Tabla de cobradores (usuarios con rol de cobrador)
export const cobradores = pgTable("cobradores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id),
  zona: text("zona").notNull(),
  activo: boolean("activo").default(true).notNull(),
});

export const insertCobradorSchema = createInsertSchema(cobradores).omit({
  id: true,
});

// Tabla de clientes
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  direccion: text("direccion").notNull(),
  documento_identidad: text("documento_identidad").notNull(),
  email: text("email"),
  notas: text("notas"),
  fecha_registro: timestamp("fecha_registro").defaultNow().notNull(),
  cobrador_id: integer("cobrador_id")
    .references(() => cobradores.id),
  ruta: text("ruta"), // Para organizar en rutas específicas dentro de la zona del cobrador
});

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  fecha_registro: true,
});

// Tabla de préstamos
export const prestamos = pgTable("prestamos", {
  id: serial("id").primaryKey(),
  cliente_id: integer("cliente_id")
    .notNull()
    .references(() => clientes.id),
  monto_prestado: numeric("monto_prestado", { precision: 10, scale: 2 }).notNull(),
  tasa_interes: numeric("tasa_interes", { precision: 5, scale: 2 }).notNull(),
  tasa_mora: numeric("tasa_mora", { precision: 5, scale: 2 }).default("5").notNull(),
  fecha_prestamo: date("fecha_prestamo").notNull(),
  frecuencia_pago: text("frecuencia_pago").default("SEMANAL").notNull(),
  estado: text("estado")
    .default("ACTIVO")
    .notNull(),
  monto_total_pagar: numeric("monto_total_pagar", { precision: 10, scale: 2 }).notNull(),
  numero_semanas: integer("numero_semanas").default(12).notNull(),
  pago_semanal: numeric("pago_semanal", { precision: 10, scale: 2 }).default("0").notNull(),
  semanas_pagadas: integer("semanas_pagadas").default(0).notNull(),
  proxima_fecha_pago: date("proxima_fecha_pago").notNull(),
  dias_atraso: integer("dias_atraso").default(0).notNull(),
  monto_mora_acumulada: numeric("monto_mora_acumulada", { precision: 10, scale: 2 }).default("0").notNull(),
  fecha_inicial_personalizada: date("fecha_inicial_personalizada"), // Fecha personalizada para la primera cuota
  dia_pago: integer("dia_pago"), // Día de la semana para los pagos (0-6, donde 0 es domingo)
  cronograma_eliminado: boolean("cronograma_eliminado").default(false) // Indica si el cronograma ha sido eliminado manualmente
});

export const insertPrestamoSchema = createInsertSchema(prestamos).omit({
  id: true,
  estado: true,
  semanas_pagadas: true,
});

// Tabla de pagos
export const pagos = pgTable("pagos", {
  id: serial("id").primaryKey(),
  prestamo_id: integer("prestamo_id")
    .notNull()
    .references(() => prestamos.id),
  monto_pagado: numeric("monto_pagado", { precision: 10, scale: 2 }).notNull(),
  monto_mora: numeric("monto_mora", { precision: 10, scale: 2 }).default("0").notNull(),
  fecha_pago: timestamp("fecha_pago").defaultNow().notNull(),
  numero_semana: integer("numero_semana").default(1).notNull(),
  estado: text("estado")
    .default("A_TIEMPO")
    .notNull(),
  es_pago_parcial: text("es_pago_parcial").default("false").notNull(),
  monto_restante: numeric("monto_restante", { precision: 10, scale: 2 }).default("0").notNull(),
});

export const insertPagoSchema = createInsertSchema(pagos).omit({
  id: true,
});

// Tipos exportados
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCobrador = z.infer<typeof insertCobradorSchema>;
export type Cobrador = typeof cobradores.$inferSelect;

export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientes.$inferSelect;

export type InsertPrestamo = z.infer<typeof insertPrestamoSchema>;
export type Prestamo = typeof prestamos.$inferSelect;

export type InsertPago = z.infer<typeof insertPagoSchema>;
export type Pago = typeof pagos.$inferSelect;

// Schema para cálculo de préstamo
export const calculoPrestamoSchema = z.object({
  monto_prestado: z.number().positive("El monto debe ser positivo"),
  tasa_interes: z.number().positive("La tasa debe ser positiva"),
  numero_semanas: z.number().int().positive("Las semanas deben ser un número positivo"),
});

export type CalculoPrestamo = z.infer<typeof calculoPrestamoSchema>;

// Resultado de cálculo
export interface ResultadoCalculoPrestamo {
  monto_total_pagar: number;
  pago_semanal: number;
}

// Movimientos de caja
export const movimientosCaja = pgTable("movimientos_caja", {
  id: serial("id").primaryKey(),
  
  // Datos del movimiento
  tipo: text("tipo").notNull().$type<'INGRESO' | 'EGRESO'>(),  // INGRESO, EGRESO
  categoria: text("categoria").notNull(), // PRESTAMO, PAGO, NOMINA, GASOLINA, OTRO
  
  // Montos
  monto: text("monto").notNull(),
  
  // Referencias opcionales
  prestamo_id: integer("prestamo_id"), // Opcional, solo si es un INGRESO por PRESTAMO o EGRESO por PAGO
  cliente_id: integer("cliente_id"),   // Opcional, solo si es un INGRESO por PRESTAMO
  
  // Metadatos
  descripcion: text("descripcion"),
  fecha: timestamp("fecha").notNull().defaultNow(),
  creado_por: integer("creado_por").notNull(), // ID del usuario que registró
});

// Primero creamos el esquema base para los movimientos de caja
const baseMovimientoCajaSchema = createInsertSchema(movimientosCaja)
  .omit({ id: true });

// Luego creamos un esquema extendido que permite strings de fecha ISO
export const insertMovimientoCajaSchema = baseMovimientoCajaSchema.extend({
  fecha: z.union([
    z.date(), // Mantiene compatibilidad con Date
    z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "La fecha debe ser un string ISO válido",
    })  // Permite strings ISO
  ]),
});

export type InsertMovimientoCaja = z.infer<typeof insertMovimientoCajaSchema>;
export type MovimientoCaja = typeof movimientosCaja.$inferSelect;
