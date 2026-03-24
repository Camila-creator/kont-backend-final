-- 1) Proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Clientes
CREATE TABLE IF NOT EXISTS customers (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'RETAIL', -- RETAIL | MAYORISTA
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Insumos (materia prima)
CREATE TABLE IF NOT EXISTS supplies (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'UNIDAD', -- UNIDAD | KG | L | ML | etc
  supplier_id   BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock         NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
  has_expiry    BOOLEAN NOT NULL DEFAULT false,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Productos (lo que vendes)
CREATE TABLE IF NOT EXISTS products (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'OTRO',
  supplier_id   BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  unit          TEXT NOT NULL DEFAULT 'UNIDAD', -- UNIDAD | KG
  buy_cost      NUMERIC(12,2) NOT NULL DEFAULT 0, -- costo compra directo (si aplica)
  retail_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  mayor_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock         NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
  has_expiry    BOOLEAN NOT NULL DEFAULT false,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* =========================================================
   5) RECETAS (BOM)
========================================================= */

CREATE TABLE IF NOT EXISTS recipes (
  id            BIGSERIAL PRIMARY KEY,
  product_id    BIGINT UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id            BIGSERIAL PRIMARY KEY,
  recipe_id     BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  supply_id     BIGINT NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
  qty           NUMERIC(12,3) NOT NULL DEFAULT 0,  -- cantidad del insumo que consume
  unit          TEXT NOT NULL DEFAULT 'UNIDAD',     -- opcional (si quieres fijarlo)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, supply_id)
);


/* =========================================================
   6) PEDIDOS
========================================================= */

CREATE TABLE IF NOT EXISTS orders (
  id                  BIGSERIAL PRIMARY KEY,
  customer_id         BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'BORRADOR', -- BORRADOR | CONFIRMADO | DESPACHADO | ENTREGADO | ANULADO
  price_mode          TEXT NOT NULL DEFAULT 'AUTO',     -- AUTO | RETAIL | MAYORISTA
  wholesale_threshold INT NOT NULL DEFAULT 6,
  notes               TEXT,
  order_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty           NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


/* =========================================================
   7) PRODUCCIÓN
   - cuando “produces” productos usando insumos (si aplica)
========================================================= */

CREATE TABLE IF NOT EXISTS productions (
  id            BIGSERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'BORRADOR', -- BORRADOR | FINALIZADA | ANULADA
  notes         TEXT,
  production_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_items (
  id              BIGSERIAL PRIMARY KEY,
  production_id   BIGINT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty_made        NUMERIC(12,3) NOT NULL DEFAULT 1, -- cuánto produjo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


/* =========================================================
   8) COMPRAS (a proveedores)
========================================================= */

CREATE TABLE IF NOT EXISTS purchases (
  id            BIGSERIAL PRIMARY KEY,
  supplier_id   BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'BORRADOR', -- BORRADOR | RECIBIDA | ANULADA
  invoice_ref   TEXT,  -- # factura / referencia
  notes         TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- compra puede traer insumos o productos (por eso 2 columnas opcionales)
CREATE TABLE IF NOT EXISTS purchase_items (
  id            BIGSERIAL PRIMARY KEY,
  purchase_id   BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  supply_id     BIGINT REFERENCES supplies(id) ON DELETE RESTRICT,
  product_id    BIGINT REFERENCES products(id) ON DELETE RESTRICT,
  qty           NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Evita que metas ambos o ninguno
  CHECK (
    (supply_id IS NOT NULL AND product_id IS NULL)
    OR
    (supply_id IS NULL AND product_id IS NOT NULL)
  )
);


/* =========================================================
   9) PAGOS
   - Pagos de clientes (CXC)
   - Pagos a proveedores (CXP)
========================================================= */

CREATE TABLE IF NOT EXISTS customer_payments (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  order_id      BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  method        TEXT NOT NULL DEFAULT 'TRANSFERENCIA', -- EFECTIVO | TRANSFERENCIA | PUNTO | ZELLE | etc
  ref           TEXT, -- referencia bancaria
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id            BIGSERIAL PRIMARY KEY,
  supplier_id   BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_id   BIGINT REFERENCES purchases(id) ON DELETE SET NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  method        TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
  ref           TEXT,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


/* =========================================================
   10) Índices útiles (para que todo vuele después)
========================================================= */

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplies_supplier_id ON supplies(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);

-- Agrega columnas con los nombres que tu frontend usa
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS nombre   TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS ubicacion TEXT,
ADD COLUMN IF NOT EXISTS notas    TEXT;

-- Copia lo que exista en las columnas viejas hacia las nuevas
UPDATE suppliers
SET
  nombre   = COALESCE(nombre, name),
  telefono = COALESCE(telefono, phone),
  ubicacion = COALESCE(ubicacion, address),
  notas    = COALESCE(notas, NULL);

-- (Opcional pero recomendado) Asegura NOT NULL en "nombre"
ALTER TABLE suppliers
ALTER COLUMN nombre SET NOT NULL;

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS notes TEXT;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

ALTER TABLE suppliers DROP COLUMN name;
ALTER TABLE suppliers DROP COLUMN phone;
ALTER TABLE suppliers DROP COLUMN address;
ALTER TABLE suppliers DROP COLUMN email;
ALTER TABLE suppliers DROP COLUMN notes;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'suppliers';

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS email   TEXT;

SELECT id, nombre, telefono, email, ubicacion, notas, created_at
FROM suppliers
ORDER BY id DESC
LIMIT 20;


SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;


ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'UNIDAD';
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2) DEFAULT 0;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS stock NUMERIC(12,2) DEFAULT 0;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS min_stock NUMERIC(12,2) DEFAULT 0;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE supplies
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE supplies
DROP COLUMN IF EXISTS nombre,
DROP COLUMN IF EXISTS unidad,
DROP COLUMN IF EXISTS costo;

SELECT id, name, category, unit, supplier_id, cost, stock, min_stock, has_expiry, expiry_date, created_at, updated_at
FROM supplies
ORDER BY id DESC
LIMIT 50;

ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS waste_type text;

ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS waste_value numeric(12,3);

-- default para que no queden null raros
UPDATE recipes
SET waste_type = COALESCE(waste_type, 'PERCENT'),
    waste_value = COALESCE(waste_value, 0)
WHERE waste_type IS NULL OR waste_value IS NULL;

ALTER TABLE recipe_items
ADD CONSTRAINT fk_recipe_items_recipe
FOREIGN KEY (recipe_id) REFERENCES recipes(id)
ON DELETE CASCADE;

ALTER TABLE recipe_items
ADD CONSTRAINT fk_recipe_items_supply
FOREIGN KEY (supply_id) REFERENCES supplies(id)
ON DELETE RESTRICT;

ALTER TABLE recipe_items
ADD CONSTRAINT uq_recipe_supply UNIQUE (recipe_id, supply_id);

CREATE TABLE IF NOT EXISTS production_consumption (
  id SERIAL PRIMARY KEY,
  production_id INT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  supply_id INT NOT NULL REFERENCES supplies(id),
  qty_used NUMERIC(12,3) NOT NULL CHECK (qty_used >= 0),
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_consumption_production_id
  ON production_consumption(production_id);

CREATE INDEX IF NOT EXISTS idx_prod_consumption_supply_id
  ON production_consumption(supply_id);

-- PRODUCTIONS
CREATE TABLE IF NOT EXISTS productions (
  id            BIGSERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'DONE',
  notes         TEXT,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUCTION_ITEMS (qué producto se produjo y cuánto)
CREATE TABLE IF NOT EXISTS production_items (
  id            BIGSERIAL PRIMARY KEY,
  production_id BIGINT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  product_id    BIGINT NOT NULL REFERENCES products(id),
  qty_made      INT NOT NULL CHECK (qty_made > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUCTION_CONSUMPTION (qué insumos se gastaron)
CREATE TABLE IF NOT EXISTS production_consumption (
  id            BIGSERIAL PRIMARY KEY,
  production_id BIGINT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  supply_id     BIGINT NOT NULL REFERENCES supplies(id),
  qty_used      NUMERIC(12,3) NOT NULL CHECK (qty_used >= 0),
  unit          VARCHAR(20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_items_production_id ON production_items(production_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_production_id ON production_consumption(production_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_supply_id ON production_consumption(supply_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS doc text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS terms text DEFAULT 'CONTADO',
  ADD COLUMN IF NOT EXISTS wholesale_min integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'BORRADOR',
  price_mode TEXT NOT NULL DEFAULT 'AUTO',  -- AUTO/RETAIL/MAYORISTA
  wholesale_threshold INT NOT NULL DEFAULT 6,
  notes TEXT,
  order_date TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);


ALTER TABLE orders
ADD COLUMN inventory_applied BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock NUMERIC(12,3) NOT NULL DEFAULT 0;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS inventory_applied BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- purchases: completar lo que el front usa
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'CONTADO';

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- para aplicar inventario al confirmar (igual que orders)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS inventory_applied BOOLEAN NOT NULL DEFAULT false;

-- (opcional) índice útil
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

SELECT conname
FROM pg_constraint
WHERE conrelid = 'purchase_items'::regclass;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'purchase_items'::regclass
ORDER BY conname;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS inventory_applied boolean NOT NULL DEFAULT false;

-- (Opcional pero recomendado) índices para listar/filtrar rápido
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS condition text;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS due_date date;

  SELECT id, total, condition, due_date, status
FROM purchases
ORDER BY id DESC
LIMIT 20;

-- 1) Agregar columna terms
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS terms TEXT;

-- 2) Poner default (para nuevos)
ALTER TABLE orders
ALTER COLUMN terms SET DEFAULT 'CONTADO';

-- 3) Rellenar pedidos viejos con el terms del cliente (si existe)
UPDATE orders o
SET terms = COALESCE(c.terms, 'CONTADO')
FROM customers c
WHERE c.id = o.customer_id
  AND (o.terms IS NULL OR o.terms = '');

-- 4) Si quieres asegurar valores válidos
ALTER TABLE orders
ADD CONSTRAINT orders_terms_chk
CHECK (terms IN ('CONTADO','CREDITO'));

CREATE TABLE IF NOT EXISTS finance_banks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,          -- Ej: Banesco, Banco de Venezuela, BCP, Chase
  country_code VARCHAR(5) NULL,        -- Ej: VE, US, CL, AR, PE
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_banks_name_country
  ON finance_banks (LOWER(name), COALESCE(country_code,''));

  CREATE TABLE IF NOT EXISTS finance_accounts (
  id SERIAL PRIMARY KEY,

  -- "BANK" para banco, "CASH" para caja, "WALLET" para zelle/wise/etc
  kind VARCHAR(30) NOT NULL DEFAULT 'BANK',

  -- banco al que pertenece (si kind=BANK). Para CASH/WALLET puede ir NULL
  bank_id INT NULL REFERENCES finance_banks(id) ON DELETE SET NULL,

  name VARCHAR(160) NOT NULL,          -- Alias de cuenta: "Banesco Pago Móvil", "Caja", "Zelle principal"
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',  -- VES, USD, EUR...
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- info opcional (NO obligatorio)
  account_ref VARCHAR(120) NULL,       -- Ej: últimos 4, correo zelle, nro cuenta parcial, etc
  notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_active
  ON finance_accounts (is_active);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_bank
  ON finance_accounts (bank_id);

  CREATE TABLE IF NOT EXISTS finance_method_routing (
  id SERIAL PRIMARY KEY,
  method VARCHAR(50) NOT NULL UNIQUE,   -- TRANSFERENCIA, PAGO_MOVIL, EFECTIVO, ZELLE, CUENTA_EXTRANJERA
  account_id INT NULL REFERENCES finance_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- FINANCE: BANKS + ACCOUNTS
-- =========================

-- Bancos (lista libre: Banesco, BDV, Chase, BCP, etc.)
CREATE TABLE IF NOT EXISTS finance_banks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country_code VARCHAR(8) NOT NULL DEFAULT 'VE',  -- VE, US, CL, etc (texto corto)
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tipos de cuenta (dónde cae el dinero)
-- - BANCO: cuentas bancarias (VE/US/etc)
-- - EFECTIVO: caja
-- - ZELLE: cuenta zelle
-- - CUENTA_EXTRANJERA: cualquier cuenta fuera (o incluso dentro) sin limitar país
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_account_type') THEN
    CREATE TYPE finance_account_type AS ENUM ('BANCO','EFECTIVO','ZELLE','CUENTA_EXTRANJERA');
  END IF;
END $$;

-- Moneda base por cuenta (no estamos en multi-moneda compleja todavía)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_currency') THEN
    CREATE TYPE finance_currency AS ENUM ('USD','VES');
  END IF;
END $$;

-- Cuentas (una cuenta puede estar asociada a un banco, o no (caja))
CREATE TABLE IF NOT EXISTS finance_accounts (
  id SERIAL PRIMARY KEY,
  type finance_account_type NOT NULL,
  bank_id INT NULL REFERENCES finance_banks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                 -- "Banesco Pago Móvil", "Caja Principal", "Zelle Personal", etc
  currency finance_currency NOT NULL DEFAULT 'USD',
  account_ref TEXT,                   -- nro cuenta / alias / email zelle / lo que sea
  holder_name TEXT,                   -- opcional
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Método -> Cuenta por defecto (la “cuenta del día” por método)
-- Métodos: mismos que ya vienes usando
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('TRANSFERENCIA','PAGO_MOVIL','EFECTIVO','ZELLE','CUENTA_EXTRANJERA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finance_method_routing (
  method payment_method PRIMARY KEY,
  account_id INT NULL REFERENCES finance_accounts(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed de métodos (si no existen)
INSERT INTO finance_method_routing(method)
VALUES ('TRANSFERENCIA'),('PAGO_MOVIL'),('EFECTIVO'),('ZELLE'),('CUENTA_EXTRANJERA')
ON CONFLICT (method) DO NOTHING;

-- trigger simple para updated_at en banks/accounts
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_finance_banks_updated_at') THEN
    CREATE TRIGGER tr_finance_banks_updated_at
    BEFORE UPDATE ON finance_banks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_finance_accounts_updated_at') THEN
    CREATE TRIGGER tr_finance_accounts_updated_at
    BEFORE UPDATE ON finance_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 1) Agregar columna type si no existe
ALTER TABLE finance_accounts
ADD COLUMN IF NOT EXISTS type TEXT;

-- 2) Si existía otra columna con el tipo, copiamos hacia type
DO $$
DECLARE
  has_account_type boolean;
  has_kind boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='finance_accounts' AND column_name='account_type'
  ) INTO has_account_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='finance_accounts' AND column_name='kind'
  ) INTO has_kind;

  IF has_account_type THEN
    EXECUTE 'UPDATE finance_accounts SET type = COALESCE(type, account_type) WHERE type IS NULL;';
  END IF;

  IF has_kind THEN
    EXECUTE 'UPDATE finance_accounts SET type = COALESCE(type, kind) WHERE type IS NULL;';
  END IF;

  -- fallback si no había nada
  EXECUTE 'UPDATE finance_accounts SET type = COALESCE(type, ''BANCO'') WHERE type IS NULL;';
END $$;

-- 3) Normalizar valores
UPDATE finance_accounts
SET type = UPPER(TRIM(type))
WHERE type IS NOT NULL;

-- 4) Constraint (opcional pero recomendado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_accounts_type_chk'
  ) THEN
    ALTER TABLE finance_accounts
    ADD CONSTRAINT finance_accounts_type_chk
    CHECK (type IN ('BANCO','EFECTIVO','ZELLE','CUENTA_EXTRANJERA'));
  END IF;
END $$;

ALTER TABLE finance_accounts
ADD COLUMN IF NOT EXISTS holder_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- defaults razonables
UPDATE finance_accounts
SET currency = COALESCE(currency, 'USD')
WHERE currency IS NULL;

-- normalizar currency
UPDATE finance_accounts
SET currency = UPPER(TRIM(currency))
WHERE currency IS NOT NULL;

ALTER TABLE supplier_payments
ADD COLUMN IF NOT EXISTS finance_account_id BIGINT NULL;

-- opcional pero recomendado (si quieres integridad)
ALTER TABLE supplier_payments
ADD CONSTRAINT supplier_payments_finance_account_fk
FOREIGN KEY (finance_account_id)
REFERENCES finance_accounts(id)
ON DELETE SET NULL;

-- Agrega la columna para conectar el pago con la cuenta bancaria
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS finance_account_id INTEGER REFERENCES finance_accounts(id);

SELECT 
  sp.id, 
  s.nombre as proveedor, 
  sp.purchase_id as factura, 
  sp.amount as monto, 
  sp.created_at as fecha_registro
FROM supplier_payments sp
JOIN suppliers s ON sp.supplier_id = s.id
WHERE s.nombre ILIKE '%antonio%'
ORDER BY sp.id DESC;

-- Borra los pagos erróneos uno por uno
DELETE FROM supplier_payments WHERE id = 9;

-- Asignar la primera cuenta que encuentre (probablemente Banesco o Caja) 
-- a todos los pagos que tienen el campo vacío.
UPDATE customer_payments
SET finance_account_id = (SELECT id FROM finance_accounts LIMIT 1)
WHERE finance_account_id IS NULL;

/* ==================================================
   ESQUEMA MARKETING AGROMEDIC - VERSIÓN POSTGRESQL
   ================================================== */

-- 1. BRAND BOOK & ESTRATEGIA
CREATE TABLE mkt_brand_assets (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('logo', 'color', 'tipografia', 'tono_voz')),
    nombre VARCHAR(100) NOT NULL,
    valor VARCHAR(255) NOT NULL, -- URL de imagen, código HEX o fuente
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mkt_buyer_personas (
    id SERIAL PRIMARY KEY,
    nombre_avatar VARCHAR(100) NOT NULL, -- Ej: El Ganadero Moderno
    edad_rango VARCHAR(50),
    dolores TEXT, -- Pain points
    objetivos TEXT,
    canales_preferidos VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CALENDARIO EDITORIAL (Orgánico)
CREATE TABLE mkt_calendario (
    id SERIAL PRIMARY KEY,
    titulo_interno VARCHAR(150) NOT NULL,
    fecha_publicacion TIMESTAMP NOT NULL,
    plataforma VARCHAR(50) NOT NULL CHECK (plataforma IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'blog')),
    tipo_contenido VARCHAR(50) NOT NULL CHECK (tipo_contenido IN ('reel', 'story', 'post', 'carrusel', 'articulo')),
    estado VARCHAR(50) DEFAULT 'borrador' CHECK (estado IN ('borrador', 'revision', 'aprobado', 'publicado')),
    copy_caption TEXT,
    media_url VARCHAR(255), -- Link al archivo final
    responsable_id INT, -- FK a tabla usuarios (si existe)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PAUTA DIGITAL (ADS)
CREATE TABLE mkt_ads_campaigns (
    id SERIAL PRIMARY KEY,
    nombre_campana VARCHAR(200) NOT NULL,
    plataforma VARCHAR(50) NOT NULL CHECK (plataforma IN ('meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads')),
    objetivo VARCHAR(50) NOT NULL CHECK (objetivo IN ('alcance', 'trafico', 'leads', 'ventas')),
    presupuesto_total DECIMAL(10,2) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(50) DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada', 'finalizada')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mkt_ads_ejecucion (
    id SERIAL PRIMARY KEY,
    campana_id INT NOT NULL,
    nombre_anuncio VARCHAR(150),
    
    -- EL SELECTOR DE ORIGEN
    origen_creativo VARCHAR(50) NOT NULL CHECK (origen_creativo IN ('boost_organico', 'dark_post')),
    post_organico_id INT NULL, -- Si es Boost, se vincula al ID del Calendario
    media_externo_url VARCHAR(255) NULL, -- Si es Dark Post, se sube el arte aquí
    
    inversion_gastada DECIMAL(10,2) DEFAULT 0.00,
    
    -- RESULTADOS AUDITABLES
    impresiones INT DEFAULT 0,
    clics INT DEFAULT 0,
    conversiones INT DEFAULT 0,
    -- El Costo por Resultado se calculará en el Backend (Gasto / Conversiones) para evitar errores de división por cero en SQL puro.
    
    CONSTRAINT fk_campana FOREIGN KEY (campana_id) REFERENCES mkt_ads_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_organico FOREIGN KEY (post_organico_id) REFERENCES mkt_calendario(id) ON DELETE SET NULL
);

-- 4. PUBLICIDAD OFFLINE / BTL
CREATE TABLE mkt_offline (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('valla', 'radio', 'tv', 'evento', 'impresos', 'merch')),
    proveedor_id INT, -- FK a tu tabla de proveedores existente
    ubicacion_detalles VARCHAR(255),
    fecha_inicio DATE,
    fecha_fin DATE,
    costo_inversion DECIMAL(10,2) NOT NULL,
    
    -- AUDITORÍA OBLIGATORIA
    evidencia_url VARCHAR(255), -- Foto de la valla montada o grabación testigo
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_circulacion', 'finalizado')),
    observaciones TEXT
);

-- 5. INFLUENCERS & ALIANZAS
CREATE TABLE mkt_influencers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    handle_rrss VARCHAR(100) NOT NULL, -- @usuario
    nicho VARCHAR(100),
    telefono_contacto VARCHAR(50),
    calificacion_interna INT, -- 1 a 5 estrellas
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mkt_influencer_acuerdos (
    id SERIAL PRIMARY KEY,
    influencer_id INT NOT NULL,
    fecha_acuerdo DATE,
    costo_pago DECIMAL(10,2) NOT NULL,
    tipo_intercambio VARCHAR(50) NOT NULL CHECK (tipo_intercambio IN ('dinero', 'canje', 'mixto')),
    
    entregables_pactados TEXT, -- Qué debe entregar
    
    -- AUDITORÍA DE RESULTADOS
    cumplio_fecha BOOLEAN DEFAULT FALSE,
    alcance_logrado INT DEFAULT 0,
    clicks_logrados INT DEFAULT 0,
    evidencia_metricas_url VARCHAR(255), -- Screenshot de estadísticas
    
    CONSTRAINT fk_influencer FOREIGN KEY (influencer_id) REFERENCES mkt_influencers(id) ON DELETE CASCADE
);

-- 6. BANCO DE MEDIOS & SOLICITUDES
CREATE TABLE mkt_media_assets (
    id SERIAL PRIMARY KEY,
    nombre_archivo VARCHAR(150),
    ruta_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL CHECK (tipo_archivo IN ('imagen', 'video', 'documento', 'editable')),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('campana', 'producto', 'institucional', 'evento')),
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mkt_solicitudes (
    id SERIAL PRIMARY KEY,
    departamento_solicitante VARCHAR(50) NOT NULL CHECK (departamento_solicitante IN ('ventas', 'rrhh', 'gerencia', 'operaciones')),
    titulo_solicitud VARCHAR(150),
    descripcion TEXT,
    fecha_tope DATE,
    prioridad VARCHAR(50) DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'entregado')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

/* ==========================================================
   SOLUCIÓN DE ERROR: HABILITAR CAMPOS OPCIONALES
   ========================================================== */

-- 1. Primero, permitimos que 'valor' pueda estar vacío (NULL)
--    Esto es vital porque la Misión o Visión no tienen un "valor" corto como un color.
ALTER TABLE mkt_brand_assets ALTER COLUMN valor DROP NOT NULL;

-- 2. Aseguramos que la lista de categorías permitidas esté actualizada
ALTER TABLE mkt_brand_assets DROP CONSTRAINT IF EXISTS mkt_brand_assets_tipo_check;

ALTER TABLE mkt_brand_assets ADD CONSTRAINT mkt_brand_assets_tipo_check 
CHECK (tipo IN (
    'logo',          -- Para imágenes
    'color',         -- Para códigos Hex
    'tipografia',    -- Para fuentes
    'filosofia',     -- Misión, Visión, Valores
    'estrategia',    -- Manifiesto, Tono de Voz
    'empaque'        -- Protocolo de operaciones
));

/* ==========================================================
   AHORA SÍ: INSERTAR DATOS (SEED DATA)
   ========================================================== */

-- A. FILOSOFÍA (ADN Agromedic)
INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor) VALUES 
('filosofia', 'mision', 'Democratizar la tecnología agrícola en Venezuela, proveyendo herramientas accesibles para optimizar recursos y maximizar rentabilidad.', NULL),
('filosofia', 'vision', 'Ser el estándar nacional de gestión agropecuaria digital para el 2030, conectando tradición con innovación.', NULL),
('filosofia', 'valores', 'Honestidad en el dato, Simplicidad de uso, Respeto al productor, Innovación constante.', NULL);

-- B. ESTRATEGIA
INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor) VALUES 
('estrategia', 'manifiesto', 'Creemos que el campo no necesita ser complicado para ser productivo. No vendemos software; vendemos la tranquilidad de saber que tu finca está bajo control.', NULL),
('estrategia', 'tono_voz', 'Profesional y Cercano; Directo; Prohibido usar jerga juvenil excesiva.', NULL);

-- C. OPERACIONES (EMPAQUES)
-- Aquí sí usamos 'valor' para poner el número del paso (1, 2, 3...)
INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor) VALUES 
('empaque', 'Caja Nueva', 'Solo cartón corrugado nuevo. Sin logos ajenos.', '1'),
('empaque', 'Protección', 'Doble capa de burbuja + Papel Kraft.', '2'),
('empaque', 'Detalles', 'Tarjeta de agradecimiento visible al abrir.', '3'),
('empaque', 'Sellado', 'Cinta personalizada Agromedic + Guía plástica.', '4');

-- 1. Limpiamos nombres viejos si existen y los volvemos genéricos
UPDATE mkt_brand_assets SET nombre = 'Color Principal' WHERE tipo = 'color' AND (nombre = 'Azul Main' OR nombre ILIKE '%Principal%');
UPDATE mkt_brand_assets SET nombre = 'Color Secundario' WHERE tipo = 'color' AND (nombre = 'Verde Campo' OR nombre ILIKE '%Secundario%');
UPDATE mkt_brand_assets SET nombre = 'Color Terciario' WHERE tipo = 'color' AND (nombre = 'Amarillo' OR nombre ILIKE '%Terciario%');
UPDATE mkt_brand_assets SET nombre = 'Color Texto' WHERE tipo = 'color' AND (nombre = 'Gris Texto' OR nombre ILIKE '%Texto%');

-- 2. Aseguramos que existan los registros (Si no existen, los crea en negro #000000)
INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor)
SELECT 'color', 'Color Principal', '#000000', NULL WHERE NOT EXISTS (SELECT 1 FROM mkt_brand_assets WHERE nombre = 'Color Principal');

INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor)
SELECT 'color', 'Color Secundario', '#000000', NULL WHERE NOT EXISTS (SELECT 1 FROM mkt_brand_assets WHERE nombre = 'Color Secundario');

INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor)
SELECT 'color', 'Color Terciario', '#000000', NULL WHERE NOT EXISTS (SELECT 1 FROM mkt_brand_assets WHERE nombre = 'Color Terciario');

INSERT INTO mkt_brand_assets (tipo, nombre, descripcion, valor)
SELECT 'color', 'Color Texto', '#000000', NULL WHERE NOT EXISTS (SELECT 1 FROM mkt_brand_assets WHERE nombre = 'Color Texto');

DROP TABLE IF EXISTS mkt_buyer_personas;

CREATE TABLE mkt_buyer_personas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- DATOS REALES (JSON)
    -- Estructura: { edad, genero, ubicacion, intereses, pago_contado, pago_credito, tipo_mayorista, tipo_detal }
    data_real JSONB DEFAULT '{}', 

    -- DATOS IDEALES / META (JSON)
    data_ideal JSONB DEFAULT '{}',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos un perfil de prueba para no empezar con la pantalla en blanco
INSERT INTO mkt_buyer_personas (nombre, descripcion, data_real, data_ideal)
VALUES (
    'El Productor Tradicional',
    'Cliente actual promedio. Valora el crédito y compra en volumen.',
    '{"edad": "50-65", "genero": "Masculino", "ubicacion": "Los Llanos", "intereses": "Ganadería, Precios, Clima", "pago_contado": 20, "pago_credito": 80, "tipo_mayorista": 90, "tipo_detal": 10}',
    '{"edad": "40-55", "genero": "Masculino", "ubicacion": "Nacional", "intereses": "Tecnología, Eficiencia", "pago_contado": 50, "pago_credito": 50, "tipo_mayorista": 70, "tipo_detal": 30}'
);

-- 1. TABLA PARA LOS POSTS DEL CALENDARIO
DROP TABLE IF EXISTS mkt_editorial_posts;
CREATE TABLE mkt_editorial_posts (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    plataforma VARCHAR(50) NOT NULL, -- Instagram, Facebook, WhatsApp, LinkedIn
    fecha_publicacion DATE NOT NULL,
    hora_publicacion TIME NOT NULL,
    estado VARCHAR(50) DEFAULT 'Borrador', -- Borrador, Programado, Publicado
    anuncio BOOLEAN DEFAULT FALSE,
    copy_text TEXT,
    link_multimedia VARCHAR(500),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA PARA EL TABLERO DE MÉTRICAS DEL CM
DROP TABLE IF EXISTS mkt_cm_metrics;
CREATE TABLE mkt_cm_metrics (
    id SERIAL PRIMARY KEY,
    periodo VARCHAR(50), -- Diario, Semanal, Mensual
    seguidores VARCHAR(50), -- VARCHAR para permitir textos como "12.5k" o "12,500"
    engagement NUMERIC(5,2), -- Guardará porcentajes como 4.50
    clics INTEGER,
    pregunta_frecuente TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATOS DE PRUEBA PARA LAS MÉTRICAS (Para que no inicie vacío)
INSERT INTO mkt_cm_metrics (periodo, seguidores, engagement, clics, pregunta_frecuente)
VALUES ('Semanal', '12,450', 4.20, 345, '¿Tienen envíos a Guárico?');

-- DATOS DE PRUEBA PARA LOS POSTS (Basados en Febrero 2026 para que cuadre con tus pruebas)
INSERT INTO mkt_editorial_posts (titulo, plataforma, fecha_publicacion, hora_publicacion, estado, anuncio, copy_text)
VALUES 
('Bienvenida Febrero', 'Instagram', '2026-02-01', '09:00', 'Publicado', false, 'Iniciamos un nuevo mes con todo...'),
('Promo Fertilizantes', 'Facebook', '2026-02-20', '14:30', 'Programado', true, 'Aprovecha nuestra promo...'),
('Tips de Riego', 'WhatsApp', '2026-02-26', '10:00', 'Programado', false, 'Aquí te dejamos 3 tips para...'),
('Día del Agrónomo', 'LinkedIn', '2026-02-28', '12:00', 'Borrador', false, 'Feliz día a todos los agrónomos...');

-- 1. TABLA DE PÚBLICOS GUARDADOS
DROP TABLE IF EXISTS mkt_ads_audiences CASCADE;
CREATE TABLE mkt_ads_audiences (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    edad VARCHAR(50),
    genero VARCHAR(50),
    ubicacion TEXT,
    intereses TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE CAMPAÑAS (Conectada al Calendario)
DROP TABLE IF EXISTS mkt_ads_campaigns CASCADE;
CREATE TABLE mkt_ads_campaigns (
    id SERIAL PRIMARY KEY,
    post_id INTEGER, -- ¡LA CONEXIÓN MÁGICA CON EL CALENDARIO!
    
    nombre_campana VARCHAR(255) NOT NULL,
    plataforma_origen VARCHAR(50),
    ubicacion_red VARCHAR(100),
    
    -- Segmentación guardada en la campaña
    publico_edad VARCHAR(50),
    publico_genero VARCHAR(50),
    publico_ubicacion TEXT,
    publico_intereses TEXT,

    -- Presupuesto y Tiempo
    presupuesto_diario NUMERIC(10,2),
    fecha_inicio DATE,
    fecha_fin DATE,
    es_continuo BOOLEAN DEFAULT FALSE,
    
    -- Resultados y Evaluaciones
    estado VARCHAR(50) DEFAULT 'Activa', -- Draft, Activa, Pausada, Finalizada
    resultados JSONB DEFAULT '{}', -- { impresiones, clics, cpc, ctr }
    eval_manual VARCHAR(50), 
    eval_sistema VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATOS DE PRUEBA PARA PÚBLICOS
INSERT INTO mkt_ads_audiences (nombre, edad, genero, ubicacion, intereses)
VALUES 
('Ganaderos Core', '30-55', 'Hombres', 'Llanos, Carabobo', 'Ganadería, Fincas, Maquinaria agrícola'),
('Jóvenes Agrónomos', '22-35', 'Mixto', 'Nacional', 'Universidad, Tecnología agrícola, Sostenibilidad');

INSERT INTO mkt_ads_campaigns (nombre_campana, plataforma_origen, presupuesto_diario, fecha_inicio, estado, resultados, eval_manual, eval_sistema)
VALUES (
    'Campaña de Prueba AI', 'Meta', 5.00, '2026-02-01', 'Activa',
    '{"impresiones": 0, "clics": 0, "cpc": 0, "ctr": 0}'::jsonb,
    '', ''
);

INSERT INTO mkt_ads_campaigns (
    nombre_campana, plataforma_origen, ubicacion_red, presupuesto_diario, 
    fecha_inicio, fecha_fin, es_continuo, estado, resultados, eval_manual, eval_sistema
) VALUES 
(
    'Búsqueda Semillas Premium', 'Google', 'Google Search', 15.00, 
    '2026-01-10', '2026-01-20', false, 'Finalizada',
    '{"impresiones": 25400, "clics": 1850, "cpc": 0.12, "ctr": 7.28}'::jsonb,
    'Exitosa 🔥', 'Exitosa 🔥'
),
(
    'Prueba Video Viral', 'TikTok', 'TikTok Feed', 8.00, 
    '2026-02-01', '2026-02-05', false, 'Finalizada',
    '{"impresiones": 4200, "clics": 12, "cpc": 2.50, "ctr": 0.28}'::jsonb,
    'Mala 📉', 'Mala 📉'
);

DROP TABLE IF EXISTS mkt_offline_activities CASCADE;

CREATE TABLE mkt_offline_activities (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Planeado',
    ubicacion VARCHAR(255),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    
    -- Estrategia y Finanzas
    objetivo TEXT,
    presupuesto NUMERIC(10,2) DEFAULT 0.00,
    gasto_real NUMERIC(10,2) DEFAULT 0.00,
    resultados TEXT,
    
    -- Proveedores y Notas
    proveedor VARCHAR(200),
    contacto VARCHAR(150),
    drive_link VARCHAR(255),
    notas TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos un par de datos de prueba para que no arranque vacío
INSERT INTO mkt_offline_activities (nombre, categoria, estado, ubicacion, fecha_inicio, fecha_fin, objetivo, presupuesto, gasto_real, proveedor)
VALUES 
('Stand en ExpoAgro 2026', 'Evento/Feria', 'Planeado', 'Forum de Valencia', '2026-05-15', '2026-05-18', 'Exhibición de nueva línea', 1500.00, 0.00, 'Eventos C.A.'),
('Valla Autopista Regional', 'Valla/Exteriores', 'En Ejecución', 'ARC Km 104', '2025-11-01', '2026-08-01', 'Posicionamiento de marca', 800.00, 800.00, 'Vallas del Centro');

DROP TABLE IF EXISTS mkt_influencers CASCADE;

CREATE TABLE mkt_influencers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    handle VARCHAR(100) NOT NULL,
    plataforma VARCHAR(50),
    nicho VARCHAR(100),
    seguidores INTEGER DEFAULT 0,
    estatus VARCHAR(50) DEFAULT 'En Negociación',
    telefono VARCHAR(50),
    link_perfil VARCHAR(255),
    
    -- Contrato y Entregables
    tipo_contrato VARCHAR(50),
    fecha_inicio DATE,
    fecha_fin DATE,
    cuota TEXT,
    modalidad_pago VARCHAR(50),
    inversion NUMERIC(10,2) DEFAULT 0.00,
    num_pendientes INTEGER DEFAULT 0,
    pendientes_texto TEXT,
    
    -- Resultados
    notas_resultados TEXT,
    leads INTEGER DEFAULT 0,
    evaluacion VARCHAR(50) DEFAULT 'Pendiente',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos un embajador de prueba
INSERT INTO mkt_influencers (nombre, handle, plataforma, nicho, seguidores, estatus, tipo_contrato, fecha_inicio, fecha_fin, cuota, modalidad_pago, inversion, num_pendientes, pendientes_texto, evaluacion)
VALUES ('María Fernanda', '@mafer_agro', 'Instagram', 'Agronomía / Fincas', 45000, 'Activo', 'Embajador', '2026-01-01', '2026-12-31', '2 Reels al mes + 4 Stories', 'Mixto', 1200.00, 1, 'Nos debe un Reel.', 'Excelente 🔥');

DROP TABLE IF EXISTS mkt_tasks CASCADE;
DROP TABLE IF EXISTS mkt_roles CASCADE;

-- Tabla de Cargos / Áreas (Dinámica)
CREATE TABLE mkt_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Tabla de Tareas (Tickets)
CREATE TABLE mkt_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES mkt_roles(id) ON DELETE SET NULL,
    priority VARCHAR(50) DEFAULT 'Media',
    start_date DATE,
    deadline DATE,
    status VARCHAR(50) DEFAULT 'Por Hacer',
    description TEXT,
    link_resources TEXT,
    link_deliverable TEXT,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos los cargos base
INSERT INTO mkt_roles (name) VALUES 
('Diseño Gráfico 🎨'), ('Audiovisual 📹'), ('Copywriting ✍️'), ('Community Manager 📱');

-- Insertamos una tarea de prueba
INSERT INTO mkt_tasks (title, role_id, priority, start_date, deadline, status, description) 
VALUES ('Diseño de Carrusel ExpoAgro', 1, 'Alta', '2026-02-27', '2026-03-05', 'Por Hacer', '4 slides sobre la nueva semilla.');

DROP TABLE IF EXISTS mkt_monthly_metrics CASCADE;

CREATE TABLE mkt_monthly_metrics (
    id SERIAL PRIMARY KEY,
    periodo VARCHAR(20) UNIQUE NOT NULL, -- Ej: '2026-02'
    nuevos_seguidores INTEGER DEFAULT 0,
    
    -- Salón de la Fama
    top_influencer VARCHAR(100),
    top_influencer_metric VARCHAR(100),
    top_campana VARCHAR(100),
    top_campana_metric VARCHAR(100),
    top_post VARCHAR(100),
    top_post_metric VARCHAR(100),
    top_persona VARCHAR(100),
    top_persona_metric VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos un mes de prueba para que tu Dashboard no salga en blanco
INSERT INTO mkt_monthly_metrics 
(periodo, nuevos_seguidores, top_influencer, top_influencer_metric, top_campana, top_campana_metric, top_post, top_post_metric, top_persona, top_persona_metric)
VALUES 
('2026-02', 4200, '@mafer_agro', '+450 Clics al link', 'Retargeting Enero', 'Costo por Lead: $0.15', 'Reel: 3 Errores de Siembra', '125K Vistas 🔥', 'Dueño de Finca (Carlos)', '45% de la audiencia total');



-- 1. Creamos la tabla de Empresas (Tenants)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Creamos la tabla de Usuarios para el Login
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) DEFAULT 'SELLER', -- Roles: SUPER_ADMIN, ADMIN_BRAND, SELLER
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Creamos a Agromedic como la Empresa #1
INSERT INTO tenants (name) VALUES ('Agromedic');

-- 4. Te creamos a ti como la dueña (Super Admin)
-- La contraseña aquí es 'admin123' (ya encriptada para que funcione el login)
INSERT INTO users (tenant_id, name, email, password_hash, role) 
VALUES (
    1, 
    'Camila Oquendo', 
    'admin@agromedic.com', 
    '$2a$10$wE1.0/m019K/T8.Bf4R66.B8q4Zt3K9k1I6t8i5r/h/1j7u9F.8sK', 
    'SUPER_ADMIN'
);

-- 5. ACTUALIZAMOS TU TABLA DE PRODUCTOS ACTUAL
-- Le agregamos la columna tenant_id
ALTER TABLE products ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Como ya tienes productos creados (el shampoo y el medicamento que me mostraste), 
-- le decimos al sistema que esos productos le pertenecen a Agromedic (ID 1)
UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;

-- TABLAS DE COMERCIAL Y VENTAS
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE customers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE order_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE customer_payments SET tenant_id = 1 WHERE tenant_id IS NULL;


-- TABLAS DE COMPRAS E INVENTARIO
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE suppliers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE supplies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE supplies SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE purchases SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE supplier_payments SET tenant_id = 1 WHERE tenant_id IS NULL;


-- TABLAS DE PRODUCCIÓN
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE recipes SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE recipe_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE production_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE production_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE production_consumption ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE production_consumption SET tenant_id = 1 WHERE tenant_id IS NULL;


-- TABLAS DE FINANZAS
ALTER TABLE finance_banks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE finance_banks SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE finance_accounts SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE finance_method_routing ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE finance_method_routing SET tenant_id = 1 WHERE tenant_id IS NULL;


-- TABLAS DE MARKETING
ALTER TABLE mkt_ads_audiences ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_ads_audiences SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_ads_campaigns ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_ads_campaigns SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_ads_ejecucion ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_ads_ejecucion SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_brand_assets ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_brand_assets SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_buyer_personas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_buyer_personas SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_calendario ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_calendario SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_cm_metrics ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_cm_metrics SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_editorial_posts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_editorial_posts SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_influencer_acuerdos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_influencer_acuerdos SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_influencers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_influencers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_media_assets ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_media_assets SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_offline ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_offline SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_offline_activities ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_offline_activities SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mkt_solicitudes ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE mkt_solicitudes SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE productions ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- 1. El nombre del cargo que invente el cliente (Ej: "Ninja de Ventas")
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(100);

-- 2. El interruptor de "Es Coordinador" (Falso por defecto)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tenants (id, name, is_active) 
VALUES (1, 'Agromedic (Super Admin)', true) 
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tenants ADD COLUMN plan_type VARCHAR(50) DEFAULT 'LIFETIME';
ALTER TABLE tenants ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE tenants ADD COLUMN next_payment_date DATE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_roles ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_tasks ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_offline_activities ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_influencers ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_ads_campaigns ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_monthly_metrics ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_editorial_posts ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_cm_metrics ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE mkt_ads_audiences ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE finance_banks ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE finance_routing_rules ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;
ALTER TABLE buyer_persona ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

ALTER TABLE mkt_brand_assets ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'BAJA', -- Opciones: ALTA, MEDIA, BAJA
    status VARCHAR(20) DEFAULT 'PENDIENTE', -- Opciones: PENDIENTE, EN PROCESO, RESUELTO
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


-- 1. Primero borramos la restricción vieja que solo miraba el método
ALTER TABLE finance_method_routing DROP CONSTRAINT IF EXISTS finance_method_routing_method_key;

-- 2. Creamos la nueva que mira el método Y el cliente (tenant)
ALTER TABLE finance_method_routing 
ADD CONSTRAINT unique_method_per_tenant UNIQUE (method, tenant_id);



-- 1. Aseguramos que no haya transacciones pendientes
COMMIT;

-- 2. Activamos el interruptor de seguridad (ENABLE RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_method_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_ads_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_ads_ejecucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_brand_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_buyer_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_cm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_editorial_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_influencer_acuerdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_monthly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_offline ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_offline_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 3. Creamos la política para 'tenants' (usa la columna ID)
DROP POLICY IF EXISTS tenant_isolation_policy ON tenants;
CREATE POLICY tenant_isolation_policy ON tenants 
USING (id = current_setting('app.current_tenant_id')::integer);

-- 4. Creamos la política para el resto (usa tenant_id)
-- Ejecutamos este bloque DO por separado si el anterior da problemas
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'customers', 'products', 'orders', 'order_items', 'customer_payments', 
        'finance_accounts', 'finance_banks', 'finance_method_routing', 
        'mkt_ads_audiences', 'mkt_ads_campaigns', 'mkt_ads_ejecucion', 
        'mkt_brand_assets', 'mkt_buyer_personas', 'mkt_calendario', 
        'mkt_cm_metrics', 'mkt_editorial_posts', 'mkt_influencer_acuerdos', 
        'mkt_influencers', 'mkt_media_assets', 'mkt_monthly_metrics', 
        'mkt_offline', 'mkt_offline_activities', 'mkt_roles', 'mkt_solicitudes', 
        'mkt_tasks', 'production_consumption', 'production_items', 
        'productions', 'purchase_items', 'purchases', 'recipe_items', 
        'supplier_payments', 'suppliers', 'supplies', 'support_tickets', 'users'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I USING (tenant_id = current_setting(''app.current_tenant_id'')::integer)', t);
    END LOOP;
END $$;


-- 1. Arreglamos purchase_items (asumiendo que tiene la columna purchase_id)
DROP POLICY IF EXISTS tenant_isolation_policy ON purchase_items;
CREATE POLICY tenant_isolation_policy ON purchase_items 
USING (EXISTS (
    SELECT 1 FROM purchases 
    WHERE purchases.id = purchase_items.purchase_id 
    AND purchases.tenant_id = current_setting('app.current_tenant_id')::integer
));

-- 2. Arreglamos order_items (asumiendo que tiene la columna order_id)
DROP POLICY IF EXISTS tenant_isolation_policy ON order_items;
CREATE POLICY tenant_isolation_policy ON order_items 
USING (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.tenant_id = current_setting('app.current_tenant_id')::integer
));

-- 3. Arreglamos production_items (si aplica lo mismo)
DROP POLICY IF EXISTS tenant_isolation_policy ON production_items;
CREATE POLICY tenant_isolation_policy ON production_items 
USING (EXISTS (
    SELECT 1 FROM productions 
    WHERE productions.id = production_items.production_id 
    AND productions.tenant_id = current_setting('app.current_tenant_id')::integer
));

-- Primero la borramos (esto limpia el rastro de TEXT)
DROP FUNCTION IF EXISTS get_current_tenant_id();

-- Ahora la creamos de nuevo como INTEGER
CREATE OR REPLACE FUNCTION get_current_tenant_id() 
RETURNS INTEGER AS $$
  -- Convertimos la sesión de texto a número de forma segura
  SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER;
$$ LANGUAGE sql STABLE;

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'tenant_id'
    LOOP
        -- Activamos Row Level Security
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);

        -- Limpiamos políticas previas
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', r.table_name);

        -- Creamos la política vinculando la función INTEGER con la columna INTEGER
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I 
                        USING (tenant_id = get_current_tenant_id())
                        WITH CHECK (tenant_id = get_current_tenant_id())', r.table_name);
        
        RAISE NOTICE 'Seguridad RLS activada con éxito en: %', r.table_name;
    END LOOP; 
END $$;

SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE supplies FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
    LOOP
        -- Esto obliga a que NI SIQUIERA el admin pueda saltarse el tenant_id
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);
    END LOOP; 
END $$;


DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
    LOOP
        -- Esto es lo que detendrá la filtración del Tenant 2
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);
    END LOOP; 
END $$;

DROP FUNCTION IF EXISTS get_current_tenant_id() CASCADE;

CREATE OR REPLACE FUNCTION get_current_tenant_id() 
RETURNS INTEGER AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER;
$$ LANGUAGE sql STABLE;

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'tenant_id'
    LOOP
        -- 1. Activamos RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
        
        -- 2. Forzamos RLS (Para que ni el admin se salte la regla)
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);

        -- 3. Creamos la política nueva y limpia
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I 
                        USING (tenant_id = get_current_tenant_id())
                        WITH CHECK (tenant_id = get_current_tenant_id())', r.table_name);
        
        RAISE NOTICE 'Búnker activado en tabla: %', r.table_name;
    END LOOP; 
END $$;

-- Simulamos que somos el Tenant 2
SELECT set_config('app.current_tenant_id', '2', true);

-- Intentamos ver SUPPLIES (o cualquier tabla)
-- Debería mostrarte CERO filas si no hay nada del tenant 2, 
-- o SOLO las del tenant 2 si ya tienes datos de él.
SELECT id, name, tenant_id FROM supplies;


-- Reemplaza 'postgres' por el nombre de usuario que sale en tu DATABASE_URL si es distinto
ALTER ROLE postgres NOBYPASSRLS;

SELECT relname as tabla, 
       relrowsecurity as rls_activo, 
       relforcerowsecurity as force_activo 
FROM pg_class 
WHERE relname = 'supplies';

-- 1. Creamos un usuario de prueba
DROP USER IF EXISTS test_user;
CREATE USER test_user WITH PASSWORD '123456';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;

-- 2. CAMBIAMOS AL USUARIO DE PRUEBA
SET ROLE test_user;

-- 3. SIMULAMOS SER EL TENANT 2
SELECT set_config('app.current_tenant_id', '2', false);

-- 4. ¿QUÉ VES AQUÍ?
SELECT id, name, tenant_id FROM supplies;

-- 5. VOLVER A SER ADMIN (Para no romper nada)
RESET ROLE;


CREATE USER test_user WITH PASSWORD '123456';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO test_user;

SET ROLE test_user;

SELECT set_config('app.current_tenant_id', '2', false);

SELECT id, name, tenant_id FROM supplies;

-- Regresamos a ser admin
RESET ROLE;

-- Quitamos el permiso de bypass
ALTER ROLE postgres NOBYPASSRLS;

-- Por si acaso, borramos al usuario de prueba para que no interfiera
DROP USER IF EXISTS test_user;

ALTER ROLE postgres NOBYPASSRLS;


-- 1. Crear un usuario que NO sea superusuario
CREATE USER app_user WITH PASSWORD 'tu_password_seguro';

-- 2. Darle permiso de conexión y uso de tablas
GRANT CONNECT ON DATABASE agromedic_admin TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. Quitarle explícitamente el poder de saltarse el RLS
ALTER ROLE app_user NOBYPASSRLS;

-- 4. ¡MUY IMPORTANTE! Cambia el dueño de las tablas si es necesario
-- O simplemente asegúrate de que app_user NO sea el dueño.



CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id), -- A qué empresa pertenece el log
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Quién lo hizo
    user_name VARCHAR(255), -- Guardamos el nombre por si el user es borrado
    action VARCHAR(50), -- CREATE, UPDATE, DELETE, LOGIN
    module VARCHAR(100), -- COMPRAS, BANCOS, VENTAS
    description TEXT, -- Detalle amigable del movimiento
    metadata JSONB, -- Para guardar el "antes" y "después" si quieres (opcional)
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para que el Dashboard de auditoría vuele
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

SELECT 
    a.created_at as fecha,
    u.name as usuario,
    a.action as accion,
    a.module as modulo,
    a.description as detalle,
    a.ip_address as ip
FROM audit_logs a
JOIN users u ON a.user_id = u.id
WHERE a.tenant_id = $1  -- Filtramos por la empresa actual
ORDER BY a.created_at DESC;


-- 1. Tabla de Facturas (Cabecera)
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    order_id INT REFERENCES orders(id),
    customer_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL, -- Ej: FAC-0001
    status VARCHAR(20) DEFAULT 'EMITIDA',
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Copia de seguridad de datos del cliente por si cambian en el futuro
    customer_name_snapshot VARCHAR(255),
    customer_rif_snapshot VARCHAR(20)
);

-- 2. Tabla de Ítems de Factura (Detalle)
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id INT NOT NULL,
    product_id INT,
    product_name_snapshot VARCHAR(255), -- Nombre al momento de facturar
    qty INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL
);

ALTER TABLE tenants 
ADD COLUMN rif VARCHAR(20),
ADD COLUMN address TEXT,
ADD COLUMN phone VARCHAR(20),
ADD COLUMN instagram VARCHAR(50),
ADD COLUMN logo_url VARCHAR(255); -- Por si luego quieres subir el logo 🍎

ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN discount_amount_snapshot DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS rif TEXT,
ADD COLUMN IF NOT EXISTS contacto TEXT,
ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;




CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    rate_value DECIMAL(12,4) NOT NULL, 
    currency_code TEXT DEFAULT 'USD', -- Por si luego manejas Pesos o Euros
    effective_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);


