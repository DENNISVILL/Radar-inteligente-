-- Supabase puede emitir tokens válidos sin claim email (por ejemplo, ciertos proveedores OAuth).
-- El subject verificado es la identidad primaria; el correo es un atributo opcional.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
