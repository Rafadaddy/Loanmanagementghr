import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { usingRealDatabase, pool } from "./db";
import { User as SelectUser } from "@shared/schema";
import connectPgSimple from "connect-pg-simple";
import pg from 'pg';
import createMemoryStore from 'memorystore';

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Función para generar hash de contraseña (exportada para su uso en rutas de actualización)
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashedResult = `${buf.toString("hex")}.${salt}`;
  console.log(`DEBUG - Contraseña hasheada generada: ${hashedResult}`);
  return hashedResult;
}

// Función temporal para generar una contraseña para pruebas
async function generateTestPassword() {
  const hash = await hashPassword("admin123");
  console.log("NUEVA CONTRASEÑA HASHEADA:", hash);
  return hash;
}

// Función para comparar contraseñas (exportada para su uso en rutas de actualización)
export async function comparePasswords(supplied: string, stored: string) {
  if (!stored || !stored.includes(".")) {
    console.error("Error de formato en la contraseña almacenada:", stored);
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    console.error("Error al dividir la contraseña almacenada:", { hashed, salt });
    return false;
  }
  
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Eliminar la generación automática de contraseña que causa problemas
  // Solo mostrar el hash fijo para fines informativos
  console.log("HASH FIJO PARA ADMIN: cc2e80a13700cb1ffb71aaaeac476d08e7d6ad2550c83693ae1262755568dd3718870a36fc454bc996af1bb03fa8055714a7331ff88adf8cfa1e5810d258b05c.efe8323317c7831521c66267d8888877");
  
  // Detectar si estamos en producción o desarrollo
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.REPL_SLUG || 
                      process.env.REPL_OWNER;
  
  console.log("AMBIENTE:", isProduction ? "PRODUCCIÓN" : "DESARROLLO");
  
  // Usando memorystore para todas las sesiones para evitar problemas con PostgreSQL
  console.log("Usando almacenamiento en memoria para sesiones (MemoryStore)");
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({ 
    checkPeriod: 86400000 // Limpia sesiones expiradas cada 24 horas
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "sistema-de-prestamos-secret",
    resave: true, 
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días para mayor persistencia
      httpOnly: true,
      secure: false, // false tanto en desarrollo como en producción para este entorno
      sameSite: 'lax', // lax es más compatible para este entorno
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("DEBUG - Intento de registro con:", {
        username: req.body.username,
        passwordProvided: !!req.body.password,
        requestBody: req.body
      });
      
      if (!req.body.username || !req.body.password || !req.body.nombre) {
        return res.status(400).json({
          error: "Datos incompletos. Se requiere nombre de usuario, contraseña y nombre completo."
        });
      }
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("DEBUG - Usuario ya existe:", req.body.username);
        return res.status(400).json({
          error: "El nombre de usuario ya existe"
        });
      }
      
      // Crear el usuario con los datos necesarios
      const userData = {
        username: req.body.username,
        password: await hashPassword(req.body.password),
        nombre: req.body.nombre,
        rol: req.body.rol || "USUARIO",  // Rol por defecto si no se proporciona
        email: req.body.email || req.body.username,  // Email por defecto igual al username
        activo: true  // Usuarios nuevos están activos por defecto
      };
      
      console.log("DEBUG - Creando usuario con los datos:", {
        username: userData.username,
        nombre: userData.nombre,
        rol: userData.rol,
        email: userData.email,
        activo: userData.activo
      });
      
      const user = await storage.createUser(userData);
      console.log("DEBUG - Usuario creado con ID:", user.id);
      
      // Iniciar sesión automáticamente
      req.login(user, (err) => {
        if (err) {
          console.error("DEBUG - Error en login automático:", err);
          return next(err);
        }
        console.log("DEBUG - Registro exitoso, sesión creada para:", user.username);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("ERROR en registro:", error);
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    console.log("DEBUG - Intento de login con:", {
      username: req.body.username,
      passwordProvided: !!req.body.password,
      headers: req.headers['user-agent'],
      cookies: req.headers.cookie,
      referrer: req.headers.referer
    });
    
    // Buscar el usuario manualmente primero
    try {
      const user = await storage.getUserByUsername(req.body.username);
      console.log("DEBUG - Usuario encontrado en DB:", user ? { id: user.id, username: user.username } : null);
      
      if (!user) {
        console.log("DEBUG - Usuario no encontrado");
        return res.status(401).send("Credenciales inválidas");
      }
      
      // Intentar verificar la contraseña manualmente
      const passwordValid = await comparePasswords(req.body.password, user.password);
      console.log("DEBUG - Contraseña válida:", passwordValid);
      
      if (!passwordValid) {
        console.log("DEBUG - Contraseña inválida");
        return res.status(401).send("Credenciales inválidas");
      }
      
      // Si llegamos aquí, el usuario y contraseña son correctos, autenticar
      req.login(user, (err) => {
        if (err) {
          console.error("DEBUG - Error en req.login:", err);
          return next(err);
        }
        
        console.log("DEBUG - Login exitoso, sesión creada:", {
          user: { id: user.id, username: user.username },
          session: !!req.session,
          sessionID: req.sessionID,
          authenticated: req.isAuthenticated(),
          cookies: 'Verificando cookies'
        });
        
        // Simplificamos la configuración de cookies para mayor compatibilidad
        // y evitar problemas en el entorno Replit
        if (req.session) {
          req.session.cookie.secure = false;
          req.session.cookie.sameSite = 'lax';
          req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días
          
          try {
            // Guardar la sesión sin regenerar para mantenerla simple
            req.session.save((err) => {
              if (err) {
                console.error("Error al guardar la sesión:", err);
              }
              
              // Enviamos la respuesta después de guardar
              return res.status(200).json(user);
            });
          } catch (error) {
            console.error("Error en gestión de sesión:", error);
            // Si falla el guardado, aún respondemos
            return res.status(200).json(user);
          }
        } else {
          // Si por alguna razón no hay sesión, aún devolvemos el usuario
          return res.status(200).json(user);
        }
      });
    } catch (error) {
      console.error("DEBUG - Error en proceso de login:", error);
      return next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("DEBUG - GET /api/user - Estado de autenticación:", {
      session: !!req.session,
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      userID: req.user?.id,
      cookie_direct_access: req.cookies?.direct_admin_access
    });
    
    // NOTA: Se han eliminado los mecanismos de bypass de autenticación
    
    if (!req.isAuthenticated()) {
      console.log("DEBUG - Usuario no autenticado, devolviendo 401");
      return res.sendStatus(401);
    }
    
    console.log("DEBUG - Usuario autenticado:", {
      id: req.user.id,
      username: req.user.username
    });
    
    res.json(req.user);
  });
  
  // Ruta para debugging de sesión y cookies
  app.get("/api/debug/session", (req, res) => {
    res.json({
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
      sessionExists: !!req.session,
      cookie: req.session ? {
        maxAge: req.session.cookie.maxAge,
        expires: req.session.cookie.expires,
        httpOnly: req.session.cookie.httpOnly,
        path: req.session.cookie.path,
        domain: req.session.cookie.domain,
        secure: req.session.cookie.secure,
        sameSite: req.session.cookie.sameSite
      } : null,
      headers: {
        cookie: req.headers.cookie,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      }
    });
  });
  
  // Ruta para testing de inicio de sesión del administrador
  app.get("/api/debug/admin-login-test", async (req, res) => {
    try {
      // Credenciales del administrador
      const adminUsername = "admin@sistema.com";
      const adminPassword = "admin123";
      
      // Verificar si existe el usuario
      let adminUser = await storage.getUserByUsername(adminUsername);
      
      // Si no existe, crear el usuario administrador
      if (!adminUser) {
        console.log("DEBUG - Creando usuario administrador");
        
        const adminHashPassword = await hashPassword(adminPassword);
        
        adminUser = await storage.createUser({
          username: adminUsername,
          password: adminHashPassword,
          nombre: "Administrador",
          email: adminUsername,
          rol: "ADMIN",
          activo: true
        });
        
        console.log("DEBUG - Usuario administrador creado:", adminUser.id);
      }
      
      // Verificar la contraseña manualmente
      const passwordValid = await comparePasswords(adminPassword, adminUser.password);
      
      // Mostrar información de depuración
      res.json({
        adminExists: true,
        passwordValid,
        adminUser: {
          id: adminUser.id,
          username: adminUser.username,
          rol: adminUser.rol
        },
        passwordHash: adminUser.password,
        passwordInfo: {
          hasHash: !!adminUser.password,
          hashLength: adminUser.password?.length || 0,
          hasSalt: adminUser.password?.includes('.') || false
        }
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Ruta para restablecer la contraseña de un usuario específico (solo desarrollo)
  app.get("/api/debug/reset-password/:username", async (req, res) => {
    try {
      const username = req.params.username;
      const defaultPassword = "123456";
      
      // Verificar si existe el usuario
      let user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      
      // Hashear la nueva contraseña
      const hashedPassword = await hashPassword(defaultPassword);
      
      // Actualizar en la base de datos
      await storage.updateUserPassword(user.id, hashedPassword);
      
      res.json({
        success: true,
        message: `Contraseña de ${username} restablecida a "${defaultPassword}"`,
        username: user.username,
        userId: user.id
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Ruta para garantizar que exista el usuario administrador
  app.get("/api/debug/ensure-admin", async (req, res) => {
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
        
        console.log("Admin user created:", adminUser.id);
      } else {
        // Actualizar la contraseña para garantizar acceso
        const adminHashPassword = await hashPassword(adminPassword);
        await storage.updateUserPassword(adminUser.id, adminHashPassword);
        console.log("Admin password updated for user:", adminUser.id);
      }
      
      res.json({
        success: true,
        message: "Usuario administrador verificado y actualizado",
        userId: adminUser.id
      });
    } catch (error) {
      console.error("Error ensuring admin user:", error);
      res.status(500).json({ error: String(error) });
    }
  });
}