-- Agregamos la tasa a las cabeceras (Ventas y Compras)
ALTER TABLE orders ADD COLUMN exchange_rate numeric(12,4) DEFAULT 1;
ALTER TABLE purchases ADD COLUMN exchange_rate numeric(12,4) DEFAULT 1;

-- Agregamos la tasa a los pagos (Donde ocurre la magia del multipago)
ALTER TABLE customer_payments ADD COLUMN exchange_rate numeric(12,4) DEFAULT 1;
ALTER TABLE supplier_payments ADD COLUMN exchange_rate numeric(12,4) DEFAULT 1;

-- Opcional: Agregar moneda del pago para reportes más limpios
ALTER TABLE customer_payments ADD COLUMN currency text DEFAULT 'USD'; 
ALTER TABLE supplier_payments ADD COLUMN currency text DEFAULT 'USD';

ALTER TABLE purchases 
ADD COLUMN currency_code VARCHAR(5) DEFAULT 'USD';


UPDATE orders SET status = 'CONFIRMADO' WHERE id = 20;

-- Agregamos solo las que faltan para pagos de clientes
ALTER TABLE customer_payments 
  ADD COLUMN IF NOT EXISTS amount_native NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Actualizamos los pagos de proveedores (por si acaso)
ALTER TABLE supplier_payments 
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_native NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Y la de pedidos, que es súper importante para el historial
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,2) DEFAULT 1;





  ALTER TABLE supplier_payments 
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) DEFAULT 1,
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'USD';



ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) DEFAULT 1,
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'USD';


