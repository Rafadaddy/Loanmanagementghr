import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { formatISO } from "date-fns";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { 
  insertClienteSchema, 
  insertPrestamoSchema, 
  insertPagoSchema, 
  insertMovimientoCajaSchema,
  insertCobradorSchema,
  insertConfiguracionSchema,
  calculoPrestamoSchema,
  Prestamo
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Garantizar que el usuario administrador existe y tiene la contraseña correcta
  try {
    const adminUsername = "admin@sistema.com";
    const adminPassword = "admin123";
    
    // Verificar si existe el usuario administrador
    let adminUser = await storage.getUserByUsername(adminUsername);
    
    if (!adminUser) {
      // Crear el usuario administrador si no existe
      const adminHashPassword = await hashPassword(adminPassword);
      
      adminUser = await storage.createUser({
        username: adminUsername,
        password: adminHashPassword,
        nombre: "Administrador",
        email: adminUsername,
        rol: "ADMIN",
        activo: true
      });
      
      console.log("Usuario administrador creado con ID:", adminUser.id);
    } else {
      // Actualizar la contraseña para garantizar acceso
      const adminHashPassword = await hashPassword(adminPassword);
      await storage.updateUserPassword(adminUser.id, adminHashPassword);
      console.log("Contraseña de administrador actualizada para garantizar acceso");
    }
  } catch (error) {
    console.error("Error al verificar usuario administrador:", error);
  }

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    console.log("DEBUG - Verificando autenticación:", {
      path: req.path,
      method: req.method,
      isAuthenticated: req.isAuthenticated(),
      hasSession: !!req.session,
      hasUser: !!req.user,
      sessionID: req.sessionID,
      userId: req.user?.id,
      username: req.user?.username
    });
    
    if (req.isAuthenticated()) {
      console.log("DEBUG - Usuario autenticado correctamente:", req.user?.username);
      return next();
    }
    
    console.log("DEBUG - Usuario no autenticado, devolviendo 401");
    return res.status(401).json({ message: "No autorizado, por favor inicie sesión nuevamente" });
  };

  // Ruta para cálculo de préstamo
  app.post("/api/calcular-prestamo", isAuthenticated, async (req, res, next) => {
    try {
      const datos = calculoPrestamoSchema.parse(req.body);
      const resultado = storage.calcularPrestamo(datos);
      res.json(resultado);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos de cálculo inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  // Rutas para clientes
  app.get("/api/clientes", isAuthenticated, async (req, res, next) => {
    try {
      const clientes = await storage.getAllClientes();
      res.json(clientes);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/clientes/:id", isAuthenticated, async (req, res, next) => {
    try {
      const cliente = await storage.getCliente(parseInt(req.params.id));
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      res.json(cliente);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/clientes", isAuthenticated, async (req, res, next) => {
    try {
      const clienteData = insertClienteSchema.parse(req.body);
      
      // Si el cliente no tiene documento de identidad, asignar uno nuevo
      // usando incrementarDocumentoIdentidad que sí incrementa el contador
      if (!clienteData.documento_identidad || clienteData.documento_identidad.trim() === '') {
        try {
          clienteData.documento_identidad = await storage.incrementarDocumentoIdentidad();
          console.log("Asignado nuevo documento de identidad al cliente:", clienteData.documento_identidad);
        } catch (idError) {
          console.error("Error al asignar documento de identidad:", idError);
          // Continuar con la creación incluso si hay error en el ID
        }
      }
      
      const cliente = await storage.createCliente(clienteData);
      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del cliente inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  app.put("/api/clientes/:id", isAuthenticated, async (req, res, next) => {
    try {
      const clienteData = insertClienteSchema.parse(req.body);
      const cliente = await storage.updateCliente(parseInt(req.params.id), clienteData);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      res.json(cliente);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del cliente inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });
  
  app.delete("/api/clientes/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar si el cliente existe
      const cliente = await storage.getCliente(id);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      
      // Verificar si el cliente tiene préstamos asociados
      const prestamos = await storage.getPrestamosByClienteId(id);
      if (prestamos.length > 0) {
        return res.status(400).json({ 
          message: "No se puede eliminar el cliente porque tiene préstamos asociados" 
        });
      }
      
      // Eliminar el cliente
      const result = await storage.deleteCliente(id);
      if (result) {
        res.status(200).json({ message: "Cliente eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el cliente" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Ruta para obtener el conteo total de clientes
  app.get("/api/estadisticas/conteo-clientes", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar autenticación (ya se hace con el middleware isAuthenticated)
      
      // Obtener conteo de clientes usando SQL directo
      const totalClientes = await db.select({ count: sql`count(*)` }).from(sql`clientes`);
      
      // Registrar para depuración
      console.log('Conteo de clientes solicitado:', totalClientes[0].count);
      
      // Devolver el resultado
      res.json({
        total: Number(totalClientes[0].count),
        mensaje: `Total de clientes registrados: ${totalClientes[0].count}`
      });
    } catch (error) {
      console.error('Error al obtener conteo de clientes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Rutas para préstamos
  app.get("/api/prestamos", isAuthenticated, async (req, res, next) => {
    try {
      // Si se proporciona un cliente_id como query param, filtrar por cliente
      const clienteId = req.query.cliente_id ? parseInt(req.query.cliente_id as string) : undefined;
      
      if (clienteId) {
        const prestamos = await storage.getPrestamosByClienteId(clienteId);
        return res.json(prestamos);
      }
      
      const prestamos = await storage.getAllPrestamos();
      res.json(prestamos);
    } catch (error) {
      next(error);
    }
  });
  
  // Ruta para eliminar un préstamo (solo si está pagado)
  app.delete("/api/prestamos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de préstamo inválido" });
      }
      
      // Verificar si el préstamo existe
      const prestamo = await storage.getPrestamo(id);
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      
      // Verificar si el préstamo está pagado
      if (prestamo.estado !== "PAGADO") {
        return res.status(400).json({ 
          message: "Solo se pueden eliminar préstamos pagados" 
        });
      }
      
      // Eliminar préstamo
      const resultado = await storage.deletePrestamo(id);
      if (resultado) {
        res.status(200).json({ message: "Préstamo eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el préstamo" });
      }
    } catch (error) {
      console.error("Error al eliminar préstamo:", error);
      next(error);
    }
  });

  app.get("/api/prestamos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const prestamo = await storage.getPrestamo(parseInt(req.params.id));
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      res.json(prestamo);
    } catch (error) {
      next(error);
    }
  });
  
  // Endpoint para guardar la fecha inicial personalizada de un préstamo
  app.post("/api/prestamos/:id/set-fecha-inicial", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { fecha_inicial_personalizada, cronograma_eliminado } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de préstamo inválido" });
      }
      
      // Permitimos explícitamente que fecha_inicial_personalizada sea null para eliminar la fecha personalizada
      
      // Verificar que el préstamo existe
      const prestamo = await storage.getPrestamo(id);
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      
      // Preparar el objeto para la actualización
      const datosActualizacion: Partial<Prestamo> = {
        fecha_inicial_personalizada
      };
      
      // Si tenemos un valor para cronograma_eliminado, lo incluimos en la actualización
      if (cronograma_eliminado !== undefined) {
        datosActualizacion.cronograma_eliminado = cronograma_eliminado;
      }
      
      // Actualizar el préstamo con todos los cambios
      const prestamoActualizado = await storage.updatePrestamo(id, datosActualizacion);
      
      if (fecha_inicial_personalizada === null) {
        return res.status(200).json({
          success: true,
          message: "Fecha inicial personalizada eliminada correctamente",
          cronograma_eliminado: cronograma_eliminado
        });
      }
      
      res.status(200).json({ 
        success: true,
        message: "Fecha inicial personalizada guardada correctamente", 
        fecha: fecha_inicial_personalizada,
        cronograma_eliminado: cronograma_eliminado
      });
    } catch (error) {
      console.error("Error al establecer fecha inicial personalizada:", error);
      next(error);
    }
  });
  
  // Ruta para obtener los pagos de un préstamo
  app.get("/api/prestamos/:id/pagos", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el préstamo existe
      const prestamo = await storage.getPrestamo(id);
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      
      // Obtener pagos del préstamo
      const pagos = await storage.getPagosByPrestamoId(id);
      res.json(pagos);
    } catch (error) {
      console.error("Error al obtener pagos por préstamo:", error);
      next(error);
    }
  });

  app.post("/api/prestamos", isAuthenticated, async (req, res, next) => {
    try {
      console.log("Datos recibidos:", req.body);
      
      // Validar que el cliente existe antes de validar todo el esquema
      const clienteId = parseInt(req.body.cliente_id);
      if (isNaN(clienteId)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }
      
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      
      // Validar y parsear los datos
      // Usamos las fechas tal como vienen del cliente, sin crear nuevos objetos Date
      // que podrían causar problemas de zona horaria
      const fechaPrestamoISO = req.body.fecha_prestamo;
      const proximaFechaPagoISO = req.body.proxima_fecha_pago;
      
      const prestamoData = insertPrestamoSchema.parse({
        ...req.body,
        cliente_id: clienteId,
        monto_prestado: req.body.monto_prestado,
        tasa_interes: req.body.tasa_interes,
        fecha_prestamo: fechaPrestamoISO,
        numero_semanas: parseInt(req.body.numero_semanas),
        frecuencia_pago: req.body.frecuencia_pago,
        monto_total_pagar: req.body.monto_total_pagar,
        pago_semanal: req.body.pago_semanal,
        proxima_fecha_pago: proximaFechaPagoISO,
      });
      
      // Crear préstamo
      const prestamo = await storage.createPrestamo(prestamoData);
      res.status(201).json(prestamo);
    } catch (error) {
      console.error("Error al crear préstamo:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del préstamo inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  // Ruta para actualizar préstamo
  app.put("/api/prestamos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de préstamo inválido" });
      }

      console.log("Datos recibidos para actualización:", req.body);

      // Verificar que el préstamo existe
      const prestamoExistente = await storage.getPrestamo(id);
      if (!prestamoExistente) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }

      // Validar que el cliente existe si se está cambiando
      const clienteId = req.body.cliente_id ? parseInt(req.body.cliente_id) : prestamoExistente.cliente_id;
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      // Preparar datos de actualización
      const datosActualizacion: any = {};
      
      // Campos que se pueden actualizar
      if (req.body.cliente_id !== undefined) {
        datosActualizacion.cliente_id = clienteId;
      }
      if (req.body.monto_prestado !== undefined) {
        datosActualizacion.monto_prestado = req.body.monto_prestado;
      }
      if (req.body.tasa_interes !== undefined) {
        datosActualizacion.tasa_interes = req.body.tasa_interes;
      }
      if (req.body.tasa_mora !== undefined) {
        datosActualizacion.tasa_mora = req.body.tasa_mora;
      }
      if (req.body.fecha_prestamo !== undefined) {
        datosActualizacion.fecha_prestamo = req.body.fecha_prestamo;
      }
      if (req.body.numero_semanas !== undefined) {
        datosActualizacion.numero_semanas = parseInt(req.body.numero_semanas);
      }
      if (req.body.frecuencia_pago !== undefined) {
        datosActualizacion.frecuencia_pago = req.body.frecuencia_pago;
      }
      if (req.body.monto_total_pagar !== undefined) {
        datosActualizacion.monto_total_pagar = req.body.monto_total_pagar;
      }
      if (req.body.pago_semanal !== undefined) {
        datosActualizacion.pago_semanal = req.body.pago_semanal;
      }
      if (req.body.proxima_fecha_pago !== undefined) {
        datosActualizacion.proxima_fecha_pago = req.body.proxima_fecha_pago;
      }

      console.log("Datos a actualizar:", datosActualizacion);

      // Actualizar préstamo
      const prestamoActualizado = await storage.updatePrestamo(id, datosActualizacion);
      
      if (!prestamoActualizado) {
        return res.status(500).json({ message: "Error al actualizar el préstamo" });
      }

      console.log("Préstamo actualizado exitosamente:", prestamoActualizado.id);
      res.json(prestamoActualizado);
    } catch (error) {
      console.error("Error al actualizar préstamo:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del préstamo inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  // Rutas para pagos
  app.get("/api/pagos", isAuthenticated, async (req, res, next) => {
    try {
      // Si se proporciona un prestamo_id como query param, filtrar por préstamo
      const prestamoId = req.query.prestamo_id ? parseInt(req.query.prestamo_id as string) : undefined;
      
      if (prestamoId) {
        const pagos = await storage.getPagosByPrestamoId(prestamoId);
        return res.json(pagos);
      }
      
      const pagos = await storage.getAllPagos();
      res.json(pagos);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/pagos", isAuthenticated, async (req, res, next) => {
    try {
      console.log("Datos de pago recibidos:", req.body);
      
      // Validar con el esquema
      try {
        const pagoData = insertPagoSchema.parse(req.body);
        
        // Validar que el préstamo existe
        const prestamo = await storage.getPrestamo(pagoData.prestamo_id);
        if (!prestamo) {
          return res.status(404).json({ message: "Préstamo no encontrado" });
        }
        
        // Validar que el préstamo no está pagado
        if (prestamo.estado === "PAGADO") {
          return res.status(400).json({ message: "El préstamo ya está pagado completamente" });
        }
        
        // Crear pago
        const pago = await storage.createPago(pagoData);
        
        // Registrar automáticamente el pago en la caja
        try {
          console.log("DEBUG - Registrando pago en caja automáticamente");
          // Obtener información del préstamo y cliente para el registro
          const prestamo = await storage.getPrestamo(pagoData.prestamo_id);
          const cliente = prestamo ? await storage.getCliente(prestamo.cliente_id) : null;
          
          // Crear el movimiento de caja correspondiente al pago
          const movimientoCaja = {
            tipo: "INGRESO" as const,
            categoria: "Pago de Préstamo",
            monto: pagoData.monto_pagado,
            prestamo_id: pagoData.prestamo_id,
            cliente_id: prestamo?.cliente_id || null,
            descripcion: `Pago ${pagoData.es_pago_parcial ? 'parcial' : 'completo'} de préstamo. Cliente: ${cliente?.nombre || 'Desconocido'}. Semana ${pagoData.numero_semana}`,
            fecha: pagoData.fecha_pago || new Date().toISOString().split('T')[0], // Usar la fecha del pago o fecha actual
            creado_por: req.user!.id
          };
          
          console.log("DEBUG - Datos de movimiento de caja:", JSON.stringify(movimientoCaja, null, 2));
          const movimiento = await storage.createMovimientoCaja(movimientoCaja);
          console.log("DEBUG - Movimiento de caja registrado automáticamente con ID:", movimiento.id);
        } catch (error) {
          console.error("ERROR al registrar pago en caja:", error);
          // Continuar aunque falle el registro en caja, ya que el pago ya fue creado
        }
        
        res.status(201).json(pago);
      } catch (zodError) {
        if (zodError instanceof ZodError) {
          console.error("Error de validación:", zodError.errors);
          return res.status(400).json({ 
            message: "Datos del pago inválidos", 
            errors: fromZodError(zodError).message,
            details: zodError.errors 
          });
        }
        throw zodError;
      }
    } catch (error) {
      console.error("Error al crear pago:", error);
      next(error);
    }
  });
  
  // Ruta para actualizar un pago (editar un pago erróneo)
  app.put("/api/pagos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de pago inválido" });
      }
      
      // Verificar si existe el pago
      const pagos = await storage.getAllPagos();
      const pago = pagos.find(p => p.id === id);
      
      if (!pago) {
        return res.status(404).json({ message: "Pago no encontrado" });
      }
      
      // Validar datos de actualización
      try {
        // Permitimos actualizar el monto pagado, la fecha y el número de semana
        const { monto_pagado, fecha_pago, numero_semana } = req.body;
        
        if (!monto_pagado || isNaN(Number(monto_pagado)) || Number(monto_pagado) <= 0) {
          return res.status(400).json({ message: "El monto pagado debe ser un número positivo" });
        }
        
        // Preparar datos de actualización
        const datosActualizacion: any = { monto_pagado };
        
        // Si se proporciona una nueva fecha, incluirla
        if (fecha_pago) {
          datosActualizacion.fecha_pago = new Date(fecha_pago);
        }
        
        // Si se proporciona un nuevo número de semana, incluirlo
        if (numero_semana && !isNaN(Number(numero_semana))) {
          datosActualizacion.numero_semana = Number(numero_semana);
        }
        
        console.log("DEBUG - Datos a actualizar en el pago:", JSON.stringify(datosActualizacion, null, 2));
        
        // Actualizar el pago
        const pagoActualizado = await storage.updatePago(id, datosActualizacion);
        
        console.log("DEBUG - Pago actualizado resultado:", JSON.stringify(pagoActualizado, null, 2));
        
        if (pagoActualizado) {
          res.status(200).json(pagoActualizado);
        } else {
          res.status(500).json({ message: "Error al actualizar el pago" });
        }
      } catch (error) {
        console.error("Error de validación en actualización de pago:", error);
        return res.status(400).json({ message: "Datos inválidos para actualizar el pago" });
      }
    } catch (error) {
      console.error("Error al actualizar pago:", error);
      next(error);
    }
  });
  
  // Ruta para eliminar un pago (revertir un pago erróneo)
  

  app.delete("/api/pagos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de pago inválido" });
      }
      
      // Verificar si existe el pago
      const pagos = await storage.getAllPagos();
      const pago = pagos.find(p => p.id === id);
      
      if (!pago) {
        return res.status(404).json({ message: "Pago no encontrado" });
      }
      
      // Eliminar pago
      const resultado = await storage.deletePago(id);
      if (resultado) {
        res.status(200).json({ message: "Pago eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el pago" });
      }
    } catch (error) {
      console.error("Error al eliminar pago:", error);
      next(error);
    }
  });

  // Rutas para obtener el total pagado
  app.get("/api/prestamos/:id/total-pagado", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const prestamo = await storage.getPrestamo(id);
      
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      
      const totalPagado = await storage.getTotalPagadoByPrestamoId(id);
      res.json({ totalPagado });
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/clientes/:id/total-pagado", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.getCliente(id);
      
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      
      const totalPagado = await storage.getTotalPagadoByClienteId(id);
      res.json({ totalPagado });
    } catch (error) {
      next(error);
    }
  });
  
  // Ruta para obtener los préstamos de un cliente
  app.get("/api/clientes/:id/prestamos", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el cliente existe
      const cliente = await storage.getCliente(id);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      
      // Obtener préstamos del cliente
      const prestamos = await storage.getPrestamosByClienteId(id);
      res.json(prestamos);
    } catch (error) {
      console.error("Error al obtener préstamos por cliente:", error);
      next(error);
    }
  });

  // Estadísticas para dashboard
  app.get("/api/estadisticas", isAuthenticated, async (req, res, next) => {
    try {
      const prestamos = await storage.getAllPrestamos();
      const pagos = await storage.getAllPagos();
      const clientes = await storage.getAllClientes();
      
      // Préstamos activos
      const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO").length;
      
      // Total prestado
      const totalPrestado = prestamos.reduce((sum, p) => sum + Number(p.monto_prestado), 0);
      
      // Cálculo de intereses totales
      const totalIntereses = prestamos.reduce((sum, p) => {
        // Interés es la diferencia entre monto total a pagar y monto prestado
        const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
        return sum + interes;
      }, 0);
      
      // Intereses por cobrar (solo de préstamos activos)
      const interesesPorCobrar = prestamos
        .filter(p => p.estado === "ACTIVO" || p.estado === "ATRASADO")
        .reduce((sum, p) => {
          const interes = Number(p.monto_total_pagar) - Number(p.monto_prestado);
          return sum + interes;
        }, 0);
      
      // Pagos del día
      const hoy = new Date();
      const inicio = new Date(hoy.setHours(0, 0, 0, 0));
      const fin = new Date(hoy.setHours(23, 59, 59, 999));
      
      const pagosHoy = pagos.filter(p => {
        const fecha = new Date(p.fecha_pago);
        return fecha >= inicio && fecha <= fin;
      });
      
      const montosPagosHoy = pagosHoy.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
      
      // Pagos atrasados
      const prestamosAtrasados = prestamos.filter(p => p.estado === "ATRASADO").length;
      
      // Total de moras acumuladas
      const totalMoras = prestamos.reduce((sum, p) => sum + Number(p.monto_mora_acumulada || 0), 0);
      
      // Actividad reciente (últimos 5 de cada categoría)
      const ultimosPrestamos = [...prestamos]
        .sort((a, b) => new Date(b.fecha_prestamo).getTime() - new Date(a.fecha_prestamo).getTime())
        .slice(0, 5);
      
      const ultimosPagos = [...pagos]
        .sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime())
        .slice(0, 5);
      
      const ultimosClientes = [...clientes]
        .sort((a, b) => new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime())
        .slice(0, 5);
      
      res.json({
        totalPrestamos,
        prestamosActivos,
        prestamosAtrasados,
        prestamosPagados,
        totalPrestado,
        totalIntereses,
        interesesPorCobrar,
        montosPagosHoy,
        totalMoras,
        ultimosPrestamos,
        ultimosPagos,
        ultimosClientes,
      });
    } catch (error) {
      next(error);
    }
  });

  // Rutas para movimientos de caja
  app.get("/api/caja/movimientos", async (req, res, next) => {
    try {
      // Si se proporcionan fechas, filtrar por rango de fechas
      const { fechaInicio, fechaFin } = req.query;
      
      if (fechaInicio && fechaFin) {
        const movimientos = await storage.getMovimientosCajaPorFecha(
          fechaInicio as string, 
          fechaFin as string
        );
        return res.json(movimientos);
      }
      
      const movimientos = await storage.getAllMovimientosCaja();
      res.json(movimientos);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/caja/resumen", async (req, res, next) => {
    try {
      const resumen = await storage.getResumenCaja();
      res.json(resumen);
    } catch (error) {
      next(error);
    }
  });

  // Ruta para crear movimientos de caja
  app.post("/api/caja/movimientos", isAuthenticated, async (req, res, next) => {
    try {
      console.log("DEBUG - Recibiendo petición POST /api/caja/movimientos");
      console.log("DEBUG - Datos recibidos:", req.body);
      
      // Obtener el ID del usuario autenticado
      const userId = req.user?.id;
      
      console.log("DEBUG - Usuario ID determinado:", userId);
      
      // Asegurar que los campos tengan el tipo correcto
      const datosProcesados = {
        ...req.body,
        creado_por: userId,
        // La fecha se mantiene como string ISO para que pueda ser validada por Zod
        fecha: req.body.fecha || new Date().toISOString(),
        // Tipo siempre en mayúsculas
        tipo: req.body.tipo ? req.body.tipo.toUpperCase() : req.body.tipo,
        // Convertir cliente_id y prestamo_id a null si son 0, undefined o string vacío
        cliente_id: req.body.cliente_id === 0 || req.body.cliente_id === "0" || !req.body.cliente_id 
          ? null 
          : typeof req.body.cliente_id === 'string' 
            ? parseInt(req.body.cliente_id) 
            : req.body.cliente_id,
        prestamo_id: req.body.prestamo_id === 0 || req.body.prestamo_id === "0" || !req.body.prestamo_id 
          ? null 
          : typeof req.body.prestamo_id === 'string' 
            ? parseInt(req.body.prestamo_id) 
            : req.body.prestamo_id,
        // Verificar que el monto sea una cadena
        monto: req.body.monto ? req.body.monto.toString() : req.body.monto,
      };
      
      console.log("DEBUG - Datos procesados antes de validación:", datosProcesados);
      
      // Validar que el tipo sea INGRESO o EGRESO
      if (!["INGRESO", "EGRESO"].includes(datosProcesados.tipo)) {
        console.log("DEBUG - Tipo inválido:", datosProcesados.tipo);
        return res.status(400).json({ message: "El tipo debe ser INGRESO o EGRESO" });
      }
      
      // Validar montos positivos
      const montoNumerico = parseFloat(datosProcesados.monto);
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        console.log("DEBUG - Monto inválido:", datosProcesados.monto);
        return res.status(400).json({ message: "El monto debe ser un valor positivo" });
      }
      
      try {
        // Intentar validar con el esquema
        console.log("DEBUG - Intentando validar datos con Zod");
        const movimientoData = insertMovimientoCajaSchema.parse(datosProcesados);
        console.log("DEBUG - Datos validados con Zod:", movimientoData);
        
        // Si es un movimiento relacionado con un préstamo, validar que exista
        if (movimientoData.prestamo_id) {
          console.log("DEBUG - Validando préstamo:", movimientoData.prestamo_id);
          const prestamo = await storage.getPrestamo(movimientoData.prestamo_id);
          if (!prestamo) {
            console.log("DEBUG - Préstamo no encontrado:", movimientoData.prestamo_id);
            return res.status(404).json({ message: "Préstamo no encontrado" });
          }
          console.log("DEBUG - Préstamo encontrado:", prestamo.id);
        }
        
        // Si es un movimiento relacionado con un cliente, validar que exista
        if (movimientoData.cliente_id) {
          console.log("DEBUG - Validando cliente:", movimientoData.cliente_id);
          const cliente = await storage.getCliente(movimientoData.cliente_id);
          if (!cliente) {
            console.log("DEBUG - Cliente no encontrado:", movimientoData.cliente_id);
            return res.status(404).json({ message: "Cliente no encontrado" });
          }
          console.log("DEBUG - Cliente encontrado:", cliente.id);
        }
        
        // Crear movimiento
        console.log("DEBUG - Creando movimiento de caja:", movimientoData);
        const movimiento = await storage.createMovimientoCaja(movimientoData);
        console.log("DEBUG - Movimiento creado:", movimiento);
        return res.status(201).json(movimiento);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("DEBUG - Error de validación Zod:", validationError.format());
          return res.status(400).json({ 
            message: "Datos del movimiento inválidos", 
            errors: fromZodError(validationError).message 
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error al crear movimiento de caja:", error);
      next(error);
    }
  });

  app.delete("/api/caja/movimientos/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de movimiento inválido" });
      }
      
      // Verificar si existe el movimiento
      const movimiento = await storage.getMovimientoCaja(id);
      if (!movimiento) {
        return res.status(404).json({ message: "Movimiento no encontrado" });
      }
      
      // Eliminar movimiento
      const resultado = await storage.deleteMovimientoCaja(id);
      if (resultado) {
        res.status(200).json({ message: "Movimiento eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el movimiento" });
      }
    } catch (error) {
      console.error("Error al eliminar movimiento de caja:", error);
      next(error);
    }
  });

  // Rutas para cobradores
  app.get("/api/cobradores", isAuthenticated, async (req, res, next) => {
    try {
      const cobradores = await storage.getAllCobradores();
      res.json(cobradores);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cobradores/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cobrador inválido" });
      }
      
      const cobrador = await storage.getCobrador(id);
      if (!cobrador) {
        return res.status(404).json({ message: "Cobrador no encontrado" });
      }
      
      res.json(cobrador);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cobradores/:id/clientes", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cobrador inválido" });
      }
      
      const cobrador = await storage.getCobrador(id);
      if (!cobrador) {
        return res.status(404).json({ message: "Cobrador no encontrado" });
      }
      
      const clientes = await storage.getClientesByCobrador(id);
      res.json(clientes);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/cobradores", isAuthenticated, async (req, res, next) => {
    try {
      // Validar que el usuario existe
      const userId = req.body.user_id ? parseInt(req.body.user_id) : null;
      if (!userId) {
        return res.status(400).json({ message: "Se requiere ID de usuario" });
      }
      
      const usuario = await storage.getUser(userId);
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Validar datos del cobrador
      const cobradorData = insertCobradorSchema.parse(req.body);
      
      // Verificar si ya existe un cobrador con ese user_id
      // Solo hacemos esta verificación para usuarios comunes, no para administradores
      if (usuario.rol !== "ADMIN") {
        const cobradorExistente = await storage.getCobradorByUserId(userId);
        if (cobradorExistente) {
          return res.status(400).json({ 
            message: "Ya existe un cobrador asignado a este usuario" 
          });
        }
      }
      
      // Crear cobrador
      const cobrador = await storage.createCobrador(cobradorData);
      
      res.status(201).json(cobrador);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del cobrador inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  app.put("/api/cobradores/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cobrador inválido" });
      }
      
      // Verificar si el cobrador existe
      const cobrador = await storage.getCobrador(id);
      if (!cobrador) {
        return res.status(404).json({ message: "Cobrador no encontrado" });
      }
      
      // Actualizar cobrador
      const cobradorActualizado = await storage.updateCobrador(id, req.body);
      res.json(cobradorActualizado);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del cobrador inválidos", 
          errors: fromZodError(error).message 
        });
      }
      next(error);
    }
  });

  app.delete("/api/cobradores/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cobrador inválido" });
      }
      
      // Verificar si el cobrador existe
      const cobrador = await storage.getCobrador(id);
      if (!cobrador) {
        return res.status(404).json({ message: "Cobrador no encontrado" });
      }
      
      // Verificar si tiene clientes asignados
      const clientes = await storage.getClientesByCobrador(id);
      if (clientes.length > 0) {
        return res.status(400).json({ 
          message: "No se puede eliminar el cobrador porque tiene clientes asignados",
          clientes_count: clientes.length
        });
      }
      
      // Eliminar cobrador
      const result = await storage.deleteCobrador(id);
      if (result) {
        // Cambiar rol de usuario a USUARIO si era COBRADOR
        const usuario = await storage.getUser(cobrador.user_id);
        if (usuario && usuario.rol === "COBRADOR") {
          await storage.updateUser(cobrador.user_id, { rol: "USUARIO" });
        }
        
        res.status(200).json({ message: "Cobrador eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el cobrador" });
      }
    } catch (error) {
      next(error);
    }
  });

  // Ruta para obtener todos los usuarios que pueden ser cobradores (que no ya tengan un cobrador asignado)
  app.get("/api/usuarios-disponibles-para-cobrador", isAuthenticated, async (req, res, next) => {
    try {
      // Obtener todos los usuarios
      const usuarios = Array.from((await storage.getAllUsers()).values());
      
      // Obtener todos los cobradores
      const cobradores = await storage.getAllCobradores();
      
      // Filtrar los usuarios que ya son cobradores
      const userIdsConCobradores = cobradores.map(c => c.user_id);
      
      // Incluir todos los usuarios que no tienen un cobrador asignado
      // Nota: ahora permitimos al administrador ser asignado múltiples veces
      const usuariosDisponibles = usuarios.filter(usuario => 
        !userIdsConCobradores.includes(usuario.id) || usuario.rol === "ADMIN"
      );
      
      res.json(usuariosDisponibles);
    } catch (error) {
      next(error);
    }
  });

  // Ruta para cambiar el día de pago de un préstamo
  app.post("/api/prestamos/:id/cambiar-dia-pago", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de préstamo inválido" });
      }
      
      const { nuevaFechaPago, cambiarTodasFechas = true } = req.body;
      if (!nuevaFechaPago) {
        return res.status(400).json({ message: "La nueva fecha de pago es requerida" });
      }
      
      // Verificar si el préstamo existe
      const prestamo = await storage.getPrestamo(id);
      if (!prestamo) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }
      
      // Parsear la fecha de pago actual y la nueva
      const fechaProximoPagoActual = new Date(prestamo.proxima_fecha_pago);
      const nuevaFecha = new Date(nuevaFechaPago);
      
      // No añadimos un día extra para evitar inconsistencias entre las diferentes partes del sistema
      // La fecha debe ser exactamente la que selecciona el usuario
      
      // Verificar que la nueva fecha sea válida
      if (isNaN(nuevaFecha.getTime())) {
        return res.status(400).json({ message: "Formato de fecha inválido. Utilice YYYY-MM-DD" });
      }
      
      // Obtener el día de la semana de la nueva fecha (0: domingo, 1: lunes, ..., 6: sábado)
      const nuevoDiaSemana = nuevaFecha.getDay();
      const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      
      // Si cambiarTodasFechas es verdadero, necesitamos calcular una fecha inicial para la primera cuota
      let fechaInicialPrimeraCuota = prestamo.fecha_inicial_personalizada || null;
      if (cambiarTodasFechas) {
        // Calculamos la fecha de la primera cuota basándonos en la nueva fecha
        const semanasYaPagadas = prestamo.semanas_pagadas || 0;
        
        if (semanasYaPagadas === 0) {
          // Si no hay semanas pagadas, la primera fecha debe ser exactamente 7 días después de la fecha del préstamo 
          // Para evitar problemas, usamos directamente la fecha del préstamo y sumamos 7 días
          // Y NO ajustamos al día de la semana seleccionado para la primera cuota
          const fechaPrestamoISO = prestamo.fecha_prestamo;
          const fechaPartes = fechaPrestamoISO.split('-');
          const anio = parseInt(fechaPartes[0]);
          const mes = parseInt(fechaPartes[1]) - 1; // Meses van de 0-11
          const dia = parseInt(fechaPartes[2]) + 7; // Sumamos exactamente 7 días
          
          // Creamos la fecha exacta sumando 7 días a la fecha del préstamo
          const fechaExacta = new Date(Date.UTC(anio, mes, dia, 12, 0, 0));
          fechaInicialPrimeraCuota = fechaExacta.toISOString().split('T')[0];
        } else {
          // Si hay semanas pagadas, retrocedemos exactamente desde la nueva fecha
          // para obtener la primera fecha sin ajustes adicionales
          const nuevaFechaObj = new Date(nuevaFechaPago);
          // Creamos una nueva fecha para evitar modificar la original
          const primeraCuotaObj = new Date(nuevaFechaObj);
          // Retrocedemos exactamente el número de semanas pagadas * 7 días
          primeraCuotaObj.setDate(primeraCuotaObj.getDate() - (semanasYaPagadas * 7));
          
          // Formateamos como YYYY-MM-DD
          fechaInicialPrimeraCuota = primeraCuotaObj.toISOString().split('T')[0];
        }
      }
      
      // Actualizar el préstamo
      const prestamoActualizado = {
        ...prestamo,
        proxima_fecha_pago: nuevaFechaPago, // Usamos la nueva fecha de pago
        // Guardamos la fecha inicial personalizada si se ha solicitado cambiar todas las fechas
        fecha_inicial_personalizada: cambiarTodasFechas ? fechaInicialPrimeraCuota : prestamo.fecha_inicial_personalizada,
        // Guardamos el día de la semana seleccionado (0-6, donde 0 es domingo)
        dia_pago: nuevoDiaSemana,
        // IMPORTANTE: Preservamos el estado de eliminación del cronograma
        cronograma_eliminado: prestamo.cronograma_eliminado 
      };
      
      const resultado = await storage.updatePrestamo(id, prestamoActualizado);
      
      if (!resultado) {
        return res.status(500).json({ message: "Error al actualizar el día de pago" });
      }
      
      res.json({
        message: "Día de pago actualizado correctamente",
        prestamo: resultado,
        nuevoDiaSemana: diasSemana[nuevoDiaSemana],
        fechaInicialPrimeraCuota
      });
    } catch (error) {
      console.error("Error al cambiar día de pago:", error);
      next(error);
    }
  });

  // Endpoint para exportar datos (backup)
  app.get("/api/sistema/exportar", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permiso para exportar datos" });
      }

      const datos = await storage.exportarDatos();
      
      // Función para validar y limpiar fechas en el proceso de exportación
      const limpiarFechasParaExportacion = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        
        if (Array.isArray(obj)) {
          return obj.map(limpiarFechasParaExportacion);
        }
        
        if (typeof obj === 'object' && obj instanceof Date) {
          // Validar que la fecha sea válida
          if (isNaN(obj.getTime()) || obj.getFullYear() > 3000 || obj.getFullYear() < 1900) {
            console.warn('Fecha inválida detectada durante exportación:', obj);
            return new Date().toISOString();
          }
          return obj.toISOString();
        }
        
        if (typeof obj === 'object') {
          const resultado: any = {};
          for (const [key, value] of Object.entries(obj)) {
            // Campos de fecha conocidos - validar especialmente
            if (['fecha_registro', 'fecha_prestamo', 'proxima_fecha_pago', 'fecha_inicial_personalizada', 'fecha_pago', 'fecha'].includes(key)) {
              if (typeof value === 'string') {
                // Detectar patrones corruptos de fecha
                if (value.includes('20224') || value.includes('+020224') || value.length > 30) {
                  console.warn(`Fecha corrupta detectada en campo ${key}:`, value);
                  resultado[key] = key.startsWith('fecha_registro') || key === 'fecha' 
                    ? new Date().toISOString() 
                    : new Date().toISOString().split('T')[0];
                } else {
                  resultado[key] = value;
                }
              } else if (value instanceof Date) {
                if (isNaN(value.getTime()) || value.getFullYear() > 3000 || value.getFullYear() < 1900) {
                  console.warn(`Fecha inválida en campo ${key}:`, value);
                  resultado[key] = key.startsWith('fecha_registro') || key === 'fecha' 
                    ? new Date().toISOString() 
                    : new Date().toISOString().split('T')[0];
                } else {
                  resultado[key] = key.startsWith('fecha_registro') || key === 'fecha' 
                    ? value.toISOString() 
                    : value.toISOString().split('T')[0];
                }
              } else {
                resultado[key] = limpiarFechasParaExportacion(value);
              }
            } else {
              resultado[key] = limpiarFechasParaExportacion(value);
            }
          }
          return resultado;
        }
        
        return obj;
      };
      
      // Limpiar todos los datos antes de exportar
      const datosLimpios = limpiarFechasParaExportacion(datos);
      
      console.log('Datos de exportación validados:', {
        users: datosLimpios.users?.length || 0,
        clientes: datosLimpios.clientes?.length || 0,
        prestamos: datosLimpios.prestamos?.length || 0,
        pagos: datosLimpios.pagos?.length || 0,
        cobradores: datosLimpios.cobradores?.length || 0,
        movimientosCaja: datosLimpios.movimientosCaja?.length || 0,
        configuraciones: datosLimpios.configuraciones?.length || 0
      });
      
      // Crear un nombre de archivo para la descarga
      const fechaActual = new Date().toISOString().split('T')[0];
      const nombreArchivo = `backup_sistema_${fechaActual}.json`;
      
      // Configurar cabeceras para descarga
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.setHeader('Content-Type', 'application/json');
      
      // Enviar los datos limpios
      res.json(datosLimpios);
    } catch (error) {
      console.error("Error al exportar datos:", error);
      next(error);
    }
  });

  // Endpoint para importar datos (restaurar)
  app.post("/api/sistema/importar", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permiso para importar datos" });
      }

      // Validar que el cuerpo de la solicitud contiene todos los datos necesarios
      const requiredCollections = ['users', 'clientes', 'prestamos', 'pagos', 'cobradores', 'movimientosCaja'];
      const missingCollections = requiredCollections.filter(collection => !req.body[collection]);
      
      if (missingCollections.length > 0) {
        return res.status(400).json({ 
          message: "Archivo de respaldo incompleto", 
          missing: missingCollections 
        });
      }

      // Verificar que los datos están presentes y tienen el formato correcto
      console.log("Verificando datos antes de importar:");
      console.log(`- Users: ${req.body.users?.length || 0}`);
      console.log(`- Clientes: ${req.body.clientes?.length || 0}`);
      console.log(`- Préstamos: ${req.body.prestamos?.length || 0}`);
      console.log(`- Pagos: ${req.body.pagos?.length || 0}`);
      console.log(`- Cobradores: ${req.body.cobradores?.length || 0}`);
      console.log(`- Movimientos: ${req.body.movimientosCaja?.length || 0}`);
      console.log(`- Configuraciones: ${req.body.configuraciones?.length || 0}`);
      
      // Verificar estructura de algunos elementos para debug
      if (req.body.clientes?.length > 0) {
        console.log("Ejemplo de cliente:", JSON.stringify(req.body.clientes[0], null, 2));
      }
      if (req.body.prestamos?.length > 0) {
        console.log("Ejemplo de préstamo:", JSON.stringify(req.body.prestamos[0], null, 2));
      }
      
      console.log("Iniciando importación de datos...");
      
      // Pre-validar y limpiar fechas antes de enviar a la función de importación
      const validarYLimpiarFechas = (datos: any) => {
        let fechasCorruptasEncontradas = 0;
        
        const procesarObjeto = (obj: any): any => {
          if (obj === null || obj === undefined) return obj;
          
          if (Array.isArray(obj)) {
            return obj.map(procesarObjeto);
          }
          
          if (typeof obj === 'object') {
            const resultado: any = {};
            for (const [key, value] of Object.entries(obj)) {
              // Campos de fecha que necesitan validación especial
              if (['fecha_registro', 'fecha_prestamo', 'proxima_fecha_pago', 'fecha_inicial_personalizada', 'fecha_pago', 'fecha'].includes(key)) {
                if (typeof value === 'string') {
                  // Detectar y corregir fechas corruptas
                  if (value.includes('20224') || value.includes('+020224') || value.length > 30) {
                    fechasCorruptasEncontradas++;
                    console.warn(`Fecha corrupta detectada y corregida en ${key}:`, value);
                    // Corregir fecha según el tipo de campo
                    if (key.startsWith('fecha_registro') || key === 'fecha') {
                      resultado[key] = new Date().toISOString();
                    } else {
                      resultado[key] = new Date().toISOString().split('T')[0];
                    }
                  } else {
                    // Validar formato de fecha válido
                    const fecha = new Date(value);
                    if (isNaN(fecha.getTime()) || fecha.getFullYear() > 3000 || fecha.getFullYear() < 1900) {
                      fechasCorruptasEncontradas++;
                      console.warn(`Fecha inválida detectada y corregida en ${key}:`, value);
                      if (key.startsWith('fecha_registro') || key === 'fecha') {
                        resultado[key] = new Date().toISOString();
                      } else {
                        resultado[key] = new Date().toISOString().split('T')[0];
                      }
                    } else {
                      resultado[key] = value;
                    }
                  }
                } else {
                  resultado[key] = procesarObjeto(value);
                }
              } else {
                resultado[key] = procesarObjeto(value);
              }
            }
            return resultado;
          }
          
          return obj;
        };
        
        const datosLimpios = procesarObjeto(datos);
        
        if (fechasCorruptasEncontradas > 0) {
          console.log(`Se encontraron y corrigieron ${fechasCorruptasEncontradas} fechas corruptas durante la pre-validación`);
        }
        
        return datosLimpios;
      };
      
      // Limpiar datos antes de importar
      const datosLimpios = validarYLimpiarFechas(req.body);
      
      // Importar los datos con el método mejorado que corrige fechas
      const resultado = await storage.importarDatos(datosLimpios);
      
      console.log("Resultado de importación:", resultado);
      
      if (resultado) {
        res.status(200).json({ message: "Datos importados correctamente" });
      } else {
        res.status(500).json({ message: "Error al importar datos" });
      }
    } catch (error) {
      console.error("Error al importar datos:", error);
      // Enviar información más detallada del error al cliente
      res.status(500).json({ 
        message: "Error al importar datos", 
        error: error.message || "Error desconocido",
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      });
    }
  });

  // ===== Rutas para configuraciones =====
  
  // Obtener todas las configuraciones
  app.get("/api/configuraciones", isAuthenticated, async (req, res, next) => {
    try {
      const configuraciones = await storage.getAllConfiguraciones();
      res.json(configuraciones);
    } catch (error) {
      console.error("Error al obtener configuraciones:", error);
      next(error);
    }
  });
  
  // Obtener el siguiente documento de identidad autogenerado
  app.get("/api/siguiente-documento-identidad", isAuthenticated, async (req, res, next) => {
    try {
      // Usamos la nueva implementación que no incrementa el contador
      const documento = await storage.getSiguienteDocumentoIdentidad();
      res.json({ documento });
    } catch (error) {
      console.error("Error al obtener siguiente documento de identidad:", error);
      next(error);
    }
  });

  // Obtener configuraciones por categoría
  app.get("/api/configuraciones/categoria/:categoria", isAuthenticated, async (req, res, next) => {
    try {
      const categoria = req.params.categoria;
      const configuraciones = await storage.getConfiguracionesPorCategoria(categoria);
      res.json(configuraciones);
    } catch (error) {
      console.error("Error al obtener configuraciones por categoría:", error);
      next(error);
    }
  });

  // Obtener una configuración específica por clave
  app.get("/api/configuraciones/clave/:clave", isAuthenticated, async (req, res, next) => {
    try {
      const clave = req.params.clave;
      const configuracion = await storage.getConfiguracion(clave);
      
      if (!configuracion) {
        return res.status(404).json({ message: "Configuración no encontrada" });
      }
      
      res.json(configuracion);
    } catch (error) {
      console.error("Error al obtener configuración:", error);
      next(error);
    }
  });

  // Guardar o actualizar una configuración
  app.post("/api/configuraciones", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permiso para modificar configuraciones" });
      }

      // Validar los datos de la configuración
      try {
        insertConfiguracionSchema.parse(req.body);
      } catch (error) {
        return res.status(400).json({ message: "Datos de configuración inválidos", error });
      }

      // Guardar la configuración
      const configuracion = await storage.saveConfiguracion(req.body);
      res.status(201).json(configuracion);
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      next(error);
    }
  });

  // Actualizar una configuración existente
  app.put("/api/configuraciones/:id", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permiso para modificar configuraciones" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de configuración inválido" });
      }

      // Verificar que exista la configuración
      const configuraciones = await storage.getAllConfiguraciones();
      const configuracion = configuraciones.find(c => c.id === id);
      if (!configuracion) {
        return res.status(404).json({ message: "Configuración no encontrada" });
      }

      // Actualizar la configuración
      const configuracionActualizada = await storage.updateConfiguracion(id, req.body);
      
      if (configuracionActualizada) {
        res.json(configuracionActualizada);
      } else {
        res.status(500).json({ message: "Error al actualizar la configuración" });
      }
    } catch (error) {
      console.error("Error al actualizar configuración:", error);
      next(error);
    }
  });

  // Eliminar una configuración
  app.delete("/api/configuraciones/:id", isAuthenticated, async (req, res, next) => {
    try {
      // Verificar que el usuario sea administrador
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permiso para eliminar configuraciones" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de configuración inválido" });
      }

      // Verificar que exista la configuración
      const configuraciones = await storage.getAllConfiguraciones();
      const configuracion = configuraciones.find(c => c.id === id);
      if (!configuracion) {
        return res.status(404).json({ message: "Configuración no encontrada" });
      }

      // Eliminar la configuración
      const resultado = await storage.deleteConfiguracion(id);
      
      if (resultado) {
        res.status(200).json({ message: "Configuración eliminada correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar la configuración" });
      }
    } catch (error) {
      console.error("Error al eliminar configuración:", error);
      next(error);
    }
  });

  // Ruta para actualizar credenciales de usuario
  app.post("/api/cambiar-credenciales", isAuthenticated, async (req, res, next) => {
    try {
      const { username, password, passwordActual, nombre } = req.body;
      const userId = req.user!.id;
      
      // Verificar que el usuario existe
      const usuario = await storage.getUser(userId);
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Verificar que la contraseña actual es correcta
      const passwordValida = await comparePasswords(passwordActual, usuario.password);
      if (!passwordValida) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta" });
      }
      
      // Preparar objeto con datos a actualizar
      const datosActualizacion: Partial<Express.User> = {};
      
      // Solo actualizar campos que se hayan proporcionado
      if (nombre) datosActualizacion.nombre = nombre;
      if (username) {
        // Verificar que el nombre de usuario no existe ya (excepto si es el mismo)
        const usuarioExistente = await storage.getUserByUsername(username);
        if (usuarioExistente && usuarioExistente.id !== userId) {
          return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
        }
        datosActualizacion.username = username;
      }
      
      // Si se proporciona nueva contraseña, hashearla
      if (password) {
        datosActualizacion.password = await hashPassword(password);
      }
      
      // Actualizar usuario
      const usuarioActualizado = await storage.updateUser(userId, datosActualizacion);
      
      // Eliminar la contraseña de la respuesta por seguridad
      if (usuarioActualizado) {
        const { password, ...usuarioSinPassword } = usuarioActualizado;
        res.status(200).json({ 
          message: "Credenciales actualizadas correctamente",
          user: usuarioSinPassword
        });
      } else {
        res.status(500).json({ message: "Error al actualizar las credenciales" });
      }
    } catch (error) {
      console.error("Error al cambiar credenciales:", error);
      next(error);
    }
  });
  
  // Rutas para gestión de usuarios
  
  // Obtener todos los usuarios
  app.get("/api/users", async (req, res, next) => {
    try {
      // Solo administradores pueden ver todos los usuarios
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permisos para ver la lista de usuarios" });
      }
      
      const users = await storage.getAllUsers();
      
      // Eliminar las contraseñas de la respuesta por seguridad
      const usersSinPassword = Array.from(users.values()).map(user => {
        const { password, ...userSinPassword } = user;
        return userSinPassword;
      });
      
      res.json(usersSinPassword);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      next(error);
    }
  });
  
  // Crear usuario
  app.post("/api/users", async (req, res, next) => {
    try {
      // Solo administradores pueden crear usuarios
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permisos para crear usuarios" });
      }
      
      const { nombre, username, password, rol } = req.body;
      
      // Verificar que el nombre de usuario no existe
      const usuarioExistente = await storage.getUserByUsername(username);
      if (usuarioExistente) {
        return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
      }
      
      // Hashear la contraseña
      const hashedPassword = await hashPassword(password);
      
      // Crear el usuario
      const nuevoUsuario = await storage.createUser({
        nombre,
        username,
        password: hashedPassword,
        rol: rol || "OPERADOR", // Por defecto, rol de operador
      });
      
      // Eliminar la contraseña de la respuesta por seguridad
      const { password: _, ...usuarioSinPassword } = nuevoUsuario;
      
      res.status(201).json(usuarioSinPassword);
    } catch (error) {
      console.error("Error al crear usuario:", error);
      next(error);
    }
  });
  
  // Eliminar usuario
  app.delete("/api/users/:id", async (req, res, next) => {
    try {
      // Solo administradores pueden eliminar usuarios
      if (req.user?.rol !== "ADMIN") {
        return res.status(403).json({ message: "No tienes permisos para eliminar usuarios" });
      }
      
      const userId = parseInt(req.params.id);
      
      // No permitir eliminar el propio usuario
      if (userId === req.user.id) {
        return res.status(400).json({ message: "No puedes eliminar tu propio usuario" });
      }
      
      // Verificar que el usuario existe
      const usuario = await storage.getUser(userId);
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Eliminar el usuario
      const resultado = await storage.deleteUser(userId);
      
      if (resultado) {
        res.status(200).json({ message: "Usuario eliminado correctamente" });
      } else {
        res.status(500).json({ message: "Error al eliminar el usuario" });
      }
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      next(error);
    }
  });

  // Rutas de debug para administración de usuarios
  app.get("/api/debug/ensure-admin", isAuthenticated, async (req, res) => {
    try {
      const adminUsername = "admin@sistema.com";
      const adminPassword = "admin123";
      
      // Verificar si existe el usuario administrador
      let adminUser = await storage.getUserByUsername(adminUsername);
      
      if (!adminUser) {
        // Crear el usuario administrador si no existe
        const adminHashPassword = await hashPassword(adminPassword);
        
        adminUser = await storage.createUser({
          username: adminUsername,
          password: adminHashPassword,
          nombre: "Administrador",
          email: adminUsername,
          rol: "ADMIN",
          activo: true
        });
        
        console.log("Usuario administrador creado con ID:", adminUser.id);
        return res.json({ 
          success: true, 
          message: "Usuario administrador creado correctamente",
          action: "created" 
        });
      } 
      
      // Actualizar la contraseña para garantizar acceso
      const adminHashPassword = await hashPassword(adminPassword);
      await storage.updateUserPassword(adminUser.id, adminHashPassword);
      console.log("Contraseña de administrador actualizada para garantizar acceso");
      
      return res.json({ 
        success: true, 
        message: "Contraseña de administrador actualizada correctamente",
        action: "updated" 
      });
    } catch (error) {
      console.error("Error al verificar usuario administrador:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error al verificar usuario administrador", 
        error: String(error) 
      });
    }
  });

  app.get("/api/debug/reset-password/:username", isAuthenticated, async (req, res) => {
    try {
      const username = req.params.username;
      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: "Nombre de usuario no proporcionado" 
        });
      }
      
      // Verificar si el usuario existe
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuario no encontrado" 
        });
      }
      
      // Restablecer la contraseña a un valor predeterminado
      const defaultPassword = "123456";
      const hashedPassword = await hashPassword(defaultPassword);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      console.log(`Contraseña restablecida para el usuario ${username}`);
      
      return res.json({ 
        success: true, 
        message: `Contraseña restablecida para el usuario ${username}` 
      });
    } catch (error) {
      console.error("Error al restablecer contraseña:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error al restablecer contraseña", 
        error: String(error) 
      });
    }
  });

  // Ruta para obtener información de depuración sobre el estado de autenticación
  app.get("/api/debug/auth-status", isAuthenticated, (req, res) => {
    console.log("DEBUG - GET /api/debug/auth-status - Estado de autenticación:", {
      session: !!req.session,
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      userID: req.user?.id
    });
    
    return res.json({
      session: !!req.session,
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.rol,
        nombre: req.user.nombre
      } : null
    });
  });

  // Endpoint para crear datos de prueba
  app.post("/api/test-data/create-sample", isAuthenticated, async (req, res) => {
    try {
      console.log("Creando datos de prueba...");
      
      // Crear cobradores de ejemplo
      const cobrador1 = await storage.createCobrador({
        nombre: "Carlos Mendoza",
        telefono: "555-0101",
        user_id: req.user!.id,
        zona: "Norte",
        activo: true
      });

      const cobrador2 = await storage.createCobrador({
        nombre: "Ana García",
        telefono: "555-0102", 
        user_id: req.user!.id,
        zona: "Sur",
        activo: true
      });

      // Crear clientes de ejemplo
      const clientes = [
        {
          nombre: "María Rodriguez",
          telefono: "555-1001",
          direccion: "Calle 123 #45-67, Barrio Norte",
          email: "maria@example.com",
          documento_identidad: "",
          notas: "Cliente confiable",
          cobrador_id: cobrador1.id,
          ruta: "Norte"
        },
        {
          nombre: "Juan Pérez",
          telefono: "555-1002", 
          direccion: "Avenida 456 #78-90, Centro",
          email: "juan@example.com",
          documento_identidad: "",
          notas: "Buen pagador",
          cobrador_id: cobrador1.id,
          ruta: "Norte"
        },
        {
          nombre: "Carmen López",
          telefono: "555-1003",
          direccion: "Carrera 789 #12-34, Barrio Sur",
          email: "carmen@example.com", 
          documento_identidad: "",
          notas: "Cliente nuevo",
          cobrador_id: cobrador2.id,
          ruta: "Sur"
        },
        {
          nombre: "Roberto Silva",
          telefono: "555-1004",
          direccion: "Transversal 321 #56-78, Sur",
          email: "roberto@example.com",
          documento_identidad: "",
          notas: "Cliente frecuente",
          cobrador_id: cobrador2.id,
          ruta: "Sur"
        }
      ];

      const clientesCreados = [];
      for (const clienteData of clientes) {
        const cliente = await storage.createCliente(clienteData);
        clientesCreados.push(cliente);
      }

      // Crear préstamos con diferentes fechas de próximo pago
      const hoy = new Date();
      const mañana = new Date(hoy);
      mañana.setDate(hoy.getDate() + 1);
      const pasadoMañana = new Date(hoy);
      pasadoMañana.setDate(hoy.getDate() + 2);

      const prestamos = [
        {
          cliente_id: clientesCreados[0].id,
          monto_prestado: "500000",
          interes_porcentaje: "20",
          numero_semanas: 10,
          pago_semanal: "60000",
          fecha_inicio: hoy.toISOString().split('T')[0],
          proxima_fecha_pago: hoy.toISOString().split('T')[0], // Hoy
          estado: "ACTIVO" as const,
          semanas_pagadas: 3,
          monto_total: "600000",
          balance_pendiente: "420000"
        },
        {
          cliente_id: clientesCreados[1].id,
          monto_prestado: "300000",
          interes_porcentaje: "18",
          numero_semanas: 8,
          pago_semanal: "45000", 
          fecha_inicio: hoy.toISOString().split('T')[0],
          proxima_fecha_pago: mañana.toISOString().split('T')[0], // Mañana
          estado: "ACTIVO" as const,
          semanas_pagadas: 2,
          monto_total: "360000",
          balance_pendiente: "270000"
        },
        {
          cliente_id: clientesCreados[2].id,
          monto_prestado: "750000",
          interes_porcentaje: "22",
          numero_semanas: 12,
          pago_semanal: "76250",
          fecha_inicio: hoy.toISOString().split('T')[0],
          proxima_fecha_pago: hoy.toISOString().split('T')[0], // Hoy
          estado: "ACTIVO" as const,
          semanas_pagadas: 1,
          monto_total: "915000",
          balance_pendiente: "838750"
        },
        {
          cliente_id: clientesCreados[3].id,
          monto_prestado: "400000",
          interes_porcentaje: "19",
          numero_semanas: 10,
          pago_semanal: "47600",
          fecha_inicio: hoy.toISOString().split('T')[0],
          proxima_fecha_pago: pasadoMañana.toISOString().split('T')[0], // Pasado mañana
          estado: "ACTIVO" as const,
          semanas_pagadas: 4,
          monto_total: "476000",
          balance_pendiente: "285600"
        }
      ];

      const prestamosCreados = [];
      for (const prestamoData of prestamos) {
        const prestamo = await storage.createPrestamo(prestamoData);
        prestamosCreados.push(prestamo);
      }

      console.log("Datos de prueba creados exitosamente");
      
      res.json({
        success: true,
        message: "Datos de prueba creados exitosamente",
        data: {
          cobradores: [cobrador1, cobrador2],
          clientes: clientesCreados,
          prestamos: prestamosCreados,
          fechas_prueba: {
            hoy: hoy.toISOString().split('T')[0],
            mañana: mañana.toISOString().split('T')[0], 
            pasado_mañana: pasadoMañana.toISOString().split('T')[0]
          }
        }
      });

    } catch (error) {
      console.error("Error creando datos de prueba:", error);
      res.status(500).json({ 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  // Endpoint para actualizar fechas de pago de préstamos vencidos
  app.post("/api/prestamos/actualizar-fechas", isAuthenticated, async (req, res) => {
    try {
      console.log("Actualizando fechas de pago de préstamos...");
      
      const prestamos = await storage.getAllPrestamos();
      const hoy = new Date();
      let prestamosActualizados = 0;
      
      for (const prestamo of prestamos) {
        if (prestamo.estado !== "ACTIVO") continue;
        
        const proximaFechaPago = new Date(prestamo.proxima_fecha_pago);
        
        // Si la próxima fecha de pago ya pasó, calcular la nueva fecha considerando los pagos ya realizados
        if (proximaFechaPago < hoy) {
          const fechaInicio = new Date(prestamo.fecha_prestamo);
          
          // Calcular cuántas semanas han pasado desde el inicio del préstamo
          const diasTranscurridos = Math.floor((hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
          const semanasTranscurridas = Math.floor(diasTranscurridos / 7);
          
          // La próxima fecha de pago debería considerar las semanas ya pagadas
          // Si no se han hecho pagos, la próxima fecha es fecha_inicio + 7 días
          // Si se han hecho pagos, la próxima fecha es fecha_inicio + (semanas_pagadas + 1) * 7 días
          // Pero si han pasado más semanas de las pagadas, usar las semanas transcurridas
          const semanasPagadas = prestamo.semanas_pagadas || 0;
          let semanasParaCalcular = Math.max(semanasPagadas, semanasTranscurridas);
          
          // Asegurarse de que la próxima fecha esté cerca de hoy, no en el futuro lejano
          if (semanasParaCalcular > semanasTranscurridas) {
            semanasParaCalcular = semanasTranscurridas;
          }
          
          const nuevaProximaFecha = new Date(fechaInicio);
          nuevaProximaFecha.setDate(fechaInicio.getDate() + ((semanasParaCalcular + 1) * 7));
          
          // Si la nueva fecha calculada sigue siendo anterior a hoy, usar la fecha más próxima a hoy
          if (nuevaProximaFecha <= hoy) {
            nuevaProximaFecha.setDate(fechaInicio.getDate() + ((semanasTranscurridas + 1) * 7));
          }
          
          const nuevaFechaStr = nuevaProximaFecha.toISOString().split('T')[0];
          
          // Solo actualizar si la nueva fecha es diferente
          if (nuevaFechaStr !== prestamo.proxima_fecha_pago) {
            await storage.updatePrestamo(prestamo.id, {
              proxima_fecha_pago: nuevaFechaStr
            });
            
            console.log(`Préstamo ${prestamo.id}: Fecha actualizada de ${prestamo.proxima_fecha_pago} a ${nuevaFechaStr} (semanas transcurridas: ${semanasTranscurridas}, semanas pagadas: ${semanasPagadas})`);
            prestamosActualizados++;
          }
        }
      }
      
      res.json({
        success: true,
        message: `Se actualizaron ${prestamosActualizados} préstamos`,
        prestamosActualizados
      });
      
    } catch (error) {
      console.error("Error actualizando fechas de préstamos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  // Rutas para notas de préstamos (implementación temporal)
  let notasTemporales: any[] = [];
  let nextNotaId = 1;

  app.get("/api/prestamos/:id/notas", isAuthenticated, async (req, res) => {
    try {
      const prestamoId = parseInt(req.params.id);
      const notas = notasTemporales.filter(nota => nota.prestamo_id === prestamoId);
      res.json(notas);
    } catch (error) {
      console.error("Error obteniendo notas del préstamo:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.post("/api/prestamos/:id/notas", isAuthenticated, async (req, res) => {
    try {
      const prestamoId = parseInt(req.params.id);
      const usuarioId = req.user!.id;
      
      const nuevaNota = {
        id: nextNotaId++,
        prestamo_id: prestamoId,
        usuario_id: usuarioId,
        titulo: req.body.titulo,
        contenido: req.body.contenido,
        tipo: req.body.tipo || 'GENERAL',
        importante: req.body.importante || false,
        fecha_creacion: new Date()
      };

      notasTemporales.push(nuevaNota);
      res.status(201).json(nuevaNota);
    } catch (error) {
      console.error("Error creando nota del préstamo:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.put("/api/notas/:id", isAuthenticated, async (req, res) => {
    try {
      const notaId = parseInt(req.params.id);
      const notaIndex = notasTemporales.findIndex(nota => nota.id === notaId);
      
      if (notaIndex === -1) {
        return res.status(404).json({ error: "Nota no encontrada" });
      }
      
      notasTemporales[notaIndex] = {
        ...notasTemporales[notaIndex],
        ...req.body
      };
      
      res.json(notasTemporales[notaIndex]);
    } catch (error) {
      console.error("Error actualizando nota:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.delete("/api/notas/:id", isAuthenticated, async (req, res) => {
    try {
      const notaId = parseInt(req.params.id);
      const notaIndex = notasTemporales.findIndex(nota => nota.id === notaId);
      
      if (notaIndex === -1) {
        return res.status(404).json({ error: "Nota no encontrada" });
      }
      
      notasTemporales.splice(notaIndex, 1);
      res.status(204).send();
    } catch (error) {
      console.error("Error eliminando nota:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
