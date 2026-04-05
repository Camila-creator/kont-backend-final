-- =========================================================
-- 0) EXTENSIONES Y TIPOS (ENUMS)
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_account_type') THEN
        CREATE TYPE finance_account_type AS ENUM ('BANCO', 'EFECTIVO', 'ZELLE', 'CUENTA_EXTRANJERA', 'INTERCAMBIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_currency') THEN
        CREATE TYPE finance_currency AS ENUM ('USD', 'VES');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('TRANSFERENCIA', 'PAGO_MOVIL', 'EFECTIVO', 'ZELLE', 'CUENTA_EXTRANJERA', 'EQUIPO_USADO');
    END IF;
END $$;

-- =========================================================
-- 1) CONFIGURACIÓN BASE (PLANES Y TIPOS DE NEGOCIO)
-- =========================================================
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    max_users INTEGER NOT NULL,
    max_branches INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    has_imei BOOLEAN DEFAULT false,
    has_production BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS business_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE,
    has_imei BOOLEAN DEFAULT false,
    has_production BOOLEAN DEFAULT false,
    has_services BOOLEAN DEFAULT false,
    has_tables BOOLEAN DEFAULT false,
    has_marketing_bundle BOOLEAN DEFAULT true
);

-- =========================================================
-- 2) CORE SAAS (TENANTS, USUARIOS Y SUCURSALES)
-- =========================================================
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    plan_type VARCHAR(50) DEFAULT 'LIFETIME',
    start_date DATE DEFAULT CURRENT_DATE,
    next_payment_date DATE,
    rif VARCHAR(20),
    address TEXT,
    phone VARCHAR(20),
    instagram VARCHAR(50),
    logo_url VARCHAR(255),
    plan_id INTEGER REFERENCES plans(id) DEFAULT 1,
    business_type_id INT REFERENCES business_types(id),
    category_id INT REFERENCES business_categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) DEFAULT 'SELLER',
    custom_title VARCHAR(100),
    is_coordinator BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 3) FINANZAS BASE (BANCOS, CUENTAS Y TASAS)
-- =========================================================
CREATE TABLE IF NOT EXISTS finance_banks (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    country_code VARCHAR(8) DEFAULT 'VE',
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT agromedic_banks_unique_rule UNIQUE (tenant_id, name, country_code)
);

CREATE TABLE IF NOT EXISTS finance_accounts (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_id INT REFERENCES finance_banks(id) ON DELETE SET NULL,
    type finance_account_type NOT NULL,
    name VARCHAR(160) NOT NULL,
    currency TEXT DEFAULT 'USD',
    holder_name TEXT,
    account_number TEXT,
    account_ref VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_method_routing (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    account_id INT REFERENCES finance_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_method_per_tenant UNIQUE (method, tenant_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rate_value DECIMAL(12,4) NOT NULL, 
    currency_code TEXT DEFAULT 'USD',
    effective_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================
-- 4) ACTORES (PROVEEDORES Y CLIENTES)
-- =========================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rif TEXT,
    telefono TEXT,
    email TEXT,
    ubicacion TEXT,
    contacto TEXT,
    condiciones_pago TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    doc TEXT,
    type TEXT NOT NULL DEFAULT 'RETAIL',
    phone TEXT,
    email TEXT,
    location TEXT,
    address TEXT,
    terms TEXT DEFAULT 'CONTADO' CHECK (terms IN ('CONTADO','CREDITO')),
    wholesale_min INTEGER DEFAULT 6,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 5) INVENTARIO (CATEGORÍAS, INSUMOS, PRODUCTOS Y RECETAS)
-- =========================================================
CREATE TABLE IF NOT EXISTS supply_categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#f1f5f9',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplies (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES supply_categories(id),
    supply_number INTEGER,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UNIDAD',
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
    has_expiry BOOLEAN NOT NULL DEFAULT false,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_number INTEGER,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'OTRO',
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    unit TEXT NOT NULL DEFAULT 'UNIDAD',
    buy_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    retail_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    mayor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
    has_expiry BOOLEAN NOT NULL DEFAULT false,
    expiry_date DATE,
    is_kit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id BIGINT UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    waste_type TEXT DEFAULT 'PERCENT',
    waste_value NUMERIC(12,3) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    supply_id BIGINT NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
    qty NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'UNIDAD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (recipe_id, supply_id)
);

