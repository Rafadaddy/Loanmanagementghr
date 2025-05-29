import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { formatISO } from "date-fns";
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
      if (!clienteData.documento_identidad || clienteData.documento_identidad.trim() === '') {
        try {
          clienteData.documento_identidad = await storage.incrementarDocumentoIdentidad();
          console.log("Asignado nuevo documento de identidad al cliente:", clienteData.documento_identidad);
        } catch (idError) {
          console.error("Error al asignar documento de identidad:", idError);
          // Asignar un ID temporal para evitar inconsistencias
          clienteData.documento_identidad = `TEMP-${Date.now()}`;
          console.warn("Se asignó un documento de identidad temporal:", clienteData.documento_identidad);
        }
      }
      // Verificar que el documento de identidad sea único
      const existeDocumento = await storage.verificarDocumentoIdentidad(clienteData.documento_identidad);
      if (existeDocumento) {
        return res.status(409).json({ error: "El documento de identidad ya existe." });
      }
      // Crear el cliente con los datos proporcionados
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
        // Permitimos actualizar el monto pagado y la fecha
        const { monto_pagado, fecha_pago } = req.body;
        
        if (!monto_pagado || isNaN(Number(monto_pagado)) || Number(monto_pagado) <= 0) {
          return res.status(400).json({ message: "El monto pagado debe ser un número positivo" });
        }
        // Preparar datos de actualización
        const datosActualizacion: any = { monto_pagado };
        
        // Si se proporciona una nueva fecha, incluirla
        if (fecha_pago) {
          datosActualizacion.fecha_pago = new Date(fecha_pago);
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
        prestamosActivos,
        totalPrestado,
        totalIntereses,
        interesesPorCobrar,
        montosPagosHoy,
        prestamosAtrasados,
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
      
      // Crear un nombre de archivo para la descarga
      const fechaActual = new Date().toISOString().split('T')[0];
      const nombreArchivo = `backup_sistema_${fechaActual}.json`;
      
      // Configurar cabeceras para descarga
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.setHeader('Content-Type', 'application/json');
      
      // Enviar los datos
      res.json(datos);
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
      console.log(`- Clientes: ${req.body.clientes?.length || 0}`);
      console.log(`- Préstamos: ${req.body.prestamos?.length || 0}`);
      console.log(`- Pagos: ${req.body.pagos?.length || 0}`);
      console.log(`- Cobradores: ${req.body.cobradores?.length || 0}`);
      console.log(`- Movimientos: ${req.body.movimientosCaja?.length || 0}`);
      
      // Importar los datos con el método mejorado que corrige fechas
      const resultado = await storage.importarDatos(req.body);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