CREATE TABLE business_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- 'Tienda de Teléfonos', 'Taller Mecánico', etc.
    slug VARCHAR(50) UNIQUE,   -- 'telco', 'mechanic', 'factory'
    
    -- FLAGS DE CONFIGURACIÓN (Los superpoderes)
    has_imei BOOLEAN DEFAULT false,      -- Activa el módulo de Series/IMEI
    has_production BOOLEAN DEFAULT false, -- Activa Recetas y Producción
    has_services BOOLEAN DEFAULT false,   -- Activa gestión de citas o taller
    has_tables BOOLEAN DEFAULT false,     -- Activa mapa de mesas (Restaurantes)
    has_marketing_bundle BOOLEAN DEFAULT true -- Activa tu sección de Marketing
);


ALTER TABLE tenants ADD COLUMN business_type_id INT REFERENCES business_types(id);


-- 1. Crear tabla de categorías
CREATE TABLE business_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    has_imei BOOLEAN DEFAULT false,
    has_production BOOLEAN DEFAULT false
);

-- 2. Insertar los datos iniciales que mencionaste
INSERT INTO business_categories (name, has_imei, has_production) VALUES 
('Tienda de Teléfonos', true, true), -- IMEI sí, Recetas (Combos) sí
('Tienda de Ropa o Maquillaje', false, false),
('Taller Mecánico', false, false),
('Empresa Productora', false, true),
('Restaurante', false, true),
('Agencia de Marketing', false, false);