-- =========================================================
-- 6) PRODUCCIÓN (ELABORACIÓN DE KITS/RECETAS)
-- =========================================================
CREATE TABLE IF NOT EXISTS productions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'DONE',
    notes TEXT,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    production_id BIGINT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty_made INT NOT NULL CHECK (qty_made > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_consumption (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    production_id BIGINT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    supply_id BIGINT NOT NULL REFERENCES supplies(id),
    qty_used NUMERIC(12,3) NOT NULL CHECK (qty_used >= 0),
    unit VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 7) OPERACIONES COMERCIALES (VENTAS Y COMPRAS)
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number INTEGER,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'BORRADOR',
    price_mode TEXT NOT NULL DEFAULT 'AUTO',
    wholesale_threshold INT NOT NULL DEFAULT 6,
    terms TEXT DEFAULT 'CONTADO' CHECK (terms IN ('CONTADO','CREDITO')),
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    exchange_rate NUMERIC(12,4) DEFAULT 1,
    inventory_applied BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    order_date TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_number INT,
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'BORRADOR',
    condition TEXT NOT NULL DEFAULT 'CONTADO',
    invoice_ref TEXT,
    due_date DATE,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    exchange_rate NUMERIC(15,6) DEFAULT 1,
    currency_code VARCHAR(10) DEFAULT 'USD',
    inventory_applied BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    supply_id BIGINT REFERENCES supplies(id) ON DELETE RESTRICT,
    product_id BIGINT REFERENCES products(id) ON DELETE RESTRICT,
    qty NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((supply_id IS NOT NULL AND product_id IS NULL) OR (supply_id IS NULL AND product_id IS NOT NULL))
);

-- =========================================================
-- 8) FACTURACIÓN, IMEI Y TELEFONÍA
-- =========================================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id INT REFERENCES orders(id),
    customer_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'EMITIDA',
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    discount_amount_snapshot DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL,
    customer_name_snapshot VARCHAR(255),
    customer_rif_snapshot VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INT,
    product_name_snapshot VARCHAR(255),
    imei_snapshot VARCHAR(50),
    qty INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS received_phones (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id INT REFERENCES orders(id),
    model_description TEXT,
    credit_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    user_id INT REFERENCES users(id),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS serial_numbers (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    imei VARCHAR(50) NOT NULL,
    product_id INT REFERENCES products(id),
    supply_id INT REFERENCES supplies(id),
    status VARCHAR(20) DEFAULT 'DISPONIBLE',
    origin_received_id INT REFERENCES received_phones(id),
    order_id INTEGER REFERENCES orders(id)
);

-- =========================================================
-- 9) OPERACIONES FINANCIERAS (PAGOS)
-- =========================================================
CREATE TABLE IF NOT EXISTS customer_payments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    finance_account_id INTEGER REFERENCES finance_accounts(id),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_native NUMERIC(12,2),
    exchange_rate NUMERIC(12,4) DEFAULT 1,
    currency TEXT DEFAULT 'USD',
    method TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
    ref TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_id BIGINT REFERENCES purchases(id) ON DELETE SET NULL,
    finance_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_native NUMERIC(12,2),
    exchange_rate NUMERIC(15,6) DEFAULT 1,
    currency_code VARCHAR(10) DEFAULT 'USD',
    currency TEXT DEFAULT 'USD',
    method TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
    ref TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 10) EL GRAN MÓDULO DE MARKETING
