import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { ZodError } from "zod";
import { formatISO } from "date-fns";
import { 
  insertClienteSchema, 
  insertPrestamoSchema, 
  insertPagoSchema, 
  insertMovimientoCajaSchema,
  calculoPrestamoSchema 
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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
    
    // Modo de desarrollo/emergencia: permitir acceso con ID de usuario temporal
    if (req.query.user_id) {
      const userId = parseInt(req.query.user_id as string);
      console.log(`DEBUG - MODO DESARROLLO: Simulando usuario con ID ${userId}`);
      req.user = { id: userId, username: 'usuario_simulado_' + userId } as Express.User;
      return next();
    }
    
    console.log("DEBUG - Autenticación fallida en", req.path);
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
      const prestamoData = insertPrestamoSchema.parse({
        ...req.body,
        cliente_id: clienteId,
        monto_prestado: req.body.monto_prestado,
        tasa_interes: req.body.tasa_interes,
        fecha_prestamo: req.body.fecha_prestamo,
        numero_semanas: parseInt(req.body.numero_semanas),
        frecuencia_pago: req.body.frecuencia_pago,
        monto_total_pagar: req.body.monto_total_pagar,
        pago_semanal: req.body.pago_semanal,
        proxima_fecha_pago: req.body.proxima_fecha_pago || req.body.fecha_prestamo,
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
            fecha: new Date(),
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
        // Solo permitimos actualizar el monto pagado por ahora
        const { monto_pagado } = req.body;
        
        if (!monto_pagado || isNaN(Number(monto_pagado)) || Number(monto_pagado) <= 0) {
          return res.status(400).json({ message: "El monto pagado debe ser un número positivo" });
        }
        
        // Actualizar el pago
        const pagoActualizado = await storage.updatePago(id, { monto_pagado });
        
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
  app.get("/api/caja/movimientos", isAuthenticated, async (req, res, next) => {
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

  app.get("/api/caja/resumen", isAuthenticated, async (req, res, next) => {
    try {
      const resumen = await storage.getResumenCaja();
      res.json(resumen);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/caja/movimientos", isAuthenticated, async (req, res, next) => {
    try {
      console.log("DEBUG - Recibiendo petición POST /api/caja/movimientos");
      console.log("DEBUG - Datos recibidos:", req.body);
      console.log("DEBUG - Usuario autenticado:", {
        id: req.user?.id,
        username: req.user?.username,
        hasSession: !!req.session,
        isAuthenticated: req.isAuthenticated(),
        sessionID: req.sessionID
      });
      
      // Asegurar que los campos numéricos sean del tipo correcto
      const datosProcesados = {
        ...req.body,
        creado_por: req.user?.id || req.body.creado_por, // Usar el ID del usuario proporcionado explícitamente si no hay sesión
        fecha: req.body.fecha || new Date(),
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
      };
      
      console.log("DEBUG - Datos procesados antes de validación:", datosProcesados);
      
      // Validar con el esquema
      const movimientoData = insertMovimientoCajaSchema.parse(datosProcesados);
      
      console.log("DEBUG - Datos validados con Zod:", movimientoData);
      
      // Validar que el tipo sea INGRESO o EGRESO
      if (!["INGRESO", "EGRESO"].includes(movimientoData.tipo)) {
        console.log("DEBUG - Tipo inválido:", movimientoData.tipo);
        return res.status(400).json({ message: "El tipo debe ser INGRESO o EGRESO" });
      }
      
      // Validar montos positivos
      if (parseFloat(movimientoData.monto) <= 0) {
        console.log("DEBUG - Monto inválido:", movimientoData.monto);
        return res.status(400).json({ message: "El monto debe ser un valor positivo" });
      }
      
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
      res.status(201).json(movimiento);
    } catch (error) {
      console.error("Error al crear movimiento de caja:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Datos del movimiento inválidos", 
          errors: fromZodError(error).message 
        });
      }
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

  const httpServer = createServer(app);
  return httpServer;
}