-- 3. Agregar la columna a la tabla de empresas
ALTER TABLE tenants ADD COLUMN category_id INT REFERENCES business_categories(id);


CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- 'BASICO', 'STANDARD', 'PREMIUM'
    max_users INTEGER NOT NULL,
    max_branches INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos tus 3 niveles "Bestie"
INSERT INTO plans (name, max_users, max_branches, description) VALUES 
('BASICO', 7, 1, 'Plan Emprendedor - 1 Sede y hasta 7 usuarios'),
('STANDARD', 20, 3, 'Plan Negocio - Hasta 3 Sedes y 20 usuarios'),
('PREMIUM', 999, 999, 'Plan Corporativo - Sedes y Usuarios Ilimitados');

-- Ahora vinculamos la tabla tenants con planes
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id) DEFAULT 1;










CREATE TABLE received_phones (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    order_id INT, -- Relación con la venta donde se recibió
    model_description TEXT, -- Lo que el vendedor escribe rápido
    credit_amount DECIMAL(10,2), -- Monto que se le restó al cliente
    status VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, PROCESADO, RECHAZADO
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    user_id INT -- Quién lo recibió
);



CREATE TABLE serial_numbers (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    imei VARCHAR(50) UNIQUE NOT NULL,
    product_id INT, -- Si se registra como producto
    supply_id INT,  -- Si se registra como insumo (para Kits)
    status VARCHAR(20) DEFAULT 'DISPONIBLE', -- DISPONIBLE, VENDIDO, USADO_EN_KIT
    origin_received_id INT -- Relación con la tabla de arriba
);

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    tenant_id INT, -- o el ID que uses para relacionarlo con el tenant
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- (agrega los campos exactos que pide tu código)
);

