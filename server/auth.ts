import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
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

async function comparePasswords(supplied: string, stored: string) {
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
  // Generar una nueva contraseña hasheada para el usuario administrador
  generateTestPassword().then(hash => {
    console.log("HASH PARA ADMIN:", hash);
  });
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "sistema-de-prestamos-secret",
    resave: true, // Cambio a true para garantizar que la sesión se guarde
    saveUninitialized: true, // Cambio a true para crear sesiones aunque no estén inicializadas
    store: storage.sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días para mayor persistencia
      httpOnly: true,
      secure: false, // Cambiar a true en producción con HTTPS
      sameSite: 'lax' // Importante para que las cookies funcionen en desarrollo
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
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("El nombre de usuario ya existe");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    console.log("DEBUG - Intento de login con:", {
      username: req.body.username,
      passwordProvided: !!req.body.password
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
          authenticated: req.isAuthenticated()
        });
        
        return res.status(200).json(user);
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
      userID: req.user?.id
    });
    
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
  
  // Eliminada la ruta debug de creación de usuarios
}
