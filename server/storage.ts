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
  InsertMovimientoCaja
} from "@shared/schema";
import { addDays, differenceInDays, format } from "date-fns";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

// Interfaz para el almacenamiento de datos
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

export const storage = new MemStorage();