ALTER TABLE branches ADD COLUMN phone VARCHAR(20);

ALTER TABLE users ADD COLUMN branch_id INTEGER;

CREATE TABLE supply_categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#f1f5f9', -- Para que cada categoría tenga un color
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agregar una columna a la tabla supplies para relacionarla
ALTER TABLE supplies DROP COLUMN category; -- Borramos el texto fijo
ALTER TABLE supplies ADD COLUMN category_id INTEGER; -- Ahora usamos el ID



SELECT id, name, tenant_id, is_active FROM finance_banks;


-- Esto crea la "llave" que PostgreSQL está buscando para resolver el conflicto
ALTER TABLE finance_banks 
ADD CONSTRAINT ux_finance_banks_tenant_name_country 
UNIQUE (tenant_id, name, country_code);



-- 1. Borramos la restricción que solo mira nombre y país
ALTER TABLE finance_banks DROP CONSTRAINT IF EXISTS ux_finance_banks_name_country;

-- 2. Creamos la nueva que permite el mismo banco en diferentes Tenants
-- Usamos LOWER(name) para que "Banesco" y "banesco" se consideren iguales
CREATE UNIQUE INDEX ux_finance_banks_tenant_name_country 
ON finance_banks (tenant_id, lower(name), COALESCE(country_code, ''));