-- =========================================================
CREATE TABLE IF NOT EXISTS mkt_roles (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS mkt_tasks (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS mkt_brand_assets (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('logo','color','tipografia','filosofia','estrategia','empaque')),
    nombre VARCHAR(100) NOT NULL,
    valor VARCHAR(255),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_buyer_personas (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    data_real JSONB DEFAULT '{}', 
    data_ideal JSONB DEFAULT '{}',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_calendario (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo_interno VARCHAR(150) NOT NULL,
    fecha_publicacion TIMESTAMP NOT NULL,
    plataforma VARCHAR(50) NOT NULL CHECK (plataforma IN ('instagram','facebook','tiktok','linkedin','twitter','blog')),
    tipo_contenido VARCHAR(50) NOT NULL CHECK (tipo_contenido IN ('reel','story','post','carrusel','articulo')),
    estado VARCHAR(50) DEFAULT 'borrador' CHECK (estado IN ('borrador','revision','aprobado','publicado')),
    copy_caption TEXT,
    media_url VARCHAR(255),
    responsable_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_editorial_posts (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    plataforma VARCHAR(50) NOT NULL,
    fecha_publicacion DATE NOT NULL,
    hora_publicacion TIME NOT NULL,
    estado VARCHAR(50) DEFAULT 'Borrador',
    anuncio BOOLEAN DEFAULT FALSE,
    copy_text TEXT,
    link_multimedia VARCHAR(500),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_ads_audiences (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    edad VARCHAR(50),
    genero VARCHAR(50),
    ubicacion TEXT,
    intereses TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_ads_campaigns (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES mkt_editorial_posts(id),
    nombre_campana VARCHAR(255) NOT NULL,
    plataforma_origen VARCHAR(50),
    ubicacion_red VARCHAR(100),
    publico_edad VARCHAR(50),
    publico_genero VARCHAR(50),
    publico_ubicacion TEXT,
    publico_intereses TEXT,
    presupuesto_diario NUMERIC(10,2),
    fecha_inicio DATE,
    fecha_fin DATE,
    es_continuo BOOLEAN DEFAULT FALSE,
    estado VARCHAR(50) DEFAULT 'Activa',
    resultados JSONB DEFAULT '{}',
    eval_manual VARCHAR(50), 
    eval_sistema VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_ads_ejecucion (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campana_id INT NOT NULL REFERENCES mkt_ads_campaigns(id) ON DELETE CASCADE,
    nombre_anuncio VARCHAR(150),
    origen_creativo VARCHAR(50) NOT NULL CHECK (origen_creativo IN ('boost_organico', 'dark_post')),
    post_organico_id INT REFERENCES mkt_calendario(id) ON DELETE SET NULL,
    media_externo_url VARCHAR(255),
    inversion_gastada DECIMAL(10,2) DEFAULT 0.00,
    impresiones INT DEFAULT 0,
    clics INT DEFAULT 0,
    conversiones INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mkt_offline_activities (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Planeado',
    ubicacion VARCHAR(255),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    objetivo TEXT,
    presupuesto NUMERIC(10,2) DEFAULT 0.00,
    gasto_real NUMERIC(10,2) DEFAULT 0.00,
    resultados TEXT,
    proveedor VARCHAR(200),
    contacto VARCHAR(150),
    drive_link VARCHAR(255),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_offline (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('valla','radio','tv','evento','impresos','merch')),
    proveedor_id INT,
    ubicacion_detalles VARCHAR(255),
    fecha_inicio DATE,
    fecha_fin DATE,
    costo_inversion DECIMAL(10,2) NOT NULL,
    evidencia_url VARCHAR(255),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_circulacion','finalizado')),
    observaciones TEXT
);

CREATE TABLE IF NOT EXISTS mkt_influencers (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    handle VARCHAR(100) NOT NULL,
    plataforma VARCHAR(50),
    nicho VARCHAR(100),
    seguidores INTEGER DEFAULT 0,
    estatus VARCHAR(50) DEFAULT 'En Negociación',
    telefono VARCHAR(50),
    link_perfil VARCHAR(255),
    tipo_contrato VARCHAR(50),
    fecha_inicio DATE,
    fecha_fin DATE,
    cuota TEXT,
    modalidad_pago VARCHAR(50),
    inversion NUMERIC(10,2) DEFAULT 0.00,
    num_pendientes INTEGER DEFAULT 0,
    pendientes_texto TEXT,
    notas_resultados TEXT,
    leads INTEGER DEFAULT 0,
    evaluacion VARCHAR(50) DEFAULT 'Pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_influencer_acuerdos (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    influencer_id INT NOT NULL REFERENCES mkt_influencers(id) ON DELETE CASCADE,
    fecha_acuerdo DATE,
    costo_pago DECIMAL(10,2) NOT NULL,
    tipo_intercambio VARCHAR(50) NOT NULL CHECK (tipo_intercambio IN ('dinero','canje','mixto')),
    entregables_pactados TEXT,
    cumplio_fecha BOOLEAN DEFAULT FALSE,
    alcance_logrado INT DEFAULT 0,
    clicks_logrados INT DEFAULT 0,
    evidencia_metricas_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS mkt_media_assets (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(150),
    ruta_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL CHECK (tipo_archivo IN ('imagen','video','documento','editable')),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('campana','producto','institucional','evento')),
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_solicitudes (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    departamento_solicitante VARCHAR(50) NOT NULL CHECK (departamento_solicitante IN ('ventas','rrhh','gerencia','operaciones')),
    titulo_solicitud VARCHAR(150),
    descripcion TEXT,
    fecha_tope DATE,
    prioridad VARCHAR(50) DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','urgente')),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','entregado')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_cm_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    periodo VARCHAR(50),
    seguidores VARCHAR(50),
    engagement NUMERIC(5,2),
    clics INTEGER,
    pregunta_frecuente TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_monthly_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    periodo VARCHAR(20) NOT NULL,
    nuevos_seguidores INTEGER DEFAULT 0,
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

-- =========================================================
-- 11) SISTEMA DE SOPORTE Y AUDITORÍA
-- =========================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'BAJA',
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    action VARCHAR(50),
    module VARCHAR(100),
    description TEXT,
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 12) SEGURIDAD SAAS - BÚNKER RLS 
-- (Ejecutamos el mismo loop que tenías al final)
-- =========================================================
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
        
        -- Forzamos RLS para que ni el admin se salte la regla
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);

        -- Limpiamos políticas previas
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', r.table_name);

        -- Creamos la política vinculando la función (si existe) o usando el current_setting
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I 
                        USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', TRUE), '''')::INTEGER)
                        WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', TRUE), '''')::INTEGER)', r.table_name);
        
        RAISE NOTICE 'Búnker activado en tabla: %', r.table_name;
    END LOOP; 
END $$;


-- 1. Aseguramos que existan los datos maestros
INSERT INTO plans (id, name, max_users, max_branches) VALUES (1, 'Plan Maestro', 999, 999) ON CONFLICT DO NOTHING;
INSERT INTO business_categories (id, name) VALUES (1, 'Tecnología') ON CONFLICT DO NOTHING;

-- 2. Limpiamos y recreamos el Tenant 1 (La Empresa)
-- IMPORTANTE: Le asignamos la categoría 1 para que el JOIN no falle
INSERT INTO tenants (id, name, is_active, plan_id, category_id) 
VALUES (1, 'Kont Core', true, 1, 1) 
ON CONFLICT (id) DO UPDATE SET is_active = true, category_id = 1;

-- 3. Limpiamos y recreamos tu usuario
DELETE FROM users WHERE email = 'admin_camila@gmail.com';

INSERT INTO users (
    tenant_id, 
    branch_id, 
    name, 
    email, 
    password_hash, 
    role, 
    is_active
) VALUES (
    1, 
    NULL, -- No hace falta sucursal para el super admin inicial
    'Camila', 
    'admin_camila@gmail.com', 
    '$2a$10$8K1p/a06HbEqIsV4.mS6xeZ2NCAW8UvFm9y.8qK.gM7Z9vA7H5/Y6', -- Clave: admin123
    'SUPER_ADMIN', 
    true
);

-- 1. Apagamos la seguridad RLS para que el login pueda leer los datos
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- 2. Creamos la categoría y el tenant (Empresa) correctamente
INSERT INTO business_categories (id, name) VALUES (1, 'Tecnología') ON CONFLICT DO NOTHING;
INSERT INTO tenants (id, name, is_active, category_id) 
VALUES (1, 'Kont Core', true, 1) 
ON CONFLICT (id) DO UPDATE SET is_active = true, category_id = 1;

-- 3. Reseteamos tu usuario con una clave fácil: admin123
DELETE FROM users WHERE email = 'admin_camila@gmail.com';
INSERT INTO users (tenant_id, name, email, password_hash, role, is_active) 
VALUES (1, 'Camila', 'admin_camila@gmail.com', 
        '$2a$10$8K1p/a06HbEqIsV4.mS6xeZ2NCAW8UvFm9y.8qK.gM7Z9vA7H5/Y6', -- Hash de admin123
        'SUPER_ADMIN', true);

        -- Forzamos el reset del hash para asegurar que no haya errores de copiado
UPDATE users 
SET password_hash = '$2a$10$8K1p/a06HbEqIsV4.mS6xeZ2NCAW8UvFm9y.8qK.gM7Z9vA7H5/Y6'
WHERE email = 'admin_camila@gmail.com';

-- Esto sincroniza el contador de IDs con lo que ya tienes en las tablas
SELECT setval(pg_get_serial_sequence('tenants', 'id'), coalesce(max(id), 0) + 1, false) FROM tenants;
SELECT setval(pg_get_serial_sequence('branches', 'id'), coalesce(max(id), 0) + 1, false) FROM branches;


-- =========================================================
-- 1) ACTUALIZACIÓN DE ESTRUCTURA (COLUMNAS)
-- =========================================================
ALTER TABLE business_categories 
ADD COLUMN IF NOT EXISTS has_cereals BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_imei BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_production BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_services BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_tables BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_marketing_bundle BOOLEAN DEFAULT true;

-- =========================================================
-- 2) LIMPIEZA E INSERCIÓN DE TUS CATEGORÍAS REALES
-- =========================================================
-- (Usamos TRUNCATE para reiniciar la tabla y que los IDs empiecen desde 1)
TRUNCATE TABLE business_categories RESTART IDENTITY CASCADE;

INSERT INTO business_categories 
(name, has_cereals, has_imei, has_production, has_services, has_tables, has_marketing_bundle)
VALUES 
('Tienda de Teléfonos',         false,     true,  false,        true,      false,  true),
('Tienda de Ropa o Maquillaje', false,     false, false,        false,     false,  true),
('Taller Mecánico',             false,     false, false,        true,      false,  true),
('Empresa Productora',          true,      false, true,         false,     false,  true),
('Restaurante',                 false,     false, true,         false,     true,   true),
('Agencia de Marketing',        false,     false, false,        true,      false,  true);

-- =========================================================
-- 3) RE-VINCULACIÓN DE TU USUARIO (PARA QUE PUEDAS ENTRAR)
-- =========================================================
-- Aseguramos que exista al menos un Tenant (empresa) vinculado a la primera categoría
INSERT INTO tenants (id, name, plan_id, category_id) 
VALUES (1, 'Mi Empresa Principal', 1, 1) 
ON CONFLICT (id) DO UPDATE SET category_id = 1;

-- Aseguramos que tu usuario apunte a esa empresa y tenga la clave reseteada
UPDATE users 
SET tenant_id = 1, 
    role = 'SUPER_ADMIN',
    password_hash = '$2a$10$8K1p/a06HbEqIsV4.mS6xeZ2NCAW8UvFm9y.8qK.gM7Z9vA7H5/Y6' 
WHERE email = 'admin_camila@gmail.com';

-- =========================================================
-- 4) VERIFICACIÓN FINAL
-- =========================================================
SELECT * FROM business_categories;

-- 1. ASEGURAMOS QUE LAS COLUMNAS EXISTAN (Sin borrar datos)
ALTER TABLE business_categories 
ADD COLUMN IF NOT EXISTS has_cereals BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_imei BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_production BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_services BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_tables BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_marketing_bundle BOOLEAN DEFAULT true;

-- El vínculo de los planes con las empresas
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id) DEFAULT 1;

