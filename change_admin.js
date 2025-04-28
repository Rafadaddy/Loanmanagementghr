// Script para cambiar el usuario y contraseña del administrador
import { storage } from './server/storage.js';
import { hashPassword } from './server/auth.js';

async function cambiarAdministrador() {
  try {
    // Nuevo usuario y contraseña
    const nuevoUsuario = "nuevo_admin@sistema.com";
    const nuevaContrasena = "nueva_contrasena123";
    
    // Buscar el usuario administrador actual
    const adminActual = await storage.getUserByUsername("admin@sistema.com");
    
    if (!adminActual) {
      console.log("No se encontró el usuario administrador actual");
      return;
    }
    
    // Actualizar el usuario existente
    const hashNuevaContrasena = await hashPassword(nuevaContrasena);
    
    // Actualizar el nombre de usuario
    await storage.updateUser(adminActual.id, {
      username: nuevoUsuario,
      email: nuevoUsuario
    });
    
    // Actualizar la contraseña
    await storage.updateUserPassword(adminActual.id, hashNuevaContrasena);
    
    console.log("¡Usuario y contraseña de administrador actualizados con éxito!");
    console.log("Nuevo usuario:", nuevoUsuario);
    console.log("Nueva contraseña: [PROTEGIDA - Usa la que estableciste]");
  } catch (error) {
    console.error("Error al actualizar administrador:", error);
  }
}

cambiarAdministrador().finally(() => process.exit(0));