-- Borramos la RESTRICTIÓN primero (como pide el HINT)
ALTER TABLE finance_banks DROP CONSTRAINT IF EXISTS ux_finance_banks_tenant_name_country;

-- Por si acaso, borramos también el índice (ahora sí te dejará)
DROP INDEX IF EXISTS ux_finance_banks_tenant_name_country;

-- Ahora creamos la REGLA LIMPIA que usaremos en el código
ALTER TABLE finance_banks 
ADD CONSTRAINT unique_bank_per_tenant 
UNIQUE (tenant_id, name, country_code);




-- 1. Forzamos la caída de cualquier cosa que se llame así
DROP INDEX IF EXISTS public.ux_finance_banks_name_country;
ALTER TABLE finance_banks DROP CONSTRAINT IF EXISTS ux_finance_banks_name_country;

-- 2. Por si acaso, borramos también la que intentamos crear antes
ALTER TABLE finance_banks DROP CONSTRAINT IF EXISTS unique_bank_per_tenant;

-- 3. CREAMOS LA NUEVA CON UN NOMBRE TOTALMENTE DIFERENTE
-- Para que Postgres no se confunda con nada anterior
ALTER TABLE finance_banks 
ADD CONSTRAINT agromedic_banks_unique_rule 
UNIQUE (tenant_id, name, country_code);