-- 2. REINICIAMOS PLANES Y CATEGORÍAS (Para que queden idénticos a tu diseño)
TRUNCATE TABLE plans RESTART IDENTITY CASCADE;
TRUNCATE TABLE business_categories RESTART IDENTITY CASCADE;

-- Insertamos tus 3 niveles reales
INSERT INTO plans (name, max_users, max_branches, description) VALUES  
('BASICO', 7, 1, 'Plan Emprendedor - 1 Sede y hasta 7 usuarios'),
('STANDARD', 20, 3, 'Plan Negocio - Hasta 3 Sedes y 20 usuarios'),
('PREMIUM', 999, 999, 'Plan Corporativo - Sedes y Usuarios Ilimitados');

-- Insertamos tus categorías reales (de la captura)
INSERT INTO business_categories 
(name, has_cereals, has_imei, has_production, has_services, has_tables, has_marketing_bundle)
VALUES 
('Tienda de Teléfonos',         false,     true,  false,        true,      false,  true),
('Tienda de Ropa o Maquillaje', false,     false, false,        false,     false,  true),
('Taller Mecánico',             false,     false, false,        true,      false,  true),
('Empresa Productora',          true,      false, true,         false,     false,  true),
('Restaurante',                 false,     false, true,         false,     true,   true),
('Agencia de Marketing',        false,     false, false,        true,      false,  true);

