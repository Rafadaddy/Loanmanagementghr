import { Cliente, InsertCliente, Prestamo, InsertPrestamo, Pago, InsertPago, User, InsertUser, ResultadoCalculoPrestamo, CalculoPrestamo } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { addDays, format, differenceInDays } from "date-fns";

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
  deletePrestamo(id: number): Promise<boolean>;
  
  // Pagos
  getAllPagos(): Promise<Pago[]>;
  getPagosByPrestamoId(prestamoId: number): Promise<Pago[]>;
  createPago(pago: InsertPago): Promise<Pago>;
  deletePago(id: number): Promise<boolean>;
  
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
    
    // Inicializar datos de ejemplo
    this.initializeSampleData();
  }
  
  private async initializeSampleData() {
    // Crear un usuario administrador si no existe
    if (this.users.size === 0) {
      const adminUser: InsertUser = {
        nombre: "Administrador",
        username: "super_rafaga@gmail.com",
        password: "$2b$10$X4jG0tjVN17aFFqIuJYI7u6hHBhTIFxZgnm9jzQ9uE3xsRIRW6D0O" // Contraseña: admin123
      };
      await this.createUser(adminUser);
    }
    
    // Crear algunos clientes de ejemplo
    const clientesEjemplo: InsertCliente[] = [
      {
        nombre: "María González",
        telefono: "555-123-4567",
        direccion: "Calle Principal 123, Centro",
        documento_identidad: "12345678A",
        email: "maria@example.com",
        notas: "Cliente frecuente, siempre paga a tiempo"
      },
      {
        nombre: "Juan Pérez",
        telefono: "555-987-6543",
        direccion: "Avenida Central 456, Norte",
        documento_identidad: "87654321B",
        email: "juan@example.com",
        notas: "Prefiere pagos semanales"
      },
      {
        nombre: "Ana Rodríguez",
        telefono: "555-456-7890",
        direccion: "Calle Secundaria 789, Sur",
        documento_identidad: "56781234C",
        email: "ana@example.com",
        notas: "Trabaja en mercado local"
      },
      {
        nombre: "Carlos López",
        telefono: "555-789-1234",
        direccion: "Boulevard Principal 321, Este",
        documento_identidad: "43217865D",
        email: "carlos@example.com",
        notas: "Comerciante de abarrotes"
      },
      {
        nombre: "Sofía Martínez",
        telefono: "555-234-5678",
        direccion: "Calle Comercial 654, Oeste",
        documento_identidad: "98761234E",
        email: "sofia@example.com",
        notas: "Tiene tienda de ropa"
      }
    ];
    
    // Crear los clientes solo si no hay clientes existentes
    if (this.clientes.size === 0) {
      for (const cliente of clientesEjemplo) {
        await this.createCliente(cliente);
      }
      
      // Crear préstamos de ejemplo para los clientes
      const hoy = new Date();
      const manana = addDays(hoy, 1);
      const ayer = addDays(hoy, -1);
      const proximaSemana = addDays(hoy, 7);
      
      const prestamosEjemplo: InsertPrestamo[] = [
        {
          cliente_id: 1,
          monto_prestado: "5000",
          tasa_interes: "20",
          fecha_prestamo: format(ayer, 'yyyy-MM-dd'),
          frecuencia_pago: "SEMANAL",
          numero_semanas: 12,
          pago_semanal: "458.33",
          monto_total_pagar: "5500",
          proxima_fecha_pago: format(manana, 'yyyy-MM-dd')
        },
        {
          cliente_id: 2,
          monto_prestado: "10000",
          tasa_interes: "15",
          fecha_prestamo: format(addDays(hoy, -15), 'yyyy-MM-dd'),
          frecuencia_pago: "SEMANAL",
          numero_semanas: 16,
          pago_semanal: "687.50",
          monto_total_pagar: "11000",
          proxima_fecha_pago: format(hoy, 'yyyy-MM-dd')
        },
        {
          cliente_id: 3,
          monto_prestado: "3000",
          tasa_interes: "25",
          fecha_prestamo: format(addDays(hoy, -7), 'yyyy-MM-dd'),
          frecuencia_pago: "SEMANAL",
          numero_semanas: 8,
          pago_semanal: "406.25",
          monto_total_pagar: "3250",
          proxima_fecha_pago: format(hoy, 'yyyy-MM-dd')
        },
        {
          cliente_id: 4,
          monto_prestado: "20000",
          tasa_interes: "12",
          fecha_prestamo: format(addDays(hoy, -14), 'yyyy-MM-dd'),
          frecuencia_pago: "SEMANAL",
          numero_semanas: 24,
          pago_semanal: "916.67",
          monto_total_pagar: "22000",
          proxima_fecha_pago: format(proximaSemana, 'yyyy-MM-dd')
        },
        {
          cliente_id: 5,
          monto_prestado: "8000",
          tasa_interes: "18",
          fecha_prestamo: format(addDays(hoy, -10), 'yyyy-MM-dd'),
          frecuencia_pago: "SEMANAL",
          numero_semanas: 12,
          pago_semanal: "720",
          monto_total_pagar: "8640",
          proxima_fecha_pago: format(addDays(hoy, 4), 'yyyy-MM-dd')
        }
      ];
      
      for (const prestamo of prestamosEjemplo) {
        const nuevoPrestamo = await this.createPrestamo(prestamo);
        
        // Simular pagos realizados para algunos préstamos
        if (nuevoPrestamo.id === 2) {
          // Cliente 2 ya pagó dos semanas
          await this.createPago({
            prestamo_id: nuevoPrestamo.id,
            monto_pagado: nuevoPrestamo.pago_semanal,
            fecha_pago: new Date(addDays(hoy, -14)),
            numero_semana: 1,
            estado: "A_TIEMPO",
            es_pago_parcial: "false",
            monto_restante: "0"
          });
          
          await this.createPago({
            prestamo_id: nuevoPrestamo.id,
            monto_pagado: nuevoPrestamo.pago_semanal,
            fecha_pago: format(addDays(hoy, -7), 'yyyy-MM-dd'),
            numero_semana: 2,
            estado: "A_TIEMPO",
            es_pago_parcial: "false",
            monto_restante: "0"
          });
          
          // Actualizar el préstamo para reflejar los pagos
          await this.updatePrestamo(nuevoPrestamo.id, {
            semanas_pagadas: 2,
            proxima_fecha_pago: format(hoy, 'yyyy-MM-dd')
          });
        }
        
        if (nuevoPrestamo.id === 3) {
          // Cliente 3 hizo un pago parcial
          await this.createPago({
            prestamo_id: nuevoPrestamo.id,
            monto_pagado: "300",
            fecha_pago: format(addDays(hoy, -3), 'yyyy-MM-dd'),
            numero_semana: 1,
            estado: "A_TIEMPO", 
            es_pago_parcial: "true",
            monto_restante: (parseFloat(nuevoPrestamo.pago_semanal) - 300).toString()
          });
        }
        
        if (nuevoPrestamo.id === 4) {
          // Cliente 4 ya pagó dos semanas completas
          await this.createPago({
            prestamo_id: nuevoPrestamo.id,
            monto_pagado: nuevoPrestamo.pago_semanal,
            fecha_pago: format(addDays(hoy, -14), 'yyyy-MM-dd'),
            numero_semana: 1,
            estado: "A_TIEMPO",
            es_pago_parcial: "false",
            monto_restante: "0"
          });
          
          await this.createPago({
            prestamo_id: nuevoPrestamo.id,
            monto_pagado: nuevoPrestamo.pago_semanal,
            fecha_pago: format(addDays(hoy, -7), 'yyyy-MM-dd'),
            numero_semana: 2,
            estado: "A_TIEMPO",
            es_pago_parcial: "false",
            monto_restante: "0"
          });
          
          // Actualizar el préstamo para reflejar los pagos
          await this.updatePrestamo(nuevoPrestamo.id, {
            semanas_pagadas: 2,
            proxima_fecha_pago: format(proximaSemana, 'yyyy-MM-dd')
          });
        }
      }
    }
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
      monto_mora_acumulada: "0"
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
    if (semanasActualizadas >= prestamo.numero_semanas) {
      estadoPrestamo = "PAGADO";
    } else if (estado === "ATRASADO" && !esPagoParcial) {
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
      console.log("DEBUG - Préstamo asociado no encontrado:", pago.prestamo_id);
      return false;
    }
    
    console.log("DEBUG - Préstamo asociado encontrado:", prestamo);

    // Revertir los efectos del pago en el préstamo
    const prestamoActualizado: Partial<Prestamo> = {};

    // Si no fue un pago parcial, decrementar semanas pagadas
    if (pago.es_pago_parcial !== "true") {
      const semanasActualizadas = Math.max(0, prestamo.semanas_pagadas - 1);
      prestamoActualizado.semanas_pagadas = semanasActualizadas;
      
      console.log("DEBUG - Actualizando semanas pagadas de", prestamo.semanas_pagadas, "a", semanasActualizadas);
      
      // Si el préstamo estaba PAGADO, volver a ACTIVO
      if (prestamo.estado === "PAGADO") {
        prestamoActualizado.estado = "ACTIVO";
        console.log("DEBUG - Cambiando estado de préstamo de PAGADO a ACTIVO");
      }

      // Actualizar la fecha de próximo pago si corresponde
      if (prestamo.semanas_pagadas > 0) {
        const nuevaFechaPago = new Date(prestamo.proxima_fecha_pago);
        nuevaFechaPago.setDate(nuevaFechaPago.getDate() - 7);
        prestamoActualizado.proxima_fecha_pago = format(nuevaFechaPago, 'yyyy-MM-dd');
        console.log("DEBUG - Actualizando próxima fecha de pago a:", prestamoActualizado.proxima_fecha_pago);
      }
    }

    // Restar la mora acumulada que se haya agregado con este pago
    const montoMoraDelPago = parseFloat(pago.monto_mora || "0");
    if (montoMoraDelPago > 0) {
      const moraActual = parseFloat(prestamo.monto_mora_acumulada || "0");
      const nuevaMora = Math.max(0, moraActual - montoMoraDelPago);
      prestamoActualizado.monto_mora_acumulada = nuevaMora.toString();
      console.log("DEBUG - Actualizando mora acumulada de", moraActual, "a", nuevaMora);
    }

    // Actualizar el préstamo
    await this.updatePrestamo(pago.prestamo_id, prestamoActualizado);
    console.log("DEBUG - Préstamo actualizado después de revertir pago");

    // Eliminar el pago
    const resultado = this.pagos.delete(id);
    console.log("DEBUG - Resultado de eliminar pago:", resultado);
    return resultado;
  }

  // Método para eliminar un préstamo (solo si está pagado)
  async deletePrestamo(id: number): Promise<boolean> {
    console.log("DEBUG - Iniciando eliminación de préstamo:", id);
    
    const prestamo = await this.getPrestamo(id);
    if (!prestamo) {
      console.log("DEBUG - Préstamo no encontrado:", id);
      return false;
    }
    
    console.log("DEBUG - Préstamo encontrado:", prestamo);

    // Solo permitir eliminar préstamos pagados
    if (prestamo.estado !== "PAGADO") {
      console.log("DEBUG - No se puede eliminar préstamo no pagado. Estado actual:", prestamo.estado);
      throw new Error("Solo se pueden eliminar préstamos pagados");
    }

    // Eliminar el préstamo
    const resultado = this.prestamos.delete(id);
    console.log("DEBUG - Resultado de eliminar préstamo:", resultado);
    return resultado;
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
