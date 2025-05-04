import fs from 'fs/promises';
import path from 'path';
import { IStorage } from './storage';
import {
  User, Cliente, Prestamo, Pago, Cobrador, MovimientoCaja, Configuracion,
  InsertUser, InsertCliente, InsertPrestamo, InsertPago, InsertCobrador, 
  InsertMovimientoCaja, InsertConfiguracion, CalculoPrestamo, ResultadoCalculoPrestamo
} from '@shared/schema';
import { hashPassword } from './auth';

// Directorio donde se almacenarán los archivos JSON
const DATA_DIR = path.join(process.cwd(), 'data');

export class JsonStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private clientes: Map<number, Cliente> = new Map();
  private prestamos: Map<number, Prestamo> = new Map();
  private pagos: Map<number, Pago> = new Map();
  private cobradores: Map<number, Cobrador> = new Map();
  private movimientosCaja: Map<number, MovimientoCaja> = new Map();
  private configuraciones: Map<number, Configuracion> = new Map();
  
  private nextUserId: number = 1;
  private nextClienteId: number = 1;
  private nextPrestamoId: number = 1;
  private nextPagoId: number = 1;
  private nextCobradorId: number = 1;
  private nextMovimientoCajaId: number = 1;
  private nextConfiguracionId: number = 1;
  
  sessionStore: any;

  constructor() {
    // Inicializar el session store (memorystore)
    this.initializeSessionStore();
    
    // Cargar datos existentes
    this.loadAllData().then(() => {
      console.log('Datos cargados desde archivos JSON');
      
      // Verificar que los IDs de secuencia estén correctamente inicializados
      this.updateSequenceIds();
      
      // Inicializar datos de muestra si no existen datos
      this.initializeSampleDataIfNeeded();
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      
      // Crear el directorio de datos si no existe
      this.ensureDataDir().then(() => {
        // Inicializar datos de muestra
        this.initializeSampleData();
      });
    });
  }

  // Método para garantizar que el directorio de datos exista
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Error al crear directorio de datos:', error);
    }
  }

  // Método para inicializar el session store
  private initializeSessionStore() {
    // Importaciones dinámicas para SessionStore
    import('express-session').then(sessionModule => {
      import('memorystore').then(memoryStoreModule => {
        const MemoryStore = memoryStoreModule.default(sessionModule.default);
        
        this.sessionStore = new MemoryStore({
          checkPeriod: 86400000 // Limpiar las sesiones expiradas cada 24h
        });
      });
    });
    
    // Temporal store hasta que se complete la importación dinámica
    this.sessionStore = {
      get: () => {},
      set: () => {},
      destroy: () => {},
    };
  }

  // Método para cargar todos los datos desde archivos JSON
  private async loadAllData(): Promise<void> {
    await this.ensureDataDir();
    
    // Cargar usuarios
    try {
      const usersData = await this.readJsonFile<User[]>('users.json', []);
      this.users = new Map(usersData.map(user => [user.id, user]));
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      this.users = new Map();
    }
    
    // Cargar clientes
    try {
      const clientesData = await this.readJsonFile<Cliente[]>('clientes.json', []);
      this.clientes = new Map(clientesData.map(cliente => [cliente.id, cliente]));
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      this.clientes = new Map();
    }
    
    // Cargar préstamos
    try {
      const prestamosData = await this.readJsonFile<Prestamo[]>('prestamos.json', []);
      this.prestamos = new Map(prestamosData.map(prestamo => [prestamo.id, prestamo]));
    } catch (error) {
      console.error('Error al cargar préstamos:', error);
      this.prestamos = new Map();
    }
    
    // Cargar pagos
    try {
      const pagosData = await this.readJsonFile<Pago[]>('pagos.json', []);
      this.pagos = new Map(pagosData.map(pago => [pago.id, pago]));
    } catch (error) {
      console.error('Error al cargar pagos:', error);
      this.pagos = new Map();
    }
    
    // Cargar cobradores
    try {
      const cobradoresData = await this.readJsonFile<Cobrador[]>('cobradores.json', []);
      this.cobradores = new Map(cobradoresData.map(cobrador => [cobrador.id, cobrador]));
    } catch (error) {
      console.error('Error al cargar cobradores:', error);
      this.cobradores = new Map();
    }
    
    // Cargar movimientos de caja
    try {
      const movimientosData = await this.readJsonFile<MovimientoCaja[]>('movimientos_caja.json', []);
      this.movimientosCaja = new Map(movimientosData.map(movimiento => [movimiento.id, movimiento]));
    } catch (error) {
      console.error('Error al cargar movimientos de caja:', error);
      this.movimientosCaja = new Map();
    }
    
    // Cargar configuraciones
    try {
      const configuracionesData = await this.readJsonFile<Configuracion[]>('configuraciones.json', []);
      this.configuraciones = new Map(configuracionesData.map(config => [config.id, config]));
    } catch (error) {
      console.error('Error al cargar configuraciones:', error);
      this.configuraciones = new Map();
      // Inicializar configuraciones predeterminadas
      await this.initConfiguracionesPredeterminadas();
    }
  }

  // Método para guardar todos los datos en archivos JSON
  private async saveAllData(): Promise<void> {
    await this.ensureDataDir();
    
    // Guardar usuarios
    await this.writeJsonFile('users.json', Array.from(this.users.values()));
    
    // Guardar clientes
    await this.writeJsonFile('clientes.json', Array.from(this.clientes.values()));
    
    // Guardar préstamos
    await this.writeJsonFile('prestamos.json', Array.from(this.prestamos.values()));
    
    // Guardar pagos
    await this.writeJsonFile('pagos.json', Array.from(this.pagos.values()));
    
    // Guardar cobradores
    await this.writeJsonFile('cobradores.json', Array.from(this.cobradores.values()));
    
    // Guardar movimientos de caja
    await this.writeJsonFile('movimientos_caja.json', Array.from(this.movimientosCaja.values()));
    
    // Guardar configuraciones
    await this.writeJsonFile('configuraciones.json', Array.from(this.configuraciones.values()));
  }

  // Métodos de utilidad para leer y escribir archivos JSON
  private async readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
    try {
      const filePath = path.join(DATA_DIR, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      // Si el archivo no existe, devolver el valor predeterminado
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
    try {
      const filePath = path.join(DATA_DIR, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error al escribir el archivo ${filename}:`, error);
    }
  }

  // Actualizar los IDs de secuencia basados en los datos cargados
  private updateSequenceIds(): void {
    if (this.users.size > 0) {
      this.nextUserId = Math.max(...Array.from(this.users.keys())) + 1;
    }
    
    if (this.clientes.size > 0) {
      this.nextClienteId = Math.max(...Array.from(this.clientes.keys())) + 1;
    }
    
    if (this.prestamos.size > 0) {
      this.nextPrestamoId = Math.max(...Array.from(this.prestamos.keys())) + 1;
    }
    
    if (this.pagos.size > 0) {
      this.nextPagoId = Math.max(...Array.from(this.pagos.keys())) + 1;
    }
    
    if (this.cobradores.size > 0) {
      this.nextCobradorId = Math.max(...Array.from(this.cobradores.keys())) + 1;
    }
    
    if (this.movimientosCaja.size > 0) {
      this.nextMovimientoCajaId = Math.max(...Array.from(this.movimientosCaja.keys())) + 1;
    }
    
    if (this.configuraciones.size > 0) {
      this.nextConfiguracionId = Math.max(...Array.from(this.configuraciones.keys())) + 1;
    }
  }

  // Verificar si se necesita inicializar datos de muestra
  private async initializeSampleDataIfNeeded(): Promise<void> {
    // Si no hay usuarios, inicializar datos de muestra
    if (this.users.size === 0) {
      await this.initializeSampleData();
    } else {
      // Asegurarse de que exista el usuario administrador
      const adminUser = Array.from(this.users.values()).find(user => 
        user.username === 'admin@sistema.com' && user.rol === 'ADMIN'
      );
      
      if (!adminUser) {
        await this.createAdminUser();
      }
    }
    
    // Asegurarse de que existan configuraciones básicas
    if (this.configuraciones.size === 0) {
      await this.initConfiguracionesPredeterminadas();
    }
  }

  // Inicializar datos de muestra
  private async initializeSampleData(): Promise<void> {
    console.log('Inicializando datos de muestra...');
    
    // Crear usuario administrador
    await this.createAdminUser();
    
    // Inicializar configuraciones predeterminadas
    await this.initConfiguracionesPredeterminadas();
    
    // Guardar todos los datos
    await this.saveAllData();
  }

  // Crear usuario administrador
  private async createAdminUser(): Promise<void> {
    const adminPassword = 'admin123';
    const hashedPassword = await hashPassword(adminPassword);
    
    const adminUser: User = {
      id: this.nextUserId++,
      username: 'admin@sistema.com',
      password: hashedPassword,
      nombre: 'Administrador',
      email: 'admin@sistema.com',
      rol: 'ADMIN',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.users.set(adminUser.id, adminUser);
    console.log('Usuario administrador creado:', adminUser.id);
  }

  // Inicializar configuraciones predeterminadas
  private async initConfiguracionesPredeterminadas(): Promise<void> {
    const configuracionesPredeterminadas = [
      {
        clave: 'empresa_nombre',
        valor: 'Mi Empresa de Préstamos',
        categoria: 'empresa',
        descripcion: 'Nombre de la empresa'
      },
      {
        clave: 'empresa_direccion',
        valor: 'Calle Principal #123',
        categoria: 'empresa',
        descripcion: 'Dirección de la empresa'
      },
      {
        clave: 'empresa_telefono',
        valor: '123-456-7890',
        categoria: 'empresa',
        descripcion: 'Teléfono de contacto'
      },
      {
        clave: 'prestamo_tasa_default',
        valor: '10',
        categoria: 'prestamos',
        descripcion: 'Tasa de interés predeterminada para préstamos'
      },
      {
        clave: 'prestamo_plazo_default',
        valor: '12',
        categoria: 'prestamos',
        descripcion: 'Plazo predeterminado para préstamos (en semanas)'
      },
      {
        clave: 'documento_siguiente_id',
        valor: '1000',
        categoria: 'sistema',
        descripcion: 'Siguiente ID para documentos de clientes'
      }
    ];
    
    for (const config of configuracionesPredeterminadas) {
      // Verificar si la configuración ya existe
      const existeConfig = Array.from(this.configuraciones.values()).find(c => c.clave === config.clave);
      
      if (!existeConfig) {
        const nuevaConfig: Configuracion = {
          id: this.nextConfiguracionId++,
          ...config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        this.configuraciones.set(nuevaConfig.id, nuevaConfig);
      }
    }
    
    console.log('Configuraciones predeterminadas inicializadas');
  }

  // Implementación de los métodos de IStorage
  
  // Métodos para usuarios
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getAllUsers(): Promise<Map<number, User>> {
    return this.users;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user: User = {
      id: this.nextUserId++,
      ...userData,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.users.set(user.id, user);
    await this.saveAllData();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const userActualizado: User = { 
      ...user,
      ...userData,
      updated_at: new Date().toISOString()
    };
    
    this.users.set(id, userActualizado);
    await this.saveAllData();
    return userActualizado;
  }

  async updateUserPassword(id: number, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    user.password = newPassword;
    user.updated_at = new Date().toISOString();
    
    this.users.set(id, user);
    await this.saveAllData();
    return true;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = this.users.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  // Métodos para clientes
  async getAllClientes(): Promise<Cliente[]> {
    return Array.from(this.clientes.values());
  }

  async getCliente(id: number): Promise<Cliente | undefined> {
    return this.clientes.get(id);
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    // Obtener siguiente ID de documento
    let docId = '1000';
    try {
      const config = Array.from(this.configuraciones.values()).find(c => c.clave === 'documento_siguiente_id');
      if (config) {
        docId = config.valor;
        
        // Incrementar el valor para el siguiente uso
        const nextId = (parseInt(docId) + 1).toString();
        await this.updateConfiguracion(config.id, {
          ...config,
          valor: nextId
        });
      }
    } catch (error) {
      console.error('Error al obtener siguiente ID de documento:', error);
    }
    
    const nuevoCliente: Cliente = { 
      id: this.nextClienteId++,
      ...cliente,
      documento_identidad: cliente.documento_identidad || `CL-${docId}`,
      cobrador_id: cliente.cobrador_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.clientes.set(nuevoCliente.id, nuevoCliente);
    await this.saveAllData();
    return nuevoCliente;
  }

  async updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined> {
    const clienteExistente = this.clientes.get(id);
    if (!clienteExistente) return undefined;
    
    const clienteActualizado: Cliente = { 
      ...clienteExistente,
      ...cliente,
      id,
      updated_at: new Date().toISOString()
    };
    
    this.clientes.set(id, clienteActualizado);
    await this.saveAllData();
    return clienteActualizado;
  }

  async deleteCliente(id: number): Promise<boolean> {
    const result = this.clientes.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  // Métodos para préstamos
  async getAllPrestamos(): Promise<Prestamo[]> {
    return Array.from(this.prestamos.values());
  }

  async getPrestamosByClienteId(clienteId: number): Promise<Prestamo[]> {
    return Array.from(this.prestamos.values()).filter(prestamo => prestamo.cliente_id === clienteId);
  }

  async getPrestamo(id: number): Promise<Prestamo | undefined> {
    return this.prestamos.get(id);
  }

  async createPrestamo(prestamo: InsertPrestamo): Promise<Prestamo> {
    const nuevoPrestamo: Prestamo = {
      id: this.nextPrestamoId++,
      ...prestamo,
      monto_pagado: 0,
      estado: "PENDIENTE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.prestamos.set(nuevoPrestamo.id, nuevoPrestamo);
    await this.saveAllData();
    return nuevoPrestamo;
  }

  async updatePrestamo(id: number, prestamo: Partial<Prestamo>): Promise<Prestamo | undefined> {
    const prestamoExistente = this.prestamos.get(id);
    if (!prestamoExistente) return undefined;
    
    const prestamoActualizado: Prestamo = {
      ...prestamoExistente,
      ...prestamo,
      updated_at: new Date().toISOString()
    };
    
    this.prestamos.set(id, prestamoActualizado);
    await this.saveAllData();
    return prestamoActualizado;
  }

  async deletePrestamo(id: number): Promise<boolean> {
    const result = this.prestamos.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  // Métodos para pagos
  async getAllPagos(): Promise<Pago[]> {
    return Array.from(this.pagos.values());
  }

  async getPagosByPrestamoId(prestamoId: number): Promise<Pago[]> {
    return Array.from(this.pagos.values()).filter(pago => pago.prestamo_id === prestamoId);
  }

  async getTotalPagadoByPrestamoId(prestamoId: number): Promise<number> {
    const pagos = await this.getPagosByPrestamoId(prestamoId);
    return pagos.reduce((total, pago) => total + pago.monto_pagado, 0);
  }

  async getTotalPagadoByClienteId(clienteId: number): Promise<number> {
    // Obtener todos los préstamos del cliente
    const prestamos = await this.getPrestamosByClienteId(clienteId);
    let totalPagado = 0;
    
    // Sumar el total pagado para cada préstamo
    for (const prestamo of prestamos) {
      totalPagado += await this.getTotalPagadoByPrestamoId(prestamo.id);
    }
    
    return totalPagado;
  }

  async createPago(pago: InsertPago): Promise<Pago> {
    const nuevoPago: Pago = {
      id: this.nextPagoId++,
      ...pago,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.pagos.set(nuevoPago.id, nuevoPago);
    
    // Actualizar monto pagado y estado del préstamo
    const prestamo = this.prestamos.get(nuevoPago.prestamo_id);
    if (prestamo) {
      const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
      const totalPagado = pagosPrestamo.reduce((total, p) => total + p.monto_pagado, 0);
      
      // Actualizar préstamo
      await this.updatePrestamo(prestamo.id, {
        monto_pagado: totalPagado,
        estado: totalPagado >= prestamo.monto_total_pagar ? 'PAGADO' : 'PENDIENTE',
        proxima_fecha_pago: pago.proxima_fecha_pago
      });
    }
    
    await this.saveAllData();
    return nuevoPago;
  }

  async updatePago(id: number, pago: Partial<Pago>): Promise<Pago | undefined> {
    const pagoExistente = this.pagos.get(id);
    if (!pagoExistente) return undefined;
    
    const pagoActualizado: Pago = {
      ...pagoExistente,
      ...pago,
      updated_at: new Date().toISOString()
    };
    
    this.pagos.set(id, pagoActualizado);
    
    // Si cambia el monto, actualizar también el préstamo
    if (pago.monto_pagado !== undefined) {
      const prestamo = this.prestamos.get(pagoExistente.prestamo_id);
      if (prestamo) {
        const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
        const totalPagado = pagosPrestamo.reduce((total, p) => total + p.monto_pagado, 0);
        
        // Actualizar préstamo
        await this.updatePrestamo(prestamo.id, {
          monto_pagado: totalPagado,
          estado: totalPagado >= prestamo.monto_total_pagar ? 'PAGADO' : 'PENDIENTE'
        });
      }
    }
    
    await this.saveAllData();
    return pagoActualizado;
  }

  async deletePago(id: number): Promise<boolean> {
    const pago = this.pagos.get(id);
    if (!pago) return false;
    
    const prestamoId = pago.prestamo_id;
    const result = this.pagos.delete(id);
    
    if (result) {
      // Actualizar monto pagado y estado del préstamo
      const prestamo = this.prestamos.get(prestamoId);
      if (prestamo) {
        const pagosPrestamo = await this.getPagosByPrestamoId(prestamo.id);
        const totalPagado = pagosPrestamo.reduce((total, p) => total + p.monto_pagado, 0);
        
        // Actualizar préstamo
        await this.updatePrestamo(prestamo.id, {
          monto_pagado: totalPagado,
          estado: totalPagado >= prestamo.monto_total_pagar ? 'PAGADO' : 'PENDIENTE'
        });
      }
      
      await this.saveAllData();
    }
    
    return result;
  }

  // Método para cálculo de préstamos
  calcularPrestamo(datos: CalculoPrestamo): ResultadoCalculoPrestamo {
    const { monto_prestado, tasa_interes, numero_semanas, frecuencia_pago } = datos;
    
    // Calcular interés total
    const interes = (monto_prestado * tasa_interes) / 100;
    
    // Calcular monto total a pagar
    const montoTotalPagar = monto_prestado + interes;
    
    // Calcular pago según frecuencia
    let pagoRegular: number;
    let totalPagos: number;
    
    switch (frecuencia_pago) {
      case 'SEMANAL':
        pagoRegular = montoTotalPagar / numero_semanas;
        totalPagos = numero_semanas;
        break;
      case 'QUINCENAL':
        pagoRegular = montoTotalPagar / (numero_semanas / 2);
        totalPagos = numero_semanas / 2;
        break;
      case 'MENSUAL':
        pagoRegular = montoTotalPagar / (numero_semanas / 4);
        totalPagos = numero_semanas / 4;
        break;
      default:
        pagoRegular = montoTotalPagar / numero_semanas;
        totalPagos = numero_semanas;
    }
    
    // Redondear a 2 decimales
    pagoRegular = Math.ceil(pagoRegular * 100) / 100;
    
    return {
      monto_prestado,
      interes,
      tasa_interes,
      monto_total_pagar: montoTotalPagar,
      pago_regular: pagoRegular,
      numero_pagos: totalPagos,
      frecuencia_pago
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
    const nuevoMovimiento: MovimientoCaja = {
      id: this.nextMovimientoCajaId++,
      ...movimiento,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.movimientosCaja.set(nuevoMovimiento.id, nuevoMovimiento);
    await this.saveAllData();
    return nuevoMovimiento;
  }

  async deleteMovimientoCaja(id: number): Promise<boolean> {
    const result = this.movimientosCaja.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  async getResumenCaja(): Promise<{ 
    saldo_actual: number; 
    total_ingresos: number; 
    total_egresos: number;
    movimientos_por_dia: { fecha: string; ingreso: number; egreso: number }[] 
  }> {
    const movimientos = Array.from(this.movimientosCaja.values());
    
    // Calcular totales
    let totalIngresos = 0;
    let totalEgresos = 0;
    
    for (const mov of movimientos) {
      if (mov.tipo === 'INGRESO') {
        totalIngresos += mov.monto;
      } else {
        totalEgresos += mov.monto;
      }
    }
    
    const saldoActual = totalIngresos - totalEgresos;
    
    // Calcular movimientos por día
    const movimientosPorDia: Map<string, { ingreso: number; egreso: number }> = new Map();
    
    for (const mov of movimientos) {
      const fecha = mov.fecha;
      if (!movimientosPorDia.has(fecha)) {
        movimientosPorDia.set(fecha, { ingreso: 0, egreso: 0 });
      }
      
      const datosFecha = movimientosPorDia.get(fecha)!;
      
      if (mov.tipo === 'INGRESO') {
        datosFecha.ingreso += mov.monto;
      } else {
        datosFecha.egreso += mov.monto;
      }
      
      movimientosPorDia.set(fecha, datosFecha);
    }
    
    // Convertir a array para devolver
    const movimientosPorDiaArray = Array.from(movimientosPorDia.entries()).map(([fecha, datos]) => ({
      fecha,
      ingreso: datos.ingreso,
      egreso: datos.egreso
    }));
    
    // Ordenar por fecha descendente
    movimientosPorDiaArray.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    return {
      saldo_actual: saldoActual,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      movimientos_por_dia: movimientosPorDiaArray
    };
  }

  async getMovimientosCajaPorFecha(fechaInicio: string, fechaFin: string): Promise<MovimientoCaja[]> {
    const movimientos = Array.from(this.movimientosCaja.values());
    
    return movimientos.filter(mov => {
      const fechaMovimiento = mov.fecha;
      return fechaMovimiento >= fechaInicio && fechaMovimiento <= fechaFin;
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
    return Array.from(this.cobradores.values()).find(cobrador => cobrador.usuario_id === userId);
  }

  async createCobrador(cobrador: InsertCobrador): Promise<Cobrador> {
    const nuevoCobrador: Cobrador = { 
      id: this.nextCobradorId++,
      ...cobrador,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.cobradores.set(nuevoCobrador.id, nuevoCobrador);
    await this.saveAllData();
    return nuevoCobrador;
  }

  async updateCobrador(id: number, cobrador: Partial<Cobrador>): Promise<Cobrador | undefined> {
    const cobradorExistente = this.cobradores.get(id);
    if (!cobradorExistente) return undefined;
    
    const cobradorActualizado: Cobrador = { 
      ...cobradorExistente,
      ...cobrador,
      updated_at: new Date().toISOString()
    };
    
    this.cobradores.set(id, cobradorActualizado);
    await this.saveAllData();
    return cobradorActualizado;
  }

  async deleteCobrador(id: number): Promise<boolean> {
    const result = this.cobradores.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  async getClientesByCobrador(cobradorId: number): Promise<Cliente[]> {
    return Array.from(this.clientes.values()).filter(cliente => cliente.cobrador_id === cobradorId);
  }

  // Métodos para configuraciones
  async getAllConfiguraciones(): Promise<Configuracion[]> {
    return Array.from(this.configuraciones.values());
  }

  async getConfiguracionesPorCategoria(categoria: string): Promise<Configuracion[]> {
    return Array.from(this.configuraciones.values()).filter(config => config.categoria === categoria);
  }

  async getConfiguracion(clave: string): Promise<Configuracion | undefined> {
    return Array.from(this.configuraciones.values()).find(config => config.clave === clave);
  }

  async getValorConfiguracion(clave: string, valorPorDefecto: string = ""): Promise<string> {
    const config = await this.getConfiguracion(clave);
    return config ? config.valor : valorPorDefecto;
  }

  async getSiguienteDocumentoIdentidad(): Promise<string> {
    // Obtener la configuración actual
    const configDocumento = await this.getConfiguracion('documento_siguiente_id');
    
    if (!configDocumento) {
      // Si no existe, crear la configuración con valor inicial
      const nuevaConfig = await this.saveConfiguracion({
        clave: 'documento_siguiente_id',
        valor: '1001',
        categoria: 'sistema',
        descripcion: 'Siguiente ID para documentos de clientes'
      });
      return '1001';
    }
    
    // Obtener el valor actual
    const valorActual = configDocumento.valor;
    
    // Incrementar para el próximo uso
    const valorSiguiente = (parseInt(valorActual) + 1).toString();
    
    // Actualizar la configuración
    await this.updateConfiguracion(configDocumento.id, {
      ...configDocumento,
      valor: valorSiguiente
    });
    
    return valorActual;
  }

  async saveConfiguracion(configuracion: InsertConfiguracion): Promise<Configuracion> {
    const nuevaConfig: Configuracion = {
      id: this.nextConfiguracionId++,
      ...configuracion,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.configuraciones.set(nuevaConfig.id, nuevaConfig);
    await this.saveAllData();
    return nuevaConfig;
  }

  async updateConfiguracion(id: number, configuracion: Partial<Configuracion>): Promise<Configuracion | undefined> {
    const configExistente = this.configuraciones.get(id);
    if (!configExistente) return undefined;
    
    const configActualizada: Configuracion = {
      ...configExistente,
      ...configuracion,
      updated_at: new Date().toISOString()
    };
    
    this.configuraciones.set(id, configActualizada);
    await this.saveAllData();
    return configActualizada;
  }

  async deleteConfiguracion(id: number): Promise<boolean> {
    const result = this.configuraciones.delete(id);
    if (result) {
      await this.saveAllData();
    }
    return result;
  }

  // Métodos para exportar/importar datos
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
      configuraciones: Array.from(this.configuraciones.values()),
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
      // Reemplazar datos actuales con los importados
      this.users = new Map(datos.users.map(user => [user.id, user]));
      this.clientes = new Map(datos.clientes.map(cliente => [cliente.id, cliente]));
      this.prestamos = new Map(datos.prestamos.map(prestamo => [prestamo.id, prestamo]));
      this.pagos = new Map(datos.pagos.map(pago => [pago.id, pago]));
      this.cobradores = new Map(datos.cobradores.map(cobrador => [cobrador.id, cobrador]));
      this.movimientosCaja = new Map(datos.movimientosCaja.map(movimiento => [movimiento.id, movimiento]));
      
      // Importar configuraciones si se proporcionan
      if (datos.configuraciones) {
        this.configuraciones = new Map(datos.configuraciones.map(config => [config.id, config]));
      }
      
      // Actualizar los IDs de secuencia
      this.updateSequenceIds();
      
      // Guardar datos
      await this.saveAllData();
      return true;
    } catch (error) {
      console.error('Error al importar datos:', error);
      return false;
    }
  }
}