ALTER TABLE invoice_items ADD COLUMN imei_snapshot VARCHAR(50);


-- 1. Agregamos la columna
ALTER TABLE orders ADD COLUMN order_number INTEGER;

-- 2. Llenamos los pedidos viejos con un número secuencial por empresa
WITH summary AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as ranking
    FROM orders
)
UPDATE orders 
SET order_number = summary.ranking
FROM summary
WHERE orders.id = summary.id;


ALTER TABLE products ADD COLUMN IF NOT EXISTS product_number INTEGER;

-- Esto le asigna un número correlativo a todos los productos que tengan el campo vacío
UPDATE products 
SET product_number = sub.posicion
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as posicion
    FROM products
) AS sub
WHERE products.id = sub.id AND products.product_number IS NULL;





-- 1. Crear la columna
ALTER TABLE supplies ADD COLUMN supply_number INTEGER;

-- 2. Rellenar los insumos actuales con un número correlativo por cliente
UPDATE supplies 
SET supply_number = sub.posicion
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as posicion
    FROM supplies
) AS sub
WHERE supplies.id = sub.id;




ALTER TABLE purchases ADD COLUMN purchase_number INT;


ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;

SELECT id, product_name_snapshot, imei_snapshot 
FROM invoice_items 
WHERE tenant_id = 28 
ORDER BY id DESC LIMIT 5;

ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS order_id INTEGER;


