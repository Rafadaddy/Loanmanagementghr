import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { ZodError } from "zod";
import { formatISO } from "date-fns";
import { insertClienteSchema, insertPrestamoSchema, insertPagoSchema, calculoPrestamoSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    return res.status(401).json({ message: "No autorizado" });
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

  const httpServer = createServer(app);
  return httpServer;
}
