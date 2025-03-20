import { Cliente, InsertCliente, Prestamo, InsertPrestamo, Pago, InsertPago, User, InsertUser, ResultadoCalculoPrestamo, CalculoPrestamo } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { addDays, format } from "date-fns";

const MemoryStore = createMemoryStore(session);

// Interfaz de almacenamiento
export interface IStorage {
  // Autenticación
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Clientes
  getAllClientes(): Promise<Cliente[]>;
  getCliente(id: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined>;
  deleteCliente(id: number): Promise<boolean>;
  
  // Préstamos
  getAllPrestamos(): Promise<Prestamo[]>;
  getPrestamosByClienteId(clienteId: number): Promise<Prestamo[]>;
  getPrestamo(id: number): Promise<Prestamo | undefined>;
  createPrestamo(prestamo: InsertPrestamo): Promise<Prestamo>;
  updatePrestamo(id: number, prestamo: Partial<Prestamo>): Promise<Prestamo | undefined>;
  
  // Pagos
  getAllPagos(): Promise<Pago[]>;
  getPagosByPrestamoId(prestamoId: number): Promise<Pago[]>;
  createPago(pago: InsertPago): Promise<Pago>;
  
  // Cálculos
  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo;
  
  // Sesión
  sessionStore: any; // Tipo simplificado para la store de sesión
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clientes: Map<number, Cliente>;
  private prestamos: Map<number, Prestamo>;
  private pagos: Map<number, Pago>;
  private currentUserId: number;
  private currentClienteId: number;
  private currentPrestamoId: number;
  private currentPagoId: number;
  sessionStore: any; // Tipo simplificado para la store de sesión

  constructor() {
    this.users = new Map();
    this.clientes = new Map();
    this.prestamos = new Map();
    this.pagos = new Map();
    this.currentUserId = 1;
    this.currentClienteId = 1;
    this.currentPrestamoId = 1;
    this.currentPagoId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 horas
    });
  }

  // Métodos para usuarios
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Métodos para clientes
  async getAllClientes(): Promise<Cliente[]> {
    return Array.from(this.clientes.values());
  }

  async getCliente(id: number): Promise<Cliente | undefined> {
    return this.clientes.get(id);
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const id = this.currentClienteId++;
    const nuevaFechaRegistro = new Date();
    const nuevoCliente: Cliente = { 
      ...cliente, 
      id, 
      fecha_registro: nuevaFechaRegistro 
    };
    
    this.clientes.set(id, nuevoCliente);
    return nuevoCliente;
  }

  async updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined> {
    const clienteExistente = this.clientes.get(id);
    if (!clienteExistente) {
      return undefined;
    }
    
    const clienteActualizado: Cliente = { 
      ...clienteExistente, 
      ...cliente 
    };
    
    this.clientes.set(id, clienteActualizado);
    return clienteActualizado;
  }
  
  async deleteCliente(id: number): Promise<boolean> {
    const clienteExistente = this.clientes.get(id);
    if (!clienteExistente) {
      return false;
    }
    
    // Verificar si existen préstamos asociados al cliente
    const prestamosCliente = await this.getPrestamosByClienteId(id);
    if (prestamosCliente.length > 0) {
      // No permitir eliminar clientes con préstamos
      return false;
    }
    
    return this.clientes.delete(id);
  }

  // Métodos para préstamos
  async getAllPrestamos(): Promise<Prestamo[]> {
    return Array.from(this.prestamos.values());
  }

  async getPrestamosByClienteId(clienteId: number): Promise<Prestamo[]> {
    return Array.from(this.prestamos.values()).filter(
      (prestamo) => prestamo.cliente_id === clienteId
    );
  }

  async getPrestamo(id: number): Promise<Prestamo | undefined> {
    return this.prestamos.get(id);
  }

  async createPrestamo(prestamo: InsertPrestamo): Promise<Prestamo> {
    const id = this.currentPrestamoId++;
    const fechaPrestamo = new Date(prestamo.fecha_prestamo);
    
    // Calcular próxima fecha de pago (7 días después de la fecha de préstamo)
    const proximaFechaPago = addDays(fechaPrestamo, 7);
    
    // Asegurar que todos los campos requeridos estén presentes
    const nuevoPrestamo: Prestamo = {
      id,
      cliente_id: prestamo.cliente_id,
      monto_prestado: prestamo.monto_prestado,
      tasa_interes: prestamo.tasa_interes,
      fecha_prestamo: prestamo.fecha_prestamo,
      frecuencia_pago: prestamo.frecuencia_pago || "SEMANAL",
      numero_semanas: prestamo.numero_semanas || 4,
      pago_semanal: prestamo.pago_semanal || "0",
      monto_total_pagar: prestamo.monto_total_pagar || "0",
      estado: "ACTIVO",
      semanas_pagadas: 0,
      proxima_fecha_pago: format(proximaFechaPago, 'yyyy-MM-dd')
    };
    
    this.prestamos.set(id, nuevoPrestamo);
    return nuevoPrestamo;
  }

  async updatePrestamo(id: number, prestamo: Partial<Prestamo>): Promise<Prestamo | undefined> {
    const prestamoExistente = this.prestamos.get(id);
    if (!prestamoExistente) {
      return undefined;
    }
    
    const prestamoActualizado: Prestamo = {
      ...prestamoExistente,
      ...prestamo
    };
    
    this.prestamos.set(id, prestamoActualizado);
    return prestamoActualizado;
  }

  // Métodos para pagos
  async getAllPagos(): Promise<Pago[]> {
    return Array.from(this.pagos.values());
  }

  async getPagosByPrestamoId(prestamoId: number): Promise<Pago[]> {
    return Array.from(this.pagos.values()).filter(
      (pago) => pago.prestamo_id === prestamoId
    );
  }

  async createPago(pago: InsertPago): Promise<Pago> {
    const id = this.currentPagoId++;
    const prestamo = await this.getPrestamo(pago.prestamo_id);
    
    if (!prestamo) {
      throw new Error("El préstamo no existe");
    }
    
    // Determinar si el pago está atrasado comparando con la fecha proxima_fecha_pago
    const hoy = new Date();
    const fechaProximoPago = new Date(prestamo.proxima_fecha_pago);
    const estado = hoy > fechaProximoPago ? "ATRASADO" : "A_TIEMPO";
    
    // Incrementar semanas pagadas y actualizar próxima fecha de pago
    const semanasActualizadas = prestamo.semanas_pagadas + 1;
    const nuevaProximaFechaPago = addDays(fechaProximoPago, 7);
    
    // Actualizar estado del préstamo si se ha pagado completamente
    let estadoPrestamo = prestamo.estado;
    if (semanasActualizadas >= prestamo.numero_semanas) {
      estadoPrestamo = "PAGADO";
    } else if (estado === "ATRASADO") {
      estadoPrestamo = "ATRASADO";
    }
    
    // Actualizar préstamo
    await this.updatePrestamo(prestamo.id, {
      semanas_pagadas: semanasActualizadas,
      proxima_fecha_pago: format(nuevaProximaFechaPago, 'yyyy-MM-dd'),
      estado: estadoPrestamo
    });
    
    // Crear nuevo pago
    const nuevoPago: Pago = {
      ...pago,
      id,
      fecha_pago: new Date(), // Usamos un objeto Date directamente
      numero_semana: semanasActualizadas,
      estado
    };
    
    this.pagos.set(id, nuevoPago);
    return nuevoPago;
  }

  // Cálculos de préstamos
  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo {
    const { monto_prestado, tasa_interes, numero_semanas } = datos;
    
    // Calcular interés total (monto * tasa / 100)
    const interes = monto_prestado * (tasa_interes / 100);
    
    // Monto total a pagar (principal + interés)
    const monto_total_pagar = monto_prestado + interes;
    
    // Pago semanal
    const pago_semanal = monto_total_pagar / numero_semanas;
    
    return {
      monto_total_pagar,
      pago_semanal
    };
  }
}

export const storage = new MemStorage();