-- 3. RESET DE ACCESO (Para que entres SI O SI)
-- Creamos o actualizamos tu empresa de prueba vinculada al Plan 1 y Categoría 1
INSERT INTO tenants (id, name, plan_id, category_id, is_active) 
VALUES (1, 'Kont Admin', 1, 1, true) 
ON CONFLICT (id) DO UPDATE SET plan_id = 1, category_id = 1;

INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
VALUES (
    1, 
    'Camila Oquendo', 
    'admin_camila@gmail.com', 
    '$2a$10$8K1p/a06HbEqIsV4.mS6xeZ2NCAW8UvFm9y.8qK.gM7Z9vA7H5/Y6', -- admin123
    'SUPER_ADMIN', 
    true
)
ON CONFLICT (email) 
DO UPDATE SET 
    tenant_id = EXCLUDED.tenant_id,
    role = 'SUPER_ADMIN',
    password_hash = EXCLUDED.password_hash,
    is_active = true;

-- 4. APAGAR EL "BÚNKER" TEMPORALMENTE (Evita que el RLS te bloquee el login)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_categories DISABLE ROW LEVEL SECURITY;

-- Verificación final
SELECT * FROM plans;
SELECT * FROM business_categories;

-- Esto le dice a la tabla tenants: "El 1 ya está ocupado, empieza a contar desde el 2"
SELECT setval(pg_get_serial_sequence('tenants', 'id'), (SELECT MAX(id) FROM tenants));

