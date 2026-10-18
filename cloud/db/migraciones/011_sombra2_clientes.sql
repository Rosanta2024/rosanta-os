-- 011 · Sombra 2, Clientes parte 1 (18-oct-2026, rama claude/nube-fase2-mkt; rango 010-019).
-- La foto de cada noche suma reservas, carritos y CRM (cantidades por estado o segmento).
ALTER TABLE caja_fotos ADD COLUMN clientes jsonb;
