-- Añadir columna email a la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Añadir columna activo a la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE NOT NULL;

-- Actualizar usuario admin si existe
UPDATE users SET email = 'admin@sistema.com' WHERE username = 'admin@sistema.com';
UPDATE users SET activo = TRUE WHERE username = 'admin@sistema.com';

-- Agregar restricción de unicidad a la columna documento_identidad en la tabla clientes
ALTER TABLE clientes ADD CONSTRAINT unique_documento_identidad UNIQUE (documento_identidad);
