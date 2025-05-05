import { 
  User, 
  Prestamo, 
  Cliente, 
  Pago, 
  InsertUser, 
  InsertPrestamo, 
  InsertCliente, 
  InsertPago, 
  Cobrador, 
  InsertCobrador,
  CalculoPrestamo,
  ResultadoCalculoPrestamo,
  Configuracion,
  InsertConfiguracion,
  MovimientoCaja,
  InsertMovimientoCaja,
  // Tablas para drizzle
  users,
  prestamos,
  clientes,
  pagos,
  cobradores,
  movimientosCaja,
  configuraciones
} from "@shared/schema";
import { addDays, differenceInDays, format } from "date-fns";
import createMemoryStore from "memorystore";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool, usingRealDatabase } from "./db";
import { and, eq, gte, lte, desc, asc, sql, like, between, isNull, or } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresStore = connectPg(session);

// Interfaz para el almacenamiento de datos
export interface IStorage {
  // Autenticación
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<Map<number, User>>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateUserPassword(id: number, newPassword: string): Promise<boolean>;
  deleteUser(id: number): Promise<boolean>;
  verificarDocumentoIdentidad(documentoIdentidad: string): Promise<boolean>;
  
  // Clientes
  getAllClientes(): Promise<Cliente[]>;
  getCliente(id: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined>;
  deleteCliente(id: number): Promise<boolean>;
  verificarDocumentoIdentidad(documentoIdentidad: string): Promise<boolean>;
  
  // Exportar/Importar datos
  exportarDatos(): Promise<{
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones: Configuracion[];
  }>;
  importarDatos(datos: {
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones?: Configuracion[];
  }): Promise<boolean>;
  
  // Préstamos
  getAllPrestamos(): Promise<Prestamo[]>;
  getPrestamosByClienteId(clienteId: number): Promise<Prestamo[]>;
  getPrestamo(id: number): Promise<Prestamo | undefined>;
  createPrestamo(prestamo: InsertPrestamo): Promise<Prestamo>;
  updatePrestamo(id: number, prestamo: Partial<Prestamo>): Promise<Prestamo | undefined>;
  deletePrestamo(id: number): Promise<boolean>;
  
  // Pagos
  getAllPagos(): Promise<Pago[]>;
  getPagosByPrestamoId(prestamoId: number): Promise<Pago[]>;
  createPago(pago: InsertPago): Promise<Pago>;
  updatePago(id: number, pago: Partial<Pago>): Promise<Pago | undefined>;
  deletePago(id: number): Promise<boolean>;
  
  // Cálculos
  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo;
  
  // Caja
  getAllMovimientosCaja(): Promise<MovimientoCaja[]>;
  getMovimientoCaja(id: number): Promise<MovimientoCaja | undefined>;
  createMovimientoCaja(movimiento: InsertMovimientoCaja): Promise<MovimientoCaja>;
  deleteMovimientoCaja(id: number): Promise<boolean>;
  getResumenCaja(): Promise<{ 
    saldo_actual: number; 
    total_ingresos: number; 
    total_egresos: number;
    movimientos_por_dia: { fecha: string; ingreso: number; egreso: number }[] 
  }>;
  getMovimientosCajaPorFecha(fechaInicio: string, fechaFin: string): Promise<MovimientoCaja[]>;
  
  // Cobradores
  getAllCobradores(): Promise<Cobrador[]>;
  getCobrador(id: number): Promise<Cobrador | undefined>;
  getCobradorByUserId(userId: number): Promise<Cobrador | undefined>;
  createCobrador(cobrador: InsertCobrador): Promise<Cobrador>;
  updateCobrador(id: number, cobrador: Partial<Cobrador>): Promise<Cobrador | undefined>;
  deleteCobrador(id: number): Promise<boolean>;
  getClientesByCobrador(cobradorId: number): Promise<Cliente[]>;
  
  // Configuraciones
  getAllConfiguraciones(): Promise<Configuracion[]>;
  getConfiguracionesPorCategoria(categoria: string): Promise<Configuracion[]>;
  getConfiguracion(clave: string): Promise<Configuracion | undefined>;
  getValorConfiguracion(clave: string, valorPorDefecto?: string): Promise<string>;
  saveConfiguracion(configuracion: InsertConfiguracion): Promise<Configuracion>;
  updateConfiguracion(id: number, configuracion: Partial<Configuracion>): Promise<Configuracion | undefined>;
  deleteConfiguracion(id: number): Promise<boolean>;
  
  // Sesión
  sessionStore: any; // Tipo simplificado para la store de sesión
}

// Implementación de almacenamiento en memoria
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clientes: Map<number, Cliente>;
  private prestamos: Map<number, Prestamo>;
  private pagos: Map<number, Pago>;
  private cobradores: Map<number, Cobrador>;
  private currentUserId: number;
  private currentClienteId: number;
  private currentPrestamoId: number;
  private currentPagoId: number;
  private currentCobradorId: number;
  sessionStore: any; // Tipo simplificado para la store de sesión

  private movimientosCaja: Map<number, MovimientoCaja> = new Map();
  private currentMovimientoCajaId: number = 1;
  
  // Configuraciones
  private configuraciones: Map<number, Configuracion> = new Map();
  private currentConfiguracionId: number = 1;

  constructor() {
    this.users = new Map();
    this.clientes = new Map();
    this.prestamos = new Map();
    this.pagos = new Map();
    this.cobradores = new Map();
    this.movimientosCaja = new Map();
    this.configuraciones = new Map();
    this.currentUserId = 1;
    this.currentClienteId = 1;
    this.currentPrestamoId = 1;
    this.currentPagoId = 1;
    this.currentCobradorId = 1;
    this.currentMovimientoCajaId = 1;
    this.currentConfiguracionId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 7 * 86400000, // 7 días
      stale: false, // Impedir que las sesiones se vuelvan obsoletas
      ttl: 7 * 86400000 // 7 días de tiempo de vida
    });
    
    // Inicializar datos de ejemplo
    this.initializeSampleData();
    
    // Inicializar configuraciones predeterminadas
    this.initConfiguracionesPredeterminadas();
  }
  
  private async initializeSampleData() {
    // Crear un único usuario administrador si no existe ninguno
    if (this.users.size === 0) {
      // Usuario administrador - el único que puede acceder al sistema
      const adminUser: InsertUser = {
        nombre: "Administrador",
        username: "super_rafaga@hotmail.com",
        password: "cc2e80a13700cb1ffb71aaaeac476d08e7d6ad2550c83693ae1262755568dd3718870a36fc454bc996af1bb03fa8055714a7331ff88adf8cfa1e5810d258b05c.efe8323317c7831521c66267d8888877", // Contraseña: admin123 (hasheada con scrypt)
        rol: "ADMIN"
      };
      await this.createUser(adminUser);
    }
    // No se crean datos de ejemplo (clientes, préstamos, pagos) como solicitado por el usuario
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

  async getAllUsers(): Promise<Map<number, User>> {
    return this.users;
  }
  
  async updateUserPassword(id: number, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) {
      return false;
    }
    
    // Actualizar la contraseña
    user.password = newPassword;
    this.users.set(id, user);
    return true;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // No permitir eliminar el usuario administrador inicial
    if (id === 1) {
      return false;
    }
    
    // Verificar si existe
    if (!this.users.has(id)) {
      return false;
    }
    
    // Eliminar el usuario
    return this.users.delete(id);
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const userExistente = this.users.get(id);
    if (!userExistente) {
      return undefined;
    }
    
    const userActualizado: User = { 
      ...userExistente, 
      ...userData 
    };
    
    this.users.set(id, userActualizado);
    return userActualizado;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      rol: insertUser.rol || "USUARIO" // Valor por defecto si no se especifica
    };
    this.users.set(id, user);
    return user;
  }

  // Métodos para clientes
  async getAllClientes(): Promise<Cliente[]> {
    return Array.from(this.clientes.values());
  }
async verificarDocumentoIdentidad(documentoIdentidad: string): Promise<boolean> {
    for (const cliente of this.clientes.values()) {
        if (cliente.documento_identidad === documentoIdentidad) {
            return true;
        }
    }
    return false;
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
    
    // Usar fecha de pago proporcionada o calcular la próxima fecha de pago (7 días después de la fecha del préstamo)
    let proximaFechaPago;
    if (prestamo.proxima_fecha_pago) {
      proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
    } else {
      proximaFechaPago = addDays(fechaPrestamo, 7);
    }
    
    // Asegurar que todos los campos requeridos estén presentes
    const nuevoPrestamo: Prestamo = {
      id,
      cliente_id: prestamo.cliente_id,
      monto_prestado: prestamo.monto_prestado,
      tasa_interes: prestamo.tasa_interes,
      tasa_mora: prestamo.tasa_mora || "5", // Tasa de mora predeterminada del 5%
      fecha_prestamo: prestamo.fecha_prestamo,
      frecuencia_pago: prestamo.frecuencia_pago || "SEMANAL",
      numero_semanas: prestamo.numero_semanas || 4,
      pago_semanal: prestamo.pago_semanal || "0",
      monto_total_pagar: prestamo.monto_total_pagar || "0",
      estado: "ACTIVO",
      semanas_pagadas: 0,
      proxima_fecha_pago: format(proximaFechaPago, 'yyyy-MM-dd'),
      dias_atraso: 0,
      monto_mora_acumulada: "0",
      fecha_inicial_personalizada: null,
      dia_pago: null,
      cronograma_eliminado: false
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
  
  async getTotalPagadoByPrestamoId(prestamoId: number): Promise<number> {
    const pagos = await this.getPagosByPrestamoId(prestamoId);
    return pagos.reduce((total, pago) => total + Number(pago.monto_pagado), 0);
  }
  
  async getTotalPagadoByClienteId(clienteId: number): Promise<number> {
    const prestamos = await this.getPrestamosByClienteId(clienteId);
    let totalPagado = 0;
    
    for (const prestamo of prestamos) {
      totalPagado += await this.getTotalPagadoByPrestamoId(prestamo.id);
    }
    
    return totalPagado;
  }

  async createPago(pago: InsertPago): Promise<Pago> {
    console.log("DEBUG - Iniciando creación de pago:", pago);
    const id = this.currentPagoId++;
    const prestamo = await this.getPrestamo(pago.prestamo_id);
    
    if (!prestamo) {
      console.error("ERROR - Préstamo no encontrado:", pago.prestamo_id);
      throw new Error("El préstamo no existe");
    }
    
    console.log("DEBUG - Préstamo encontrado:", prestamo);
    
    // Determinar si el pago está atrasado comparando con la fecha proxima_fecha_pago
    const hoy = new Date();
    const fechaProximoPago = new Date(prestamo.proxima_fecha_pago);
    const estado = hoy > fechaProximoPago ? "ATRASADO" : "A_TIEMPO";
    console.log("DEBUG - Estado del pago:", estado);
    
    // Calcular días de atraso para moras
    let diasAtraso = 0;
    let montoMora = 0;
    
    if (estado === "ATRASADO") {
      // Calcular días de diferencia entre la fecha de pago programada y hoy
      diasAtraso = differenceInDays(hoy, fechaProximoPago);
      if (diasAtraso < 0) diasAtraso = 0; // Por si acaso
      
      // Calcular monto de mora basado en la tasa de mora y los días de atraso
      // Formula: (monto_prestamo * tasa_mora / 100) * (dias_atraso / 30)
      // Esta fórmula calcula la mora mensual y la prorratea por los días de atraso
      const tasaMora = Number(prestamo.tasa_mora || 5); // Default 5% si no está definido
      const montoPrestado = Number(prestamo.monto_prestado);
      montoMora = (montoPrestado * tasaMora / 100) * (diasAtraso / 30);
      
      console.log("DEBUG - Días de atraso:", diasAtraso);
      console.log("DEBUG - Tasa de mora (%):", tasaMora);
      console.log("DEBUG - Monto de mora calculado:", montoMora);
    }
    
    // Verificar si es un pago parcial (menos que el monto semanal)
    const montoPagado = Number(pago.monto_pagado);
    const montoSemanal = Number(prestamo.pago_semanal);
    const esPagoParcial = montoPagado < montoSemanal;
    const montoRestante = esPagoParcial ? (montoSemanal - montoPagado) : 0;
    
    console.log("DEBUG - Monto pagado:", montoPagado);
    console.log("DEBUG - Monto semanal requerido:", montoSemanal);
    console.log("DEBUG - ¿Es pago parcial?:", esPagoParcial);
    console.log("DEBUG - Monto restante:", montoRestante);
    
    // Solo incrementamos semanas pagadas si el pago es completo o supera el monto semanal
    let semanasActualizadas = prestamo.semanas_pagadas;
    let nuevaProximaFechaPago = fechaProximoPago;
    
    if (!esPagoParcial) {
      semanasActualizadas += 1;
      nuevaProximaFechaPago = addDays(fechaProximoPago, 7);
      console.log("DEBUG - Incrementando semanas pagadas a:", semanasActualizadas);
      console.log("DEBUG - Nueva fecha de próximo pago:", format(nuevaProximaFechaPago, 'yyyy-MM-dd'));
    } else {
      console.log("DEBUG - No se incrementan semanas pagadas por ser pago parcial");
    }
    
    // Actualizar estado del préstamo
    let estadoPrestamo = prestamo.estado;
    
    // Obtener todos los pagos del préstamo
    const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
    
    // Calcular el total pagado hasta ahora, incluyendo el pago actual
    const totalPagado = pagosPrestamo.reduce((sum, p) => sum + Number(p.monto_pagado), 0) + montoPagado;
    
    // Monto total a pagar del préstamo
    const montoTotalPagar = Number(prestamo.monto_total_pagar);
    
    console.log("DEBUG - Total pagado acumulado:", totalPagado);
    console.log("DEBUG - Monto total a pagar:", montoTotalPagar);
    
    // Verificar si se ha pagado el monto total, independientemente del número de semanas
    if (totalPagado >= montoTotalPagar) {
      estadoPrestamo = "PAGADO";
      console.log("DEBUG - Préstamo PAGADO por monto total cubierto");
    }
    // Si no está pagado por monto total, verificar si está pagado por semanas
    else if (semanasActualizadas >= prestamo.numero_semanas) {
      estadoPrestamo = "PAGADO";
      console.log("DEBUG - Préstamo PAGADO por semanas completadas");
    } 
    // Otros casos de actualización de estado
    else if (estado === "ATRASADO" && !esPagoParcial) {
      // Si era atrasado pero hizo un pago completo, pasa a activo
      estadoPrestamo = "ACTIVO";
    } else if (estado === "ATRASADO") {
      estadoPrestamo = "ATRASADO";
    }
    
    console.log("DEBUG - Nuevo estado del préstamo:", estadoPrestamo);
    
    // Calcular mora acumulada (añadir mora actual a la acumulada anteriormente)
    const moraAcumuladaPrevia = Number(prestamo.monto_mora_acumulada || 0);
    let nuevaMoraAcumulada = moraAcumuladaPrevia;
    
    // Si hay mora y el pago actual no cubre la mora, se acumula
    if (montoMora > 0) {
      nuevaMoraAcumulada += montoMora;
    }
    
    console.log("DEBUG - Mora acumulada previa:", moraAcumuladaPrevia);
    console.log("DEBUG - Nueva mora acumulada:", nuevaMoraAcumulada);
    
    // Actualizar préstamo
    await this.updatePrestamo(prestamo.id, {
      semanas_pagadas: semanasActualizadas,
      proxima_fecha_pago: format(nuevaProximaFechaPago, 'yyyy-MM-dd'),
      estado: estadoPrestamo,
      dias_atraso: diasAtraso,
      monto_mora_acumulada: nuevaMoraAcumulada.toString()
    });
    
    // Crear nuevo pago
    const nuevoPago: Pago = {
      ...pago,
      id,
      monto_mora: montoMora.toString(),
      fecha_pago: new Date(),
      numero_semana: prestamo.semanas_pagadas + 1, // La semana que se está pagando
      estado,
      es_pago_parcial: esPagoParcial ? "true" : "false",
      monto_restante: montoRestante.toString()
    };
    
    console.log("DEBUG - Nuevo pago creado:", nuevoPago);
    this.pagos.set(id, nuevoPago);
    return nuevoPago;
  }

  // Método para actualizar un pago
  async updatePago(id: number, pago: Partial<Pago>): Promise<Pago | undefined> {
    console.log("DEBUG - Iniciando actualización de pago:", id, pago);
    
    // Obtener el pago existente
    const pagoExistente = this.pagos.get(id);
    if (!pagoExistente) {
      console.log("DEBUG - Pago no encontrado:", id);
      return undefined;
    }
    
    // Verificar si el monto del pago ha cambiado
    const montoAnterior = Number(pagoExistente.monto_pagado);
    const nuevoMonto = pago.monto_pagado ? Number(pago.monto_pagado) : montoAnterior;
    
    console.log("DEBUG - Pago existente:", pagoExistente);
    console.log("DEBUG - Monto anterior:", montoAnterior);
    console.log("DEBUG - Nuevo monto:", nuevoMonto);
    
    // Obtener el préstamo asociado
    const prestamo = await this.getPrestamo(pagoExistente.prestamo_id);
    if (!prestamo) {
      console.log("DEBUG - Préstamo asociado no encontrado:", pagoExistente.prestamo_id);
      return undefined;
    }
    
    // Actualizar el pago
    const pagoActualizado: Pago = {
      ...pagoExistente,
      ...pago
    };
    
    // Determinar si es pago parcial
    const montoSemanal = Number(prestamo.pago_semanal);
    const esPagoParcial = nuevoMonto < montoSemanal;
    const montoRestante = esPagoParcial ? (montoSemanal - nuevoMonto).toString() : "0";
    
    pagoActualizado.es_pago_parcial = esPagoParcial ? "true" : "false";
    pagoActualizado.monto_restante = montoRestante;
    
    // Guardar el pago actualizado
    this.pagos.set(id, pagoActualizado);
    console.log("DEBUG - Pago actualizado:", pagoActualizado);
    
    // Recalcular el estado del préstamo
    // 1. Obtener todos los pagos del préstamo
    const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
    
    // 2. Calcular total pagado
    const totalPagado = pagosPrestamo.reduce(
      (sum, p) => sum + Number(p.monto_pagado), 0
    );
    console.log("DEBUG - Total pagado acumulado después de la edición:", totalPagado);
    
    // 3. Actualizar el estado del préstamo según total pagado
    const montoTotalPagar = Number(prestamo.monto_total_pagar);
    let nuevoEstado = prestamo.estado;
    
    // Si el monto pagado cubre el total, marcar como pagado
    if (totalPagado >= montoTotalPagar) {
      nuevoEstado = "PAGADO";
      console.log("DEBUG - Préstamo PAGADO por monto total cubierto");
    }
    
    if (nuevoEstado !== prestamo.estado) {
      await this.updatePrestamo(prestamo.id, { estado: nuevoEstado });
    }
    
    return pagoActualizado;
  }

  // Método para eliminar un pago
  async deletePago(id: number): Promise<boolean> {
    console.log("DEBUG - Iniciando eliminación de pago:", id);
    
    // Obtener el pago que se va a eliminar
    const pago = this.pagos.get(id);
    if (!pago) {
      console.log("DEBUG - Pago no encontrado:", id);
      return false;
    }
    
    console.log("DEBUG - Pago encontrado:", pago);

    // Obtener el préstamo asociado al pago
    const prestamo = await this.getPrestamo(pago.prestamo_id);
    if (!prestamo) {
      console.log("DEBUG - Préstamo no encontrado:", pago.prestamo_id);
      return false;
    }
    
    // Si es un pago parcial, no afecta el estado ni las semanas pagadas
    // del préstamo, solo eliminamos el pago
    if (pago.es_pago_parcial === "true") {
      console.log("DEBUG - Eliminando pago parcial");
      const eliminado = this.pagos.delete(id);
      return eliminado;
    }
    
    // Para pagos completos:
    // 1. Decrementar las semanas pagadas
    let nuevasSemanaPagadas = prestamo.semanas_pagadas;
    if (nuevasSemanaPagadas > 0) {
      nuevasSemanaPagadas -= 1;
    }
    
    // 2. Ajustar la próxima fecha de pago (retroceder 7 días)
    const fechaActual = new Date(prestamo.proxima_fecha_pago);
    const nuevaFecha = addDays(fechaActual, -7);
    
    // 3. Recalcular estado del préstamo
    // Siempre vuelve a ACTIVO a menos que no tenga semanas pagadas
    const nuevoEstado = "ACTIVO";
    
    // 4. Actualizar el préstamo con los nuevos valores
    await this.updatePrestamo(prestamo.id, {
      semanas_pagadas: nuevasSemanaPagadas,
      proxima_fecha_pago: format(nuevaFecha, 'yyyy-MM-dd'),
      estado: nuevoEstado
    });
    
    console.log("DEBUG - Préstamo actualizado tras eliminar pago:", {
      semanas_pagadas: nuevasSemanaPagadas,
      proxima_fecha_pago: format(nuevaFecha, 'yyyy-MM-dd'),
      estado: nuevoEstado
    });
    
    // 5. Finalmente, eliminar el pago
    const eliminado = this.pagos.delete(id);
    console.log("DEBUG - Resultado de eliminación:", eliminado);
    return eliminado;
  }

  async deletePrestamo(id: number): Promise<boolean> {
    const prestamoExistente = this.prestamos.get(id);
    if (!prestamoExistente) {
      return false;
    }
    
    // Verificar si existen pagos asociados al préstamo
    const pagosPrestamo = await this.getPagosByPrestamoId(id);
    if (pagosPrestamo.length > 0) {
      // Eliminar todos los pagos asociados al préstamo
      for (const pago of pagosPrestamo) {
        await this.deletePago(pago.id);
      }
    }
    
    return this.prestamos.delete(id);
  }

  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo {
    const { monto_prestado, tasa_interes, numero_semanas } = datos;
    
    // Calcular interés total
    const interes = monto_prestado * (tasa_interes / 100);
    
    // Monto total a pagar
    const monto_total_pagar = monto_prestado + interes;
    
    // Pago semanal
    const pago_semanal = monto_total_pagar / numero_semanas;
    
    return {
      monto_total_pagar,
      pago_semanal
    };
  }

  // Métodos para movimientos de caja
  async getAllMovimientosCaja(): Promise<MovimientoCaja[]> {
    return Array.from(this.movimientosCaja.values());
  }

  async getMovimientoCaja(id: number): Promise<MovimientoCaja | undefined> {
    return this.movimientosCaja.get(id);
  }

  async createMovimientoCaja(movimiento: InsertMovimientoCaja): Promise<MovimientoCaja> {
    const id = this.currentMovimientoCajaId++;
    
    // Asegurarse de que la fecha sea un objeto Date
    let fecha;
    if (movimiento.fecha instanceof Date) {
      fecha = movimiento.fecha;
    } else {
      fecha = new Date(movimiento.fecha.toString());
    }
    
    // Crear movimiento
    const nuevoMovimiento: MovimientoCaja = {
      ...movimiento,
      id,
      fecha
    };
    
    this.movimientosCaja.set(id, nuevoMovimiento);
    return nuevoMovimiento;
  }

  async deleteMovimientoCaja(id: number): Promise<boolean> {
    return this.movimientosCaja.delete(id);
  }

  async getResumenCaja(): Promise<{ 
    saldo_actual: number;
    total_ingresos: number;
    total_egresos: number;
    movimientos_por_dia: { fecha: string; ingreso: number; egreso: number }[]
  }> {
    const movimientos = Array.from(this.movimientosCaja.values());
    let totalIngresos = 0;
    let totalEgresos = 0;
    
    // Calcular totales
    for (const movimiento of movimientos) {
      const monto = Number(movimiento.monto);
      if (movimiento.tipo === "INGRESO") {
        totalIngresos += monto;
      } else {
        totalEgresos += monto;
      }
    }
    
    // Saldo actual
    const saldoActual = totalIngresos - totalEgresos;
    
    // Agrupar movimientos por día para gráficos
    const movimientosPorDia = new Map<string, { ingreso: number; egreso: number }>();
    
    for (const movimiento of movimientos) {
      const fecha = format(new Date(movimiento.fecha), 'yyyy-MM-dd');
      const monto = Number(movimiento.monto);
      
      if (!movimientosPorDia.has(fecha)) {
        movimientosPorDia.set(fecha, { ingreso: 0, egreso: 0 });
      }
      
      const datos = movimientosPorDia.get(fecha)!;
      
      if (movimiento.tipo === "INGRESO") {
        datos.ingreso += monto;
      } else {
        datos.egreso += monto;
      }
      
      movimientosPorDia.set(fecha, datos);
    }
    
    // Convertir Map a Array para el resultado
    const movimientosPorDiaArray = Array.from(movimientosPorDia.entries()).map(
      ([fecha, datos]) => ({
        fecha,
        ingreso: datos.ingreso,
        egreso: datos.egreso
      })
    );
    
    // Ordenar por fecha
    movimientosPorDiaArray.sort((a, b) => {
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    });
    
    return {
      saldo_actual: saldoActual,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      movimientos_por_dia: movimientosPorDiaArray
    };
  }
  
  async getMovimientosCajaPorFecha(fechaInicio: string, fechaFin: string): Promise<MovimientoCaja[]> {
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaFin);
    
    return Array.from(this.movimientosCaja.values()).filter(movimiento => {
      const fechaMovimiento = new Date(movimiento.fecha);
      return fechaMovimiento >= fechaInicioObj && fechaMovimiento <= fechaFinObj;
    });
  }

  // Métodos para cobradores
  async getAllCobradores(): Promise<Cobrador[]> {
    return Array.from(this.cobradores.values());
  }

  async getCobrador(id: number): Promise<Cobrador | undefined> {
    return this.cobradores.get(id);
  }

  async getCobradorByUserId(userId: number): Promise<Cobrador | undefined> {
    return Array.from(this.cobradores.values()).find(
      (cobrador) => cobrador.user_id === userId
    );
  }

  async createCobrador(cobrador: InsertCobrador): Promise<Cobrador> {
    const id = this.currentCobradorId++;
    const nuevoCobrador: Cobrador = { 
      ...cobrador, 
      id 
    };
    
    this.cobradores.set(id, nuevoCobrador);
    return nuevoCobrador;
  }

  async updateCobrador(id: number, cobrador: Partial<Cobrador>): Promise<Cobrador | undefined> {
    const cobradorExistente = this.cobradores.get(id);
    if (!cobradorExistente) {
      return undefined;
    }
    
    const cobradorActualizado: Cobrador = { 
      ...cobradorExistente, 
      ...cobrador 
    };
    
    this.cobradores.set(id, cobradorActualizado);
    return cobradorActualizado;
  }

  async deleteCobrador(id: number): Promise<boolean> {
    return this.cobradores.delete(id);
  }

  async getClientesByCobrador(cobradorId: number): Promise<Cliente[]> {
    return Array.from(this.clientes.values()).filter(
      (cliente) => cliente.cobrador_id === cobradorId
    );
  }

  // Métodos para configuraciones
  async getAllConfiguraciones(): Promise<Configuracion[]> {
    return Array.from(this.configuraciones.values());
  }

  async getConfiguracionesPorCategoria(categoria: string): Promise<Configuracion[]> {
    return Array.from(this.configuraciones.values()).filter(
      (config) => config.categoria === categoria
    );
  }

  async getConfiguracion(clave: string): Promise<Configuracion | undefined> {
    return Array.from(this.configuraciones.values()).find(
      (config) => config.clave === clave
    );
  }

  async getValorConfiguracion(clave: string, valorPorDefecto: string = ""): Promise<string> {
    const config = await this.getConfiguracion(clave);
    return config ? config.valor : valorPorDefecto;
  }
  
  // Obtener el siguiente número de documento de identidad autogenerado
  async getSiguienteDocumentoIdentidad(): Promise<string> {
    // Obtener el prefijo de la configuración (por defecto "ID-")
    const prefijo = await this.getValorConfiguracion("PREFIJO_DOCUMENTO", "ID-");
    
    // Buscar el número más alto actual
    const clientes = await this.getAllClientes();
    let maxNumero = 0;
    
    for (const cliente of clientes) {
      // Solo procesar documentos que coincidan con el formato prefijo + número
      if (cliente.documento_identidad.startsWith(prefijo)) {
        const numeroStr = cliente.documento_identidad.substring(prefijo.length);
        const numero = parseInt(numeroStr);
        if (!isNaN(numero) && numero > maxNumero) {
          maxNumero = numero;
        }
      }
    }
    
    // Incrementar en uno y formatear con ceros a la izquierda (6 dígitos)
    const siguienteNumero = maxNumero + 1;
    const numeroFormateado = siguienteNumero.toString().padStart(6, '0');
    
    return `${prefijo}${numeroFormateado}`;
  }

  async saveConfiguracion(configuracion: InsertConfiguracion): Promise<Configuracion> {
    // Verificar si ya existe una configuración con esta clave
    const configExistente = await this.getConfiguracion(configuracion.clave);
    
    if (configExistente) {
      // Actualizar la configuración existente
      return this.updateConfiguracion(configExistente.id, configuracion) as Promise<Configuracion>;
    }
    
    // Crear nueva configuración
    const id = this.currentConfiguracionId++;
    const nuevaConfig: Configuracion = {
      ...configuracion,
      id
    };
    
    this.configuraciones.set(id, nuevaConfig);
    return nuevaConfig;
  }

  async updateConfiguracion(id: number, configuracion: Partial<Configuracion>): Promise<Configuracion | undefined> {
    const configExistente = this.configuraciones.get(id);
    if (!configExistente) {
      return undefined;
    }
    
    const configActualizada: Configuracion = {
      ...configExistente,
      ...configuracion
    };
    
    this.configuraciones.set(id, configActualizada);
    return configActualizada;
  }

  async deleteConfiguracion(id: number): Promise<boolean> {
    return this.configuraciones.delete(id);
  }

  // Métodos para exportar e importar datos
  async exportarDatos(): Promise<{
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones: Configuracion[];
  }> {
    return {
      users: Array.from(this.users.values()),
      clientes: Array.from(this.clientes.values()),
      prestamos: Array.from(this.prestamos.values()),
      pagos: Array.from(this.pagos.values()),
      cobradores: Array.from(this.cobradores.values()),
      movimientosCaja: Array.from(this.movimientosCaja.values()),
      configuraciones: Array.from(this.configuraciones.values())
    };
  }

  async importarDatos(datos: {
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones?: Configuracion[];
  }): Promise<boolean> {
    try {
      // Limpiar los datos existentes
      this.users.clear();
      this.clientes.clear();
      this.prestamos.clear();
      this.pagos.clear();
      this.cobradores.clear();
      this.movimientosCaja.clear();
      this.configuraciones.clear();

      // Importar los usuarios
      let maxUserId = 0;
      datos.users.forEach(user => {
        this.users.set(user.id, user);
        if (user.id > maxUserId) maxUserId = user.id;
      });
      this.currentUserId = maxUserId + 1;

      // Importar los clientes
      let maxClienteId = 0;
      datos.clientes.forEach(cliente => {
        this.clientes.set(cliente.id, cliente);
        if (cliente.id > maxClienteId) maxClienteId = cliente.id;
      });
      this.currentClienteId = maxClienteId + 1;

      // Importar los préstamos
      let maxPrestamoId = 0;
      datos.prestamos.forEach(prestamo => {
        this.prestamos.set(prestamo.id, prestamo);
        if (prestamo.id > maxPrestamoId) maxPrestamoId = prestamo.id;
      });
      this.currentPrestamoId = maxPrestamoId + 1;

      // Importar los pagos
      let maxPagoId = 0;
      datos.pagos.forEach(pago => {
        this.pagos.set(pago.id, pago);
        if (pago.id > maxPagoId) maxPagoId = pago.id;
      });
      this.currentPagoId = maxPagoId + 1;

      // Importar los cobradores
      let maxCobradorId = 0;
      datos.cobradores.forEach(cobrador => {
        this.cobradores.set(cobrador.id, cobrador);
        if (cobrador.id > maxCobradorId) maxCobradorId = cobrador.id;
      });
      this.currentCobradorId = maxCobradorId + 1;

      // Importar los movimientos de caja
      let maxMovimientoId = 0;
      datos.movimientosCaja.forEach(movimiento => {
        this.movimientosCaja.set(movimiento.id, movimiento);
        if (movimiento.id > maxMovimientoId) maxMovimientoId = movimiento.id;
      });
      this.currentMovimientoCajaId = maxMovimientoId + 1;

      // Importar las configuraciones si existen
      if (datos.configuraciones && datos.configuraciones.length > 0) {
        let maxConfigId = 0;
        datos.configuraciones.forEach(config => {
          this.configuraciones.set(config.id, config);
          if (config.id > maxConfigId) maxConfigId = config.id;
        });
        this.currentConfiguracionId = maxConfigId + 1;
      }

      return true;
    } catch (error) {
      console.error("Error al importar datos:", error);
      return false;
    }
  }

  // Inicializar configuraciones predeterminadas
  private async initConfiguracionesPredeterminadas() {
    // Configuración general
    await this.saveConfiguracion({
      clave: "NOMBRE_EMPRESA",
      valor: "Préstamos Rápidos",
      descripcion: "Nombre de la empresa",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });

    await this.saveConfiguracion({
      clave: "DIRECCION_EMPRESA",
      valor: "Calle Principal #123",
      descripcion: "Dirección de la empresa",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });
    
    await this.saveConfiguracion({
      clave: "PREFIJO_DOCUMENTO",
      valor: "ID-",
      descripcion: "Prefijo para documentos de identidad generados automáticamente",
      tipo: "TEXTO",
      categoria: "SISTEMA"
    });

    // Configuraciones de préstamos
    await this.saveConfiguracion({
      clave: "TASA_INTERES_PREDETERMINADA",
      valor: "10",
      descripcion: "Tasa de interés predeterminada para nuevos préstamos (%)",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    await this.saveConfiguracion({
      clave: "TASA_MORA_PREDETERMINADA",
      valor: "5",
      descripcion: "Tasa de mora predeterminada (%)",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    await this.saveConfiguracion({
      clave: "PLAZO_PREDETERMINADO",
      valor: "12",
      descripcion: "Plazo predeterminado en semanas para nuevos préstamos",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    // Configuraciones de pagos
    await this.saveConfiguracion({
      clave: "DIAS_GRACIA",
      valor: "1",
      descripcion: "Días de gracia antes de aplicar mora",
      tipo: "NUMERO",
      categoria: "PAGOS"
    });

    await this.saveConfiguracion({
      clave: "PERMITIR_PAGOS_PARCIALES",
      valor: "true",
      descripcion: "Permitir pagos parciales",
      tipo: "BOOLEANO",
      categoria: "PAGOS"
    });

    // Configuraciones del sistema
    await this.saveConfiguracion({
      clave: "RESPALDO_AUTOMATICO",
      valor: "false",
      descripcion: "Realizar respaldos automáticos",
      tipo: "BOOLEANO",
      categoria: "SISTEMA"
    });

    await this.saveConfiguracion({
      clave: "INTERVALO_RESPALDO",
      valor: "7",
      descripcion: "Intervalo de respaldos automáticos en días",
      tipo: "NUMERO",
      categoria: "SISTEMA"
    });
  }
}

// Eliminamos importaciones duplicadas

// Implementación de almacenamiento en base de datos PostgreSQL
export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Inicializar el store de sesión PostgreSQL
    try {
      // Usamos las variables ya definidas en la parte superior del archivo
      this.sessionStore = new PostgresStore({
        pool: pool,
        tableName: 'session', // Nombre singular para evitar conflictos
        createTableIfMissing: true
      });
      console.log("Sesiones configuradas con PostgreSQL en DatabaseStorage");
    } catch (error) {
      console.error("Error al configurar PostgreSQL para sesiones en storage:", error);
      // Fallback a MemoryStore utilizando las variables ya definidas
      this.sessionStore = new MemoryStore({ 
        checkPeriod: 86400000 
      });
      console.log("FALLBACK: Sesiones configuradas con MemoryStore en DatabaseStorage");
    }

    // Inicializar datos y configuraciones por defecto
    this.initializeData();
  }

  private async initializeData() {
    try {
      // Hash fijo para la contraseña "admin123"
      const adminPasswordHash = "cc2e80a13700cb1ffb71aaaeac476d08e7d6ad2550c83693ae1262755568dd3718870a36fc454bc996af1bb03fa8055714a7331ff88adf8cfa1e5810d258b05c.efe8323317c7831521c66267d8888877";
      
      // Verificar si existe usuario administrador
      const adminUser = await this.getUserByUsername("super_rafaga@hotmail.com");
      if (!adminUser) {
        // Crear usuario administrador por defecto
        await this.createUser({
          nombre: "Administrador",
          username: "super_rafaga@hotmail.com",
          password: adminPasswordHash,
          rol: "ADMIN"
        });
        console.log("Usuario administrador creado en la base de datos");
      } else {
        // Actualizar la contraseña del administrador existente para garantizar acceso
        await db.update(users)
          .set({ password: adminPasswordHash })
          .where(eq(users.username, "super_rafaga@hotmail.com"));
        console.log("Contraseña de administrador actualizada para garantizar acceso");
      }

      // Inicializar configuraciones predeterminadas
      await this.initConfiguracionesPredeterminadas();

    } catch (error) {
      console.error("Error al inicializar datos en la base de datos:", error);
    }
  }

  // IMPLEMENTACIÓN DE MÉTODOS CON LA BASE DE DATOS

  // USUARIOS
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<Map<number, User>> {
    const results = await db.select().from(users);
    const userMap = new Map<number, User>();
    results.forEach(user => {
      userMap.set(user.id, user);
    });
    return userMap;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      rol: insertUser.rol || "USUARIO"
    }).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserPassword(id: number, newPassword: string): Promise<boolean> {
    try {
      await db.update(users)
        .set({ password: newPassword })
        .where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error("Error al actualizar contraseña del usuario:", error);
      return false;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // No permitir eliminar el usuario administrador inicial
    if (id === 1) {
      return false;
    }
    
    try {
      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      return false;
    }
  }

  // CLIENTES
  async getAllClientes(): Promise<Cliente[]> {
    return db.select().from(clientes);
  }

  async getCliente(id: number): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
    return cliente;
  }
  
async verificarDocumentoIdentidad(documentoIdentidad: string): Promise<boolean> {
    const cliente = await db.select()
        .from(clientes)
        .where(eq(clientes.documento_identidad, documentoIdentidad))
        .then(res => res[0]);
    return cliente !== undefined;
}

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const [newCliente] = await db.insert(clientes).values({
      ...cliente,
      fecha_registro: new Date()
    }).returning();
    return newCliente;
  }

  async updateCliente(id: number, clienteData: InsertCliente): Promise<Cliente | undefined> {
    const [updatedCliente] = await db.update(clientes)
      .set(clienteData)
      .where(eq(clientes.id, id))
      .returning();
    return updatedCliente;
  }

  async deleteCliente(id: number): Promise<boolean> {
    // Verificar si existen préstamos asociados al cliente
    const prestamosCliente = await this.getPrestamosByClienteId(id);
    if (prestamosCliente.length > 0) {
      // No permitir eliminar clientes con préstamos
      return false;
    }
    
    try {
      await db.delete(clientes).where(eq(clientes.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
      return false;
    }
  }

  // PRÉSTAMOS
  async getAllPrestamos(): Promise<Prestamo[]> {
    return db.select().from(prestamos);
  }

  async getPrestamosByClienteId(clienteId: number): Promise<Prestamo[]> {
    return db.select()
      .from(prestamos)
      .where(eq(prestamos.cliente_id, clienteId));
  }

  async getPrestamo(id: number): Promise<Prestamo | undefined> {
    const [prestamo] = await db.select().from(prestamos).where(eq(prestamos.id, id));
    return prestamo;
  }

  async createPrestamo(prestamo: InsertPrestamo): Promise<Prestamo> {
    const fechaPrestamo = new Date(prestamo.fecha_prestamo);
    
    // Usar fecha de pago proporcionada o calcular la próxima fecha de pago (7 días después de la fecha del préstamo)
    let proximaFechaPago;
    if (prestamo.proxima_fecha_pago) {
      proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
    } else {
      proximaFechaPago = addDays(fechaPrestamo, 7);
    }
    
    const [newPrestamo] = await db.insert(prestamos).values({
      cliente_id: prestamo.cliente_id,
      monto_prestado: prestamo.monto_prestado,
      tasa_interes: prestamo.tasa_interes,
      tasa_mora: prestamo.tasa_mora || "5", // Tasa de mora predeterminada del 5%
      fecha_prestamo: prestamo.fecha_prestamo,
      frecuencia_pago: prestamo.frecuencia_pago || "SEMANAL",
      numero_semanas: prestamo.numero_semanas || 4,
      pago_semanal: prestamo.pago_semanal || "0",
      monto_total_pagar: prestamo.monto_total_pagar || "0",
      estado: "ACTIVO",
      semanas_pagadas: 0,
      proxima_fecha_pago: format(proximaFechaPago, 'yyyy-MM-dd'),
      dias_atraso: 0,
      monto_mora_acumulada: "0",
      fecha_inicial_personalizada: null,
      dia_pago: null,
      cronograma_eliminado: false
    }).returning();
    
    return newPrestamo;
  }

  async updatePrestamo(id: number, prestamoData: Partial<Prestamo>): Promise<Prestamo | undefined> {
    const [updatedPrestamo] = await db.update(prestamos)
      .set(prestamoData)
      .where(eq(prestamos.id, id))
      .returning();
    return updatedPrestamo;
  }

  async deletePrestamo(id: number): Promise<boolean> {
    // Verificar si hay pagos asociados al préstamo
    const pagosPrestamo = await this.getPagosByPrestamoId(id);
    if (pagosPrestamo.length > 0) {
      // Si hay pagos, primero eliminar los pagos
      for (const pago of pagosPrestamo) {
        await this.deletePago(pago.id);
      }
    }
    
    try {
      await db.delete(prestamos).where(eq(prestamos.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar préstamo:", error);
      return false;
    }
  }

  // PAGOS
  async getAllPagos(): Promise<Pago[]> {
    return db.select().from(pagos);
  }

  async getPagosByPrestamoId(prestamoId: number): Promise<Pago[]> {
    return db.select()
      .from(pagos)
      .where(eq(pagos.prestamo_id, prestamoId));
  }

  async getTotalPagadoByPrestamoId(prestamoId: number): Promise<number> {
    const pagosPrestamo = await this.getPagosByPrestamoId(prestamoId);
    return pagosPrestamo.reduce((total, pago) => total + Number(pago.monto_pagado), 0);
  }

  async getTotalPagadoByClienteId(clienteId: number): Promise<number> {
    const prestamosCliente = await this.getPrestamosByClienteId(clienteId);
    let totalPagado = 0;
    
    for (const prestamo of prestamosCliente) {
      totalPagado += await this.getTotalPagadoByPrestamoId(prestamo.id);
    }
    
    return totalPagado;
  }

  async createPago(pago: InsertPago): Promise<Pago> {
    console.log("DEBUG - Iniciando creación de pago:", pago);
    
    const prestamo = await this.getPrestamo(pago.prestamo_id);
    if (!prestamo) {
      console.error("ERROR - Préstamo no encontrado:", pago.prestamo_id);
      throw new Error("El préstamo no existe");
    }
    
    console.log("DEBUG - Préstamo encontrado:", prestamo);
    
    // Determinar si el pago está atrasado comparando con la fecha proxima_fecha_pago
    const hoy = new Date();
    const fechaProximoPago = new Date(prestamo.proxima_fecha_pago);
    const estado = hoy > fechaProximoPago ? "ATRASADO" : "A_TIEMPO";
    console.log("DEBUG - Estado del pago:", estado);
    
    // Calcular días de atraso para moras
    let diasAtraso = 0;
    let montoMora = 0;
    
    if (estado === "ATRASADO") {
      // Calcular días de diferencia entre la fecha de pago programada y hoy
      diasAtraso = differenceInDays(hoy, fechaProximoPago);
      if (diasAtraso < 0) diasAtraso = 0; // Por si acaso
      
      // Calcular monto de mora basado en la tasa de mora y los días de atraso
      const tasaMora = Number(prestamo.tasa_mora || 5); // Default 5% si no está definido
      const montoPrestado = Number(prestamo.monto_prestado);
      montoMora = (montoPrestado * tasaMora / 100) * (diasAtraso / 30);
      
      console.log("DEBUG - Días de atraso:", diasAtraso);
      console.log("DEBUG - Tasa de mora (%):", tasaMora);
      console.log("DEBUG - Monto de mora calculado:", montoMora);
    }
    
    // Verificar si es un pago parcial (menos que el monto semanal)
    const montoPagado = Number(pago.monto_pagado);
    const montoSemanal = Number(prestamo.pago_semanal);
    const esPagoParcial = montoPagado < montoSemanal;
    const montoRestante = esPagoParcial ? (montoSemanal - montoPagado) : 0;
    
    console.log("DEBUG - Monto pagado:", montoPagado);
    console.log("DEBUG - Monto semanal requerido:", montoSemanal);
    console.log("DEBUG - ¿Es pago parcial?:", esPagoParcial);
    console.log("DEBUG - Monto restante:", montoRestante);
    
    // Solo incrementamos semanas pagadas si el pago es completo o supera el monto semanal
    let semanasActualizadas = prestamo.semanas_pagadas;
    let nuevaProximaFechaPago = fechaProximoPago;
    
    if (!esPagoParcial) {
      semanasActualizadas += 1;
      nuevaProximaFechaPago = addDays(fechaProximoPago, 7);
      console.log("DEBUG - Incrementando semanas pagadas a:", semanasActualizadas);
      console.log("DEBUG - Nueva fecha de próximo pago:", format(nuevaProximaFechaPago, 'yyyy-MM-dd'));
    } else {
      console.log("DEBUG - No se incrementan semanas pagadas por ser pago parcial");
    }
    
    // Actualizar estado del préstamo
    let estadoPrestamo = prestamo.estado;
    
    // Obtener todos los pagos del préstamo
    const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
    
    // Calcular el total pagado hasta ahora, incluyendo el pago actual
    const totalPagado = pagosPrestamo.reduce((sum, p) => sum + Number(p.monto_pagado), 0) + montoPagado;
    
    // Monto total a pagar del préstamo
    const montoTotalPagar = Number(prestamo.monto_total_pagar);
    
    console.log("DEBUG - Total pagado acumulado:", totalPagado);
    console.log("DEBUG - Monto total a pagar:", montoTotalPagar);
    
    // Verificar si se ha pagado el monto total
    if (totalPagado >= montoTotalPagar) {
      estadoPrestamo = "PAGADO";
      console.log("DEBUG - Préstamo PAGADO por monto total cubierto");
    }
    // Verificar si se han completado todas las semanas pero falta monto
    else if (semanasActualizadas >= prestamo.numero_semanas && totalPagado < montoTotalPagar) {
      estadoPrestamo = "MORA";
      console.log("DEBUG - Préstamo en MORA: semanas completas pero monto no cubierto");
    }
    // Si está activo pero presenta atraso
    else if (diasAtraso > 0) {
      estadoPrestamo = "ATRASO";
      console.log("DEBUG - Préstamo con ATRASO");
    }
    // Normal
    else {
      estadoPrestamo = "ACTIVO";
      console.log("DEBUG - Préstamo ACTIVO");
    }
    
    // Actualizar el préstamo con la nueva información
    await this.updatePrestamo(prestamo.id, {
      estado: estadoPrestamo,
      semanas_pagadas: semanasActualizadas,
      dias_atraso: diasAtraso,
      proxima_fecha_pago: format(nuevaProximaFechaPago, 'yyyy-MM-dd'),
      monto_mora_acumulada: String(Number(prestamo.monto_mora_acumulada) + montoMora)
    });
    
    // Crear el pago registrando toda la información
    const [newPago] = await db.insert(pagos).values({
      prestamo_id: pago.prestamo_id,
      cliente_id: prestamo.cliente_id,
      fecha_pago: pago.fecha_pago,
      monto_pagado: pago.monto_pagado,
      monto_mora: String(montoMora),
      estado: estado,
      es_pago_parcial: esPagoParcial,
      monto_restante: String(montoRestante),
      comentario: pago.comentario || null,
      creado_por: pago.creado_por
    }).returning();
    
    return newPago;
  }

  async updatePago(id: number, pagoData: Partial<Pago>): Promise<Pago | undefined> {
    const [updatedPago] = await db.update(pagos)
      .set(pagoData)
      .where(eq(pagos.id, id))
      .returning();
    return updatedPago;
  }

  async deletePago(id: number): Promise<boolean> {
    try {
      // Obtener el pago antes de eliminarlo
      const pago = await db.select().from(pagos).where(eq(pagos.id, id)).then(res => res[0]);
      if (!pago) return false;
      
      // Eliminar el pago
      await db.delete(pagos).where(eq(pagos.id, id));
      
      // Actualizar el estado del préstamo
      const prestamo = await this.getPrestamo(pago.prestamo_id);
      if (prestamo) {
        // Recuperar todos los pagos del préstamo (que ahora ya no incluye el eliminado)
        const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
        
        // Calcular semanas pagadas (número de pagos completos)
        const pagosCompletos = pagosPrestamo.filter(p => !p.es_pago_parcial).length;
        
        // Calcular total pagado
        const totalPagado = pagosPrestamo.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
        
        // Determinar nuevo estado
        let nuevoEstado = prestamo.estado;
        if (totalPagado >= Number(prestamo.monto_total_pagar)) {
          nuevoEstado = "PAGADO";
        } else if (pagosCompletos >= prestamo.numero_semanas) {
          nuevoEstado = "MORA";
        } else if (prestamo.dias_atraso > 0) {
          nuevoEstado = "ATRASO";
        } else {
          nuevoEstado = "ACTIVO";
        }
        
        // Actualizar préstamo
        await this.updatePrestamo(prestamo.id, {
          semanas_pagadas: pagosCompletos,
          estado: nuevoEstado
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error al eliminar pago:", error);
      return false;
    }
  }

  // CÁLCULOS
  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo {
    // Convertir a números para asegurar cálculos correctos
    const montoPrestado = Number(datos.monto_prestado);
    const tasaInteres = Number(datos.tasa_interes);
    const numeroSemanas = Number(datos.numero_semanas);

    // Calcular el monto total de interés
    const interes = montoPrestado * (tasaInteres / 100);
    
    // Calcular el monto total a pagar (principal + interés)
    const montoTotalPagar = montoPrestado + interes;
    
    // Calcular el pago semanal (monto total dividido entre el número de semanas)
    const pagoSemanal = montoTotalPagar / numeroSemanas;
    
    return {
      monto_total_pagar: montoTotalPagar,
      pago_semanal: pagoSemanal
    };
  }

  // COBRADORES
  async getAllCobradores(): Promise<Cobrador[]> {
    return db.select().from(cobradores);
  }

  async getCobrador(id: number): Promise<Cobrador | undefined> {
    const [cobrador] = await db.select().from(cobradores).where(eq(cobradores.id, id));
    return cobrador;
  }

  async getCobradorByUserId(userId: number): Promise<Cobrador | undefined> {
    const [cobrador] = await db.select().from(cobradores).where(eq(cobradores.user_id, userId));
    return cobrador;
  }

  async createCobrador(cobrador: InsertCobrador): Promise<Cobrador> {
    const [newCobrador] = await db.insert(cobradores).values({
      ...cobrador,
      activo: true
    }).returning();
    return newCobrador;
  }

  async updateCobrador(id: number, cobradorData: Partial<Cobrador>): Promise<Cobrador | undefined> {
    const [updatedCobrador] = await db.update(cobradores)
      .set(cobradorData)
      .where(eq(cobradores.id, id))
      .returning();
    return updatedCobrador;
  }

  async deleteCobrador(id: number): Promise<boolean> {
    try {
      // Verificar si hay clientes asignados a este cobrador
      const clientesCobrador = await this.getClientesByCobrador(id);
      if (clientesCobrador.length > 0) {
        // Desasignar este cobrador de los clientes
        for (const cliente of clientesCobrador) {
          await this.updateCliente(cliente.id, {
            ...cliente,
            cobrador_id: null
          });
        }
      }
      
      await db.delete(cobradores).where(eq(cobradores.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar cobrador:", error);
      return false;
    }
  }

  async getClientesByCobrador(cobradorId: number): Promise<Cliente[]> {
    return db.select()
      .from(clientes)
      .where(eq(clientes.cobrador_id, cobradorId));
  }

  // CAJA (MOVIMIENTOS)
  async getAllMovimientosCaja(): Promise<MovimientoCaja[]> {
    return db.select().from(movimientosCaja).orderBy(desc(movimientosCaja.fecha));
  }

  async getMovimientoCaja(id: number): Promise<MovimientoCaja | undefined> {
    const [movimiento] = await db.select().from(movimientosCaja).where(eq(movimientosCaja.id, id));
    return movimiento;
  }

  async createMovimientoCaja(movimiento: InsertMovimientoCaja): Promise<MovimientoCaja> {
    const [newMovimiento] = await db.insert(movimientosCaja).values({
      ...movimiento,
      descripcion: movimiento.descripcion || null,
      cliente_id: movimiento.cliente_id || null,
      prestamo_id: movimiento.prestamo_id || null,
      fecha: new Date(movimiento.fecha)
    }).returning();
    return newMovimiento;
  }

  async deleteMovimientoCaja(id: number): Promise<boolean> {
    try {
      await db.delete(movimientosCaja).where(eq(movimientosCaja.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar movimiento de caja:", error);
      return false;
    }
  }

  async getResumenCaja(): Promise<{ 
    saldo_actual: number; 
    total_ingresos: number; 
    total_egresos: number;
    movimientos_por_dia: { fecha: string; ingreso: number; egreso: number }[] 
  }> {
    // Obtener todos los movimientos
    const allMovimientos = await this.getAllMovimientosCaja();
    
    // Calcular totales
    let totalIngresos = 0;
    let totalEgresos = 0;
    
    allMovimientos.forEach(movimiento => {
      if (movimiento.tipo === "INGRESO") {
        totalIngresos += Number(movimiento.monto);
      } else {
        totalEgresos += Number(movimiento.monto);
      }
    });
    
    const saldoActual = totalIngresos - totalEgresos;
    
    // Agrupar movimientos por día
    const movimientosPorDia: { [key: string]: { ingreso: number; egreso: number } } = {};
    
    allMovimientos.forEach(movimiento => {
      const fecha = format(new Date(movimiento.fecha), 'yyyy-MM-dd');
      
      if (!movimientosPorDia[fecha]) {
        movimientosPorDia[fecha] = { ingreso: 0, egreso: 0 };
      }
      
      if (movimiento.tipo === "INGRESO") {
        movimientosPorDia[fecha].ingreso += Number(movimiento.monto);
      } else {
        movimientosPorDia[fecha].egreso += Number(movimiento.monto);
      }
    });
    
    // Convertir a array
    const movimientosPorDiaArray = Object.keys(movimientosPorDia).map(fecha => ({
      fecha,
      ingreso: movimientosPorDia[fecha].ingreso,
      egreso: movimientosPorDia[fecha].egreso
    }));
    
    // Ordenar por fecha (más reciente primero)
    movimientosPorDiaArray.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    return {
      saldo_actual: saldoActual,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      movimientos_por_dia: movimientosPorDiaArray
    };
  }

  async getMovimientosCajaPorFecha(fechaInicio: string, fechaFin: string): Promise<MovimientoCaja[]> {
    return db.select()
      .from(movimientosCaja)
      .where(
        and(
          gte(movimientosCaja.fecha, new Date(fechaInicio)),
          lte(movimientosCaja.fecha, new Date(fechaFin))
        )
      )
      .orderBy(desc(movimientosCaja.fecha));
  }

  // CONFIGURACIONES
  async getAllConfiguraciones(): Promise<Configuracion[]> {
    return db.select().from(configuraciones);
  }

  async getConfiguracionesPorCategoria(categoria: string): Promise<Configuracion[]> {
    return db.select()
      .from(configuraciones)
      .where(eq(configuraciones.categoria, categoria));
  }

  async getConfiguracion(clave: string): Promise<Configuracion | undefined> {
    const [config] = await db.select()
      .from(configuraciones)
      .where(eq(configuraciones.clave, clave));
    return config;
  }

  async getValorConfiguracion(clave: string, valorPorDefecto: string = ""): Promise<string> {
    const config = await this.getConfiguracion(clave);
    return config ? config.valor : valorPorDefecto;
  }

  async saveConfiguracion(configuracion: InsertConfiguracion): Promise<Configuracion> {
    // Verificar si ya existe la configuración
    const configExistente = await this.getConfiguracion(configuracion.clave);
    
    if (configExistente) {
      // Actualizar en lugar de insertar
      const [updatedConfig] = await db.update(configuraciones)
        .set({ 
          valor: configuracion.valor,
          descripcion: configuracion.descripcion || null
        })
        .where(eq(configuraciones.id, configExistente.id))
        .returning();
      return updatedConfig;
    } else {
      // Insertar nueva configuración
      const [newConfig] = await db.insert(configuraciones)
        .values({
          clave: configuracion.clave,
          valor: configuracion.valor,
          tipo: configuracion.tipo,
          categoria: configuracion.categoria,
          descripcion: configuracion.descripcion || null
        })
        .returning();
      return newConfig;
    }
  }

  async updateConfiguracion(id: number, configuracion: Partial<Configuracion>): Promise<Configuracion | undefined> {
    const [updatedConfig] = await db.update(configuraciones)
      .set(configuracion)
      .where(eq(configuraciones.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteConfiguracion(id: number): Promise<boolean> {
    try {
      await db.delete(configuraciones).where(eq(configuraciones.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar configuración:", error);
      return false;
    }
  }
  
  // Obtener el siguiente documento de identidad autogenerado SIN incrementar contador
  async getSiguienteDocumentoIdentidad(): Promise<string> {
    try {
      // Obtener la configuración actual
      const configDocumento = await this.getConfiguracion('documento_siguiente_id');
      
      if (!configDocumento) {
        // Si no existe, crear la configuración con valor inicial
        console.log("Inicializando contador de documento_siguiente_id con valor 2");
        const nuevaConfig = await this.saveConfiguracion({
          clave: 'documento_siguiente_id',
          valor: '2', // El próximo será 2
          categoria: 'sistema',
          descripcion: 'Siguiente ID para documentos de clientes',
          tipo: 'NUMERO' // Agregamos el tipo que es obligatorio
        });
        return 'ID-0001';
      }
      
      // Obtener el valor actual como string
      const valorNumerico = configDocumento.valor;
      console.log("Valor actual de documento_siguiente_id:", valorNumerico);
      
      // Convertir a número para formatear correctamente
      let numero: number;
      if (valorNumerico.startsWith('ID-')) {
        // Si el valor ya tiene el prefijo, extraer el número
        numero = parseInt(valorNumerico.substring(3));
      } else {
        // Si es solo un número
        numero = parseInt(valorNumerico);
      }
      
      // Si hubo un error al parsear, usar valor por defecto
      if (isNaN(numero)) {
        console.log("Error: valor actual no es un número válido, usando 1");
        numero = 1;
      }
      
      console.log("Número formateado:", numero);
      
      // Formatear con ceros a la izquierda (4 dígitos) y prefijo ID-
      return `ID-${numero.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error("Error al obtener siguiente documento de identidad:", error);
      // En caso de error, devolver un ID secuencial predecible
      // Para evitar números aleatorios, usaremos un timestamp como fallback
      const timestamp = new Date().getTime() % 10000;
      return `ID-${timestamp.toString().padStart(4, '0')}`;
    }
  }
  
  // Incrementar y obtener el siguiente documento de identidad al guardar un cliente
  async incrementarDocumentoIdentidad(): Promise<string> {
    try {
      // Obtener la configuración actual
      const configDocumento = await this.getConfiguracion('documento_siguiente_id');
      
      if (!configDocumento) {
        // Si no existe, crear la configuración con valor inicial
        console.log("Inicializando contador de documento_siguiente_id con valor 2");
        const nuevaConfig = await this.saveConfiguracion({
          clave: 'documento_siguiente_id',
          valor: '2', // El próximo será 2
          categoria: 'sistema',
          descripcion: 'Siguiente ID para documentos de clientes',
          tipo: 'NUMERO'
        });
        return 'ID-0001';
      }
      
      // Obtener el valor actual como string
      const valorNumerico = configDocumento.valor;
      console.log("INCREMENTADOR - Valor actual de documento_siguiente_id:", valorNumerico);
      
      // Convertir a número para incrementar correctamente
      let numeroActual: number;
      if (valorNumerico.startsWith('ID-')) {
        // Si el valor ya tiene el prefijo, extraer el número
        numeroActual = parseInt(valorNumerico.substring(3));
      } else {
        // Si es solo un número
        numeroActual = parseInt(valorNumerico);
      }
      
      // Si hubo un error al parsear, usar valor por defecto
      if (isNaN(numeroActual)) {
        console.log("Error: valor actual no es un número válido, usando 1");
        numeroActual = 1;
      }
      
      // El ID actual a retornar
      const idActual = `ID-${numeroActual.toString().padStart(4, '0')}`;
      console.log("INCREMENTADOR - ID asignado:", idActual);
      
      // Incrementar para el próximo uso
      const numeroSiguiente = numeroActual + 1;
      console.log("INCREMENTADOR - Siguiente valor será:", numeroSiguiente);
      
      // Actualizar la configuración solo con el número, sin el prefijo
      await this.updateConfiguracion(configDocumento.id, {
        ...configDocumento,
        valor: numeroSiguiente.toString()
      });
      
      return idActual;
    } catch (error) {
      console.error("Error al incrementar documento de identidad:", error);
      // En caso de error, devolver un ID secuencial predecible
      const timestamp = new Date().getTime() % 10000;
      return `ID-${timestamp.toString().padStart(4, '0')}`;
    }
  }

  // Exportación/Importación de datos
  async exportarDatos(): Promise<{
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones: Configuracion[];
  }> {
    // Obtener todos los datos de cada tabla
    const [usersData, clientesData, prestamosData, pagosData, cobradoresData, movimientosData, configsData] = await Promise.all([
      db.select().from(users),
      db.select().from(clientes),
      db.select().from(prestamos),
      db.select().from(pagos),
      db.select().from(cobradores),
      db.select().from(movimientosCaja),
      db.select().from(configuraciones)
    ]);
    
    return {
      users: usersData,
      clientes: clientesData,
      prestamos: prestamosData,
      pagos: pagosData,
      cobradores: cobradoresData,
      movimientosCaja: movimientosData,
      configuraciones: configsData
    };
  }

  async importarDatos(datos: {
    users: User[];
    clientes: Cliente[];
    prestamos: Prestamo[];
    pagos: Pago[];
    cobradores: Cobrador[];
    movimientosCaja: MovimientoCaja[];
    configuraciones?: Configuracion[];
  }): Promise<boolean> {
    try {
      // Limpiar todas las tablas (en orden inverso para respetar las restricciones de integridad)
      await db.delete(pagos);
      await db.delete(prestamos);
      await db.delete(movimientosCaja);
      await db.delete(clientes);
      await db.delete(cobradores);
      await db.delete(configuraciones);
      // No eliminamos los usuarios para mantener el administrador
      
      // Función auxiliar para convertir campos de fecha
      const convertirFechasEnObjeto = <T extends Record<string, any>>(objeto: T): T => {
        const resultado = { ...objeto };
        
        // Lista de campos que podrían contener fechas
        const camposFecha = [
          'fecha_registro', 'fecha_prestamo', 'proxima_fecha_pago', 
          'fecha_inicial_personalizada', 'fecha_pago', 'fecha'
        ];
        
        for (const campo of camposFecha) {
          if (campo in resultado && resultado[campo] !== null && !(resultado[campo] instanceof Date)) {
            try {
              resultado[campo] = new Date(resultado[campo]);
              // Verificar que la conversión fue exitosa
              if (isNaN(resultado[campo].getTime())) {
                console.warn(`Campo ${campo} tiene una fecha inválida:`, resultado[campo]);
                // Usar fecha actual como fallback para evitar errores
                resultado[campo] = new Date();
              }
            } catch (err) {
              console.warn(`Error al convertir campo ${campo}:`, err);
              // Usar fecha actual como fallback
              resultado[campo] = new Date();
            }
          }
        }
        return resultado;
      };
      
      // Importar configuraciones
      if (datos.configuraciones && datos.configuraciones.length > 0) {
        await db.insert(configuraciones).values(datos.configuraciones);
      }
      
      // Importar cobradores
      if (datos.cobradores.length > 0) {
        await db.insert(cobradores).values(datos.cobradores);
      }
      
      // Importar clientes
      if (datos.clientes.length > 0) {
        // Convertir fechas en cada cliente
        const clientesConFechasCorrectas = datos.clientes.map(convertirFechasEnObjeto);
        await db.insert(clientes).values(clientesConFechasCorrectas);
      }
      
      // Importar movimientos de caja
      if (datos.movimientosCaja.length > 0) {
        // Convertir fechas en cada movimiento
        const movimientosConFechasCorrectas = datos.movimientosCaja.map(convertirFechasEnObjeto);
        await db.insert(movimientosCaja).values(movimientosConFechasCorrectas);
      }
      
      // Importar préstamos
      if (datos.prestamos.length > 0) {
        // Convertir fechas en cada préstamo
        const prestamosConFechasCorrectas = datos.prestamos.map(convertirFechasEnObjeto);
        await db.insert(prestamos).values(prestamosConFechasCorrectas);
      }
      
      // Importar pagos
      if (datos.pagos.length > 0) {
        // Convertir fechas en cada pago
        const pagosConFechasCorrectas = datos.pagos.map(convertirFechasEnObjeto);
        await db.insert(pagos).values(pagosConFechasCorrectas);
      }
      
      return true;
    } catch (error) {
      console.error("Error al importar datos:", error);
      return false;
    }
  }

  // Configuraciones predeterminadas
  private async initConfiguracionesPredeterminadas() {
    // Verificar si ya existen configuraciones
    const configsExistentes = await this.getAllConfiguraciones();
    if (configsExistentes.length > 0) {
      console.log("Configuraciones ya inicializadas, saltando creación de valores predeterminados");
      return;
    }

    // Configuraciones generales
    await this.saveConfiguracion({
      clave: "NOMBRE_EMPRESA",
      valor: "Mi Empresa de Préstamos",
      descripcion: "Nombre de la empresa",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });

    await this.saveConfiguracion({
      clave: "DIRECCION_EMPRESA",
      valor: "Calle Principal 123",
      descripcion: "Dirección de la empresa",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });

    await this.saveConfiguracion({
      clave: "TELEFONO_EMPRESA",
      valor: "+1234567890",
      descripcion: "Teléfono de contacto",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });

    await this.saveConfiguracion({
      clave: "EMAIL_EMPRESA",
      valor: "contacto@empresaprestamos.com",
      descripcion: "Email de contacto",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });

    await this.saveConfiguracion({
      clave: "MONEDA",
      valor: "$",
      descripcion: "Símbolo de moneda",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });
    
    await this.saveConfiguracion({
      clave: "PREFIJO_DOCUMENTO",
      valor: "ID-",
      descripcion: "Prefijo para documentos de identidad",
      tipo: "TEXTO",
      categoria: "GENERAL"
    });
    
    await this.saveConfiguracion({
      clave: "ULTIMO_DOCUMENTO",
      valor: "0",
      descripcion: "Último número de documento generado",
      tipo: "NUMERO",
      categoria: "GENERAL"
    });

    // Configuraciones de préstamos
    await this.saveConfiguracion({
      clave: "TASA_INTERES_DEFECTO",
      valor: "20",
      descripcion: "Tasa de interés por defecto",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    await this.saveConfiguracion({
      clave: "TASA_MORA_DEFECTO",
      valor: "5",
      descripcion: "Tasa de mora por defecto",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    await this.saveConfiguracion({
      clave: "SEMANAS_PRESTAMO_DEFECTO",
      valor: "4",
      descripcion: "Número de semanas por defecto para préstamos",
      tipo: "NUMERO",
      categoria: "PRESTAMOS"
    });

    await this.saveConfiguracion({
      clave: "FRECUENCIA_PAGO_DEFECTO",
      valor: "SEMANAL",
      descripcion: "Frecuencia de pago por defecto",
      tipo: "TEXTO",
      categoria: "PRESTAMOS"
    });

    // Configuraciones de pagos
    await this.saveConfiguracion({
      clave: "DIAS_GRACIA",
      valor: "3",
      descripcion: "Días de gracia antes de aplicar mora",
      tipo: "NUMERO",
      categoria: "PAGOS"
    });

    await this.saveConfiguracion({
      clave: "PERMITIR_PAGOS_PARCIALES",
      valor: "true",
      descripcion: "Permitir pagos parciales",
      tipo: "BOOLEANO",
      categoria: "PAGOS"
    });

    // Configuraciones del sistema
    await this.saveConfiguracion({
      clave: "RESPALDO_AUTOMATICO",
      valor: "false",
      descripcion: "Realizar respaldos automáticos",
      tipo: "BOOLEANO",
      categoria: "SISTEMA"
    });

    await this.saveConfiguracion({
      clave: "INTERVALO_RESPALDO",
      valor: "7",
      descripcion: "Intervalo de respaldos automáticos en días",
      tipo: "NUMERO",
      categoria: "SISTEMA"
    });
  }
}

// Importamos la nueva JsonStorage como respaldo
import { JsonStorage } from './json-storage';

// Usamos DatabaseStorage que utiliza PostgreSQL para almacenamiento permanente
// Esto garantiza que los datos se conserven incluso cuando la aplicación esté inactiva
// Temporalmente usamos MemStorage para garantizar el funcionamiento
// mientras resolvemos los problemas con PostgreSQL
// Cambiamos de MemStorage a DatabaseStorage para persistencia de datos
export const storage = new DatabaseStorage();
