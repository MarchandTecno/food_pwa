-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "core"."audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "user_id" UUID,
    "accion" VARCHAR(20) NOT NULL,
    "tabla_afectada" VARCHAR(50) NOT NULL,
    "registro_id" UUID,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."cash_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID,
    "type" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "concept" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."cash_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "branch_id" UUID,
    "user_id" UUID,
    "opening_time" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "closing_time" TIMESTAMPTZ(6),
    "cash_initial" DECIMAL(12,2) DEFAULT 0.00,
    "cash_sales_expected" DECIMAL(12,2) DEFAULT 0.00,
    "cash_final_reported" DECIMAL(12,2),
    "status" VARCHAR(20) DEFAULT 'OPEN',

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."coupons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "codigo" VARCHAR(20) NOT NULL,
    "descripcion" TEXT,
    "tipo_descuento" VARCHAR(20) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6),
    "fecha_fin" TIMESTAMPTZ(6),
    "limite_usos" INTEGER,
    "usos_actuales" INTEGER DEFAULT 0,
    "minimo_compra" DECIMAL(12,2) DEFAULT 0.00,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."notification_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID,
    "type" VARCHAR(20),
    "recipient" VARCHAR(100),
    "status" VARCHAR(20),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."order_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID,
    "payment_method_id" INTEGER,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia_externa" VARCHAR(100),
    "comprobante_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."tax_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "nombre" VARCHAR(50) NOT NULL,
    "tasa" DECIMAL(5,4) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "nombre_sucursal" VARCHAR(100) NOT NULL,
    "direccion_fisica" TEXT,
    "horario_apertura" TIME(6),
    "horario_cierre" TIME(6),
    "is_open" BOOLEAN DEFAULT true,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID,
    "type" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "concept" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "branch_id" UUID,
    "user_id" UUID,
    "opening_time" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "closing_time" TIMESTAMPTZ(6),
    "cash_initial" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "cash_sales_expected" DECIMAL(12,2) DEFAULT 0.00,
    "cash_final_reported" DECIMAL(12,2),
    "cash_difference" DECIMAL(12,2),
    "card_sales_expected" DECIMAL(12,2) DEFAULT 0.00,
    "transfer_sales_expected" DECIMAL(12,2) DEFAULT 0.00,
    "status" VARCHAR(20) DEFAULT 'OPEN',
    "notes" TEXT,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,
    "orden_visual" INTEGER,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_addresses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_id" UUID,
    "etiqueta" VARCHAR(50) DEFAULT 'Casa',
    "calle_avenida" VARCHAR(150),
    "num_exterior" VARCHAR(20),
    "num_interior_depto" VARCHAR(20),
    "torre_edificio" VARCHAR(50),
    "referencias" TEXT,
    "codigo_postal" VARCHAR(10),
    "is_default" BOOLEAN DEFAULT false,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100),
    "whatsapp" VARCHAR(20),
    "email" VARCHAR(100),
    "puntos_lealtad" INTEGER DEFAULT 0,
    "notas_preferencias" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "stock_actual" DECIMAL(12,2) DEFAULT 0.00,
    "stock_minimo" DECIMAL(12,2) DEFAULT 0.00,
    "costo_unitario_promedio" DECIMAL(12,2) DEFAULT 0.00,
    "last_restock" TIMESTAMP(6),
    "categoria_insumo" VARCHAR(50),

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_adjustments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ingredient_id" UUID,
    "user_id" UUID,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "motivo" VARCHAR(255),
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID,
    "product_id" UUID,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario_snapshot" DECIMAL(12,2) NOT NULL,
    "subtotal_item" DECIMAL(12,2) NOT NULL,
    "tasa_iva" DECIMAL(5,2) DEFAULT 16.00,
    "notas_item" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_id" UUID,
    "status_anterior" VARCHAR(30),
    "status_nuevo" VARCHAR(30),
    "user_id" UUID,
    "changed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "branch_id" UUID,
    "user_id" UUID,
    "customer_name" VARCHAR(150),
    "customer_whatsapp" VARCHAR(20),
    "folio_numero" SERIAL NOT NULL,
    "status" VARCHAR(30) DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "impuestos_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "descuento_total" DECIMAL(12,2) DEFAULT 0.00,
    "total_neto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payment_method_id" INTEGER,
    "payment_status" VARCHAR(30) DEFAULT 'UNPAID',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "nota_especial" TEXT,
    "customer_id" UUID,
    "address_id" UUID,
    "cash_session_id" UUID,
    "coupon_id" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_methods" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "precio_venta" DECIMAL(12,2) NOT NULL,
    "imagen_url" TEXT,
    "is_available" BOOLEAN DEFAULT true,
    "aplica_inventario" BOOLEAN DEFAULT true,
    "tax_rule_id" UUID,
    "available_hours" JSONB,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID,
    "ingredient_id" UUID,
    "cantidad_requerida" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" SERIAL NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre_comercial" VARCHAR(100) NOT NULL,
    "razon_social" VARCHAR(150),
    "rfc_tax_id" VARCHAR(20),
    "logo_url" TEXT,
    "moneda" VARCHAR(5) DEFAULT 'MXN',
    "telefono_contacto" VARCHAR(20),
    "email_admin" VARCHAR(100) NOT NULL,
    "config_whatsapp_msg" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "branch_id" UUID,
    "rol_id" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "last_login" TIMESTAMP(6),
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenant_id_codigo_key" ON "core"."coupons"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "public"."categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_whatsapp_key" ON "public"."customers"("whatsapp");

-- CreateIndex
CREATE INDEX "orders_tenant_id_branch_id_status_idx" ON "public"."orders"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "orders_tenant_id_branch_id_created_at_idx" ON "public"."orders"("tenant_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_branch_id_customer_name_idx" ON "public"."orders"("tenant_id", "branch_id", "customer_name");

-- CreateIndex
CREATE INDEX "orders_tenant_id_branch_id_total_neto_idx" ON "public"."orders"("tenant_id", "branch_id", "total_neto");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_nombre_key" ON "public"."payment_methods"("nombre");

-- CreateIndex
CREATE INDEX "products_is_available_nombre_idx" ON "public"."products"("is_available", "nombre");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "public"."products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_rol_key" ON "public"."roles"("nombre_rol");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_admin_key" ON "public"."tenants"("email_admin");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- AddForeignKey
ALTER TABLE "core"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."cash_movements" ADD CONSTRAINT "cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "core"."cash_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."cash_sessions" ADD CONSTRAINT "cash_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."notification_logs" ADD CONSTRAINT "notification_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."order_payments" ADD CONSTRAINT "order_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."tax_rules" ADD CONSTRAINT "tax_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."customer_addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "core"."coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "core"."tax_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recipes" ADD CONSTRAINT "recipes_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recipes" ADD CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
