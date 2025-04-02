# Instrucciones para el Despliegue

Para actualizar la aplicación en la versión de producción (https://loansmoneyghr.replit.app), sigue estos pasos:

1. Ve a tu Replit donde está desplegada la aplicación.

2. Una vez allí, abre la consola y ejecuta los siguientes comandos para asegurar que existe el usuario administrador:

```bash
curl -X GET http://localhost:5000/api/debug/ensure-admin
```

3. Si necesitas restablecer la contraseña de tu usuario personal, ejecuta:

```bash
curl -X GET http://localhost:5000/api/debug/reset-password/super_rafaga@hotmail.com
```

4. Una vez que hayas ejecutado esos comandos, intenta iniciar sesión con alguna de estas opciones:

   - **Usuario Administrador**:
     - Usuario: `admin@sistema.com`
     - Contraseña: `admin123`

   - **Tu Usuario**:
     - Usuario: `super_rafaga@hotmail.com`
     - Contraseña: `123456` (después de restablecer)

5. Si los comandos anteriores no funcionan, puedes crear un nuevo usuario utilizando la función de registro en la interfaz.

## Importante

Las bases de datos de desarrollo y producción son diferentes. Los cambios que haces en tu entorno de desarrollo no se aplican automáticamente al entorno de producción. Por eso, debes ejecutar estos comandos directamente en el entorno de producción.