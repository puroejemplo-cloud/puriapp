-- =============================================
-- ESQUEMA COMPLETO — App Purificadora
-- Ejecutado via MCP Supabase el 2026-04-17
-- Para re-ejecutar: pegar en Supabase → SQL Editor → Run
-- =============================================

-- =============================================
-- TABLA: clientes
-- Personas que piden agua por WhatsApp
-- =============================================
CREATE TABLE clientes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono         text UNIQUE NOT NULL,         -- formato +52155...
  nombre           text NOT NULL,
  direccion        text NOT NULL,
  lat              double precision,              -- geocodificado con Nominatim
  lng              double precision,
  referencias      text,                          -- ej: "portón azul, casa esquina"
  garrafones_prestados integer NOT NULL DEFAULT 0,
  activo           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: productos
-- Catálogo de lo que se vende
-- =============================================
CREATE TABLE productos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  precio     numeric(10,2) NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: repartidores
-- Empleados que hacen entregas; vinculados a auth.users
-- =============================================
CREATE TABLE repartidores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  telefono   text,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: pedidos
-- Cada entrega solicitada por un cliente
-- Estados: pendiente → en_ruta → entregado | cancelado
-- =============================================
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'en_ruta', 'entregado', 'cancelado');

CREATE TABLE pedidos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  repartidor_id        uuid REFERENCES repartidores(id) ON DELETE SET NULL,
  producto_id          uuid REFERENCES productos(id) ON DELETE RESTRICT,
  estado               estado_pedido NOT NULL DEFAULT 'pendiente',
  cantidad             integer NOT NULL DEFAULT 1,
  total                numeric(10,2),
  garrafones_recogidos integer NOT NULL DEFAULT 0,
  origen               text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'manual'
  notas                text,
  entregado_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: ventas_ruta
-- Ventas a clientes espontáneos (sin registro previo)
-- =============================================
CREATE TABLE ventas_ruta (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id    uuid NOT NULL REFERENCES repartidores(id) ON DELETE RESTRICT,
  nombre_cliente   text,
  telefono         text,
  direccion        text,
  lat              double precision,
  lng              double precision,
  cantidad         integer NOT NULL DEFAULT 1,
  total            numeric(10,2) NOT NULL,
  convertir_cliente boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: whatsapp_log
-- Registro de todos los mensajes entrantes y salientes
-- =============================================
CREATE TABLE whatsapp_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono   text NOT NULL,
  mensaje    text NOT NULL,
  direccion  text NOT NULL CHECK (direccion IN ('in', 'out')),
  pedido_id  uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: push_subscriptions
-- Suscripciones push web de cada repartidor
-- =============================================
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id uuid NOT NULL REFERENCES repartidores(id) ON DELETE CASCADE,
  endpoint      text UNIQUE NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES para mejorar velocidad de consultas frecuentes
-- =============================================
CREATE INDEX idx_pedidos_estado            ON pedidos(estado);
CREATE INDEX idx_pedidos_repartidor_estado ON pedidos(repartidor_id, estado);
CREATE INDEX idx_clientes_telefono         ON clientes(telefono);
CREATE INDEX idx_push_repartidor           ON push_subscriptions(repartidor_id);

-- =============================================
-- REALTIME (ejecutado por separado via ALTER PUBLICATION)
-- =============================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
-- ALTER PUBLICATION supabase_realtime ADD TABLE ventas_ruta;

-- =============================================
-- DATOS SEMILLA: productos iniciales
-- =============================================
INSERT INTO productos (nombre, precio) VALUES
  ('Garrafón 20L',   35.00),
  ('Botella 1L',     10.00),
  ('Paquete 4x1L',   35.00);