SELECT * FROM public.customer_payments
ORDER BY id ASC 


-- Asigna todos los pagos sin cuenta a la primera cuenta que encuentre del mismo dueño
UPDATE customer_payments 
SET finance_account_id = (SELECT id FROM finance_accounts WHERE tenant_id = customer_payments.tenant_id LIMIT 1)
WHERE finance_account_id IS NULL;

-- Lo mismo para egresos
UPDATE supplier_payments 
SET finance_account_id = (SELECT id FROM finance_accounts WHERE tenant_id = supplier_payments.tenant_id LIMIT 1)
WHERE finance_account_id IS NULL; 

ALTER TABLE finance_accounts DROP CONSTRAINT finance_accounts_type_chk;

ALTER TABLE finance_accounts ADD CONSTRAINT finance_accounts_type_chk 
CHECK (type IN ('BANCO', 'EFECTIVO', 'ZELLE', 'CUENTA_EXTRANJERA', 'INTERCAMBIO'));

INSERT INTO finance_accounts (
    tenant_id, name, currency, is_active, type, notes
) VALUES (
    6, 
    'EQUIPOS POR INTERCAMBIO', 
    'USD', 
    true, 
    'INTERCAMBIO', 
    'Cuenta para equipos recibidos como parte de pago. No afecta el balance de caja física.'
);

SELECT id, name FROM finance_accounts WHERE name = 'EQUIPOS POR INTERCAMBIO' AND tenant_id = 6;


INSERT INTO finance_method_routing (tenant_id, method, account_id, is_active, updated_at)
VALUES (
    6, 
    'EQUIPO_USADO', 
    12, -- Reemplaza este 12 por el ID que obtuviste en el paso 1
    true, 
    NOW()
)
ON CONFLICT (method, tenant_id) 
DO UPDATE SET 
    account_id = EXCLUDED.account_id, 
    updated_at = NOW


	UPDATE customer_payments 
SET finance_account_id = 12 -- El mismo ID de la cuenta de intercambio
WHERE method = 'EQUIPO_USADO' 
  AND tenant_id = 6 
  AND finance_account_id IS NULL;


  -- Movemos los pagos existentes a la cuenta correcta (ID 12)
UPDATE customer_payments 
SET finance_account_id = 12 
WHERE method = 'EQUIPO_USADO' 
  AND tenant_id = 6;

-- Y por si acaso, aseguramos que el ruteo futuro apunte ahí mismo
UPDATE finance_method_routing
SET account_id = 12
WHERE method = 'EQUIPO_USADO' 
  AND tenant_id = 6;


  SELECT * FROM audit_logs 
WHERE module = 'FINANZAS' 
ORDER BY created_at DESC 
LIMIT 10;