CREATE TABLE cash_register_closures (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    closed_by INTEGER REFERENCES users(id),
    closure_date DATE NOT NULL,
    expected_amount DECIMAL(10,2) NOT NULL,
    actual_amount DECIMAL(10,2) NOT NULL,
    difference DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, closure_date) -- Evita que se cierre el mismo día dos veces
);

DROP TABLE IF EXISTS cash_register_closures;

CREATE TABLE cash_register_closures (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    closed_by INTEGER REFERENCES users(id),
    closure_date DATE NOT NULL,
    opening_balance DECIMAL(10,2) DEFAULT 0.00,
    expected_amount DECIMAL(10,2) NOT NULL,
    actual_amount DECIMAL(10,2) NOT NULL,
    difference DECIMAL(10,2) NOT NULL,
    exchange_rate DECIMAL(10,2) NOT NULL, -- Importante para Venezuela
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, closure_date)
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'STOCK_PRODUCTO', 'STOCK_INSUMO', 'PAGO_CLIENTE', 'PAGO_PROVEEDOR', 'EQUIPO_PENDIENTE'
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT,
    prioridad VARCHAR(20) DEFAULT 'MEDIA', -- 'ALTA', 'MEDIA', 'BAJA'
    status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING', 'RESOLVED'
    referencia_id INTEGER,                 -- ID del producto, compra o pago relacionado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER                    -- ID del usuario que la marcó como leída
);

-- Índice para que la campana cargue rápido
CREATE INDEX idx_alerts_tenant_status ON alerts(tenant_id, status);



CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL, -- Para el multi-tenant
    category VARCHAR(20) NOT NULL, -- 'FIXED' o 'SPORADIC'
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    
    -- Relaciones opcionales
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    finance_account_id INTEGER REFERENCES finance_accounts(id) ON DELETE SET NULL,
    
    -- Para gastos esporádicos (donde no creas un proveedor formal)
    purchase_place VARCHAR(255), 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER -- ID del usuario que registró
);

ALTER TABLE expenses 
ADD COLUMN currency VARCHAR(5) DEFAULT 'USD',
ADD COLUMN exchange_rate DECIMAL(12, 4) DEFAULT 1.0000;

ALTER TABLE users ENABLE ROW LEVEL SECURITY; -- Por si no estaba activo

CREATE POLICY "login_policy_users" 
ON users 
FOR SELECT 
USING (true);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY; -- Por si no estaba activo

CREATE POLICY "login_policy_tenants" 
ON tenants 
FOR SELECT 
USING (true);

-- 1. Normalizamos los nombres de los roles para que coincidan con el nuevo código
UPDATE users 
SET role = 'ADMIN' 
WHERE role = 'ADMIN_BRAND';

UPDATE users 
SET role = 'SELLER' 
WHERE role = 'SALES';

UPDATE users 
SET role = 'WAREHOUSE' 
WHERE role = 'INVENTORY';

-- 2. Verificamos que todo esté bien (Opcional, solo para tu paz mental)
SELECT email, role FROM users;

-- Instala la extensión pgcrypto si no la tienes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Actualiza tu contraseña a: Kont2024!
UPDATE users
SET password_hash = crypt('Kont2024!', gen_salt('bf', 10))
WHERE email = 'admin_camila@gmail.com';

-- Confirma
SELECT name, email, role, is_active FROM users WHERE email = 'admin_camila@gmail.com';

ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;


-- =========================================================
-- KONT — SQL de actualización para nuevas funcionalidades
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Columnas faltantes en invoices (snapshots del tenant para documentos)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tenant_name_snapshot    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tenant_rif_snapshot     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tenant_address_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS tenant_phone_snapshot   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discount_amount_snapshot DECIMAL(10,2) DEFAULT 0.00;

-- 2. logo_url en tenants (para mostrarlo en facturas/garantías)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- 3. is_active en branches (para poder desactivar sedes)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. order_id en serial_numbers (para saber en qué pedido se vendió cada IMEI)
--    Ya debería existir según el schema, pero por si acaso:
ALTER TABLE serial_numbers
  ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);

-- 5. Índices de rendimiento para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_order   ON invoices(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_order    ON serial_numbers(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branches_tenant_active  ON branches(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_tenant   ON exchange_rates(tenant_id, effective_date DESC);

-- 6. RLS para branches (si no existe ya)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON branches;
CREATE POLICY tenant_isolation_policy ON branches
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER);

-- Verificación final
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;

-- =====================================================================
-- KONT — Nómina Venezolana + Conciliación Bancaria
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- MÓDULO 1: NÓMINA
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id     INT REFERENCES branches(id) ON DELETE SET NULL,
  -- Datos personales
  name          VARCHAR(150) NOT NULL,
  id_number     VARCHAR(20)  NOT NULL,       -- Cédula: V-12345678
  position      VARCHAR(100),                -- Cargo
  department    VARCHAR(100),                -- Departamento / área
  -- Contrato
  hire_date     DATE NOT NULL,
  contract_type VARCHAR(30) DEFAULT 'INDEFINIDO', -- INDEFINIDO, DETERMINADO, OBRA
  -- Salario
  base_salary        NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_currency    VARCHAR(5)    DEFAULT 'USD',  -- USD o VES
  food_bonus         NUMERIC(12,2) DEFAULT 0,      -- Cesta ticket fijo
  transport_bonus    NUMERIC(12,2) DEFAULT 0,      -- Bono transporte fijo
  -- Estado
  is_active     BOOLEAN DEFAULT true,
  phone         VARCHAR(30),
  email         VARCHAR(100),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_label  VARCHAR(30) NOT NULL,        -- 'ENE-2026', 'FEB-2026'
  period_type   VARCHAR(20) DEFAULT 'MENSUAL', -- MENSUAL, QUINCENAL
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  exchange_rate NUMERIC(12,4) DEFAULT 1,    -- Tasa Bs/USD para los cálculos
  status        VARCHAR(20) DEFAULT 'BORRADOR', -- BORRADOR, CERRADO
  notes         TEXT,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id           INT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id         INT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  -- Asignaciones
  base_salary         NUMERIC(12,2) DEFAULT 0,
  food_bonus          NUMERIC(12,2) DEFAULT 0,
  transport_bonus     NUMERIC(12,2) DEFAULT 0,
  overtime_hours      NUMERIC(6,2)  DEFAULT 0,
  overtime_amount     NUMERIC(12,2) DEFAULT 0,
  bonuses             NUMERIC(12,2) DEFAULT 0,
  other_income        NUMERIC(12,2) DEFAULT 0,
  gross_salary        NUMERIC(12,2) DEFAULT 0,  -- Calculado: suma de asignaciones
  -- Deducciones (en USD)
  sso_deduction       NUMERIC(12,2) DEFAULT 0,  -- 4% sueldo normal
  inces_deduction     NUMERIC(12,2) DEFAULT 0,  -- 0.5% sueldo total
  faov_deduction      NUMERIC(12,2) DEFAULT 0,  -- 1% sueldo integral
  loan_deduction      NUMERIC(12,2) DEFAULT 0,  -- Préstamo interno
  advance_deduction   NUMERIC(12,2) DEFAULT 0,  -- Anticipo de quincena
  other_deductions    NUMERIC(12,2) DEFAULT 0,
  total_deductions    NUMERIC(12,2) DEFAULT 0,  -- Calculado
  -- Neto
  net_salary          NUMERIC(12,2) DEFAULT 0,  -- gross - total_deductions
  -- Para reporte en Bs
  net_salary_bs       NUMERIC(14,2) DEFAULT 0,  -- net_salary * exchange_rate
  notes               TEXT,
  UNIQUE (period_id, employee_id)
);

-- Índices nómina
CREATE INDEX IF NOT EXISTS idx_employees_tenant       ON employees(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_tenant ON payroll_periods(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_items_period   ON payroll_items(period_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id, tenant_id);

-- RLS nómina
ALTER TABLE employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON employees;
DROP POLICY IF EXISTS tenant_isolation_policy ON payroll_periods;
DROP POLICY IF EXISTS tenant_isolation_policy ON payroll_items;

CREATE POLICY tenant_isolation_policy ON employees
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

CREATE POLICY tenant_isolation_policy ON payroll_periods
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

CREATE POLICY tenant_isolation_policy ON payroll_items
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

-- ─────────────────────────────────────────────────────────────────────
-- MÓDULO 2: CONCILIACIÓN BANCARIA
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finance_account_id  INT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  period_label        VARCHAR(40),           -- 'ENE 2026', 'Mar 2026'
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  opening_balance     NUMERIC(12,2) DEFAULT 0,
  closing_balance     NUMERIC(12,2) DEFAULT 0,
  status              VARCHAR(20) DEFAULT 'EN_PROCESO', -- EN_PROCESO, CERRADO
  notes               TEXT,
  created_by          INT REFERENCES users(id) ON DELETE SET NULL,
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reconciliation_id     INT  NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  -- Datos del extracto del banco
  line_date             DATE NOT NULL,
  description           TEXT,
  reference             VARCHAR(120),
  amount                NUMERIC(12,2) NOT NULL, -- positivo=crédito, negativo=débito
  -- Matching con sistema Kont
  match_status          VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, CONCILIADO, IGNORADO
  matched_payment_id    BIGINT,
  matched_payment_type  VARCHAR(20), -- 'customer_payment','supplier_payment','expense','manual'
  match_confidence      INT DEFAULT 0,  -- 0-100
  matched_by_user       INT REFERENCES users(id) ON DELETE SET NULL,
  matched_at            TIMESTAMPTZ,
  manual_note           TEXT,          -- Nota si se marca como ignorado o manual
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Índices conciliación
CREATE INDEX IF NOT EXISTS idx_reconciliations_tenant   ON bank_reconciliations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reconciliations_account  ON bank_reconciliations(finance_account_id);
CREATE INDEX IF NOT EXISTS idx_stmt_lines_reconciliation ON bank_statement_lines(reconciliation_id, match_status);
CREATE INDEX IF NOT EXISTS idx_stmt_lines_tenant        ON bank_statement_lines(tenant_id, match_status);

-- RLS conciliación
ALTER TABLE bank_reconciliations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_lines  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON bank_reconciliations;
DROP POLICY IF EXISTS tenant_isolation_policy ON bank_statement_lines;

CREATE POLICY tenant_isolation_policy ON bank_reconciliations
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

CREATE POLICY tenant_isolation_policy ON bank_statement_lines
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

-- Verificación final
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('employees','payroll_periods','payroll_items',
                     'bank_reconciliations','bank_statement_lines');


-- =====================================================================
-- KONT — Devoluciones / Notas de Crédito + Fix conciliación
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- TABLA DE DEVOLUCIONES
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  note_number     VARCHAR(30),                     -- NC-2026-000001
  reason          TEXT NOT NULL,                   -- Motivo de la devolución
  type            VARCHAR(20) DEFAULT 'TOTAL',     -- TOTAL | PARCIAL
  status          VARCHAR(20) DEFAULT 'EMITIDA',   -- EMITIDA | APLICADA | ANULADA
  subtotal        NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) DEFAULT 0,
  inventory_reversed BOOLEAN DEFAULT false,        -- ¿ya se revirtió el stock?
  -- Snapshots del cliente y empresa al momento de emisión
  customer_name_snapshot VARCHAR(255),
  tenant_name_snapshot   VARCHAR(255),
  notes           TEXT,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Items devueltos de la nota de crédito
CREATE TABLE IF NOT EXISTS credit_note_items (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credit_note_id  INT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  order_item_id   BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot VARCHAR(255),
  qty             NUMERIC(12,3) NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  total           NUMERIC(12,2) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant  ON credit_notes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_order   ON credit_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_cn_items_note        ON credit_note_items(credit_note_id, tenant_id);

-- RLS
ALTER TABLE credit_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON credit_notes;
DROP POLICY IF EXISTS tenant_isolation_policy ON credit_note_items;

CREATE POLICY tenant_isolation_policy ON credit_notes
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

CREATE POLICY tenant_isolation_policy ON credit_note_items
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id',TRUE),'')::INT);

-- ─────────────────────────────────────────────────────────────────────
-- FIX CONCILIACIÓN: endpoint revert (reversar match a PENDIENTE)
-- (Solo SQL de soporte — la lógica está en el model)
-- ─────────────────────────────────────────────────────────────────────
-- Agregar índice para acelerar reversos frecuentes
CREATE INDEX IF NOT EXISTS idx_stmt_lines_status
  ON bank_statement_lines(reconciliation_id, match_status);

-- Verificación
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('credit_notes','credit_note_items');
