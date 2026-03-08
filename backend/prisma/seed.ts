import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...');
  const defaultPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

  // Limpiar datos existentes (solo desarrollo)
  // await prisma.order.deleteMany({});
  // await prisma.product.deleteMany({});
  // await prisma.ingredient.deleteMany({});
  // await prisma.user.deleteMany({});
  // await prisma.tenant.deleteMany({});

  // ============================================================================
  // 1. CREAR TENANT
  // ============================================================================
  const tenant = await prisma.tenants.upsert({
    where: { email_admin: 'admin@hotdogs.com' },
    update: {},
    create: {
      nombre_comercial: 'Hot Dogs Don Carlo',
      razon_social: 'Comercial Don Carlo S.A. de C.V.',
      rfc_tax_id: 'CDC000101ABC',
      email_admin: 'admin@hotdogs.com',
      telefono_contacto: '+52 55 1234 5678',
      moneda: 'MXN',
      logo_url: 'https://example.com/logo.png',
      config_whatsapp_msg: 'Hola, tu pedido está listo para recoger',
      is_active: true,
    },
  });

  console.log('✅ Tenant creado:', tenant.nombre_comercial);

  // ============================================================================
  // 2. CREAR BRANCH (SUCURSAL)
  // ============================================================================
  const branch = await prisma.branches.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenant_id: tenant.id,
      nombre_sucursal: 'Centro',
      direccion_fisica: 'Calle Principal 123, Ciudad',
      horario_apertura: new Date('2024-01-01 10:00:00'),
      horario_cierre: new Date('2024-01-01 22:00:00'),
      is_open: true,
    },
  });

  console.log('✅ Branch creada:', branch.nombre_sucursal);

  // ============================================================================
  // 3. CREAR ROLES
  // ============================================================================
  const roles = await Promise.all([
    prisma.roles.upsert({
      where: { id: 99 },
      update: {},
      create: { id: 99, nombre_rol: 'SuperAdmin' },
    }),
    prisma.roles.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, nombre_rol: 'Dueño' },
    }),
    prisma.roles.upsert({
      where: { id: 2 },
      update: {},
      create: { id: 2, nombre_rol: 'Cocina' },
    }),
    prisma.roles.upsert({
      where: { id: 3 },
      update: {},
      create: { id: 3, nombre_rol: 'Repartidor' },
    }),
  ]);

  console.log('✅ Roles creados:', roles.length);

  // ============================================================================
  // 4. CREAR USUARIOS
  // ============================================================================
  const users = await Promise.all([
    prisma.users.upsert({
      where: { email: 'superadmin@foodflow.local' },
      update: {
        tenant_id: null,
        branch_id: null,
        rol_id: 99,
        is_active: true,
      },
      create: {
        tenant_id: null,
        branch_id: null,
        rol_id: 99,
        nombre: 'FoodFlow SuperAdmin',
        email: 'superadmin@foodflow.local',
        password_hash: defaultPasswordHash,
        is_active: true,
      },
    }),
    prisma.users.upsert({
      where: { email: 'owner@hotdogs.com' },
      update: {},
      create: {
        tenant_id: tenant.id,
        branch_id: branch.id,
        rol_id: 1, // Dueño
        nombre: 'Carlos García',
        email: 'owner@hotdogs.com',
        password_hash: defaultPasswordHash,
        is_active: true,
      },
    }),
    prisma.users.upsert({
      where: { email: 'kitchen@hotdogs.com' },
      update: {},
      create: {
        tenant_id: tenant.id,
        branch_id: branch.id,
        rol_id: 2, // Cocina
        nombre: 'María López',
        email: 'kitchen@hotdogs.com',
        password_hash: defaultPasswordHash,
        is_active: true,
      },
    }),
  ]);

  console.log('✅ Usuarios creados:', users.length);

  // ============================================================================
  // 5. CREAR CATEGORÍAS
  // ============================================================================
  const categories = await Promise.all([
    prisma.categories.upsert({
      where: { id: '00000000-0000-0000-0000-000000000101' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000101',
        tenant_id: tenant.id,
        nombre: 'Hot Dogs',
        orden_visual: 1,
      },
    }),
    prisma.categories.upsert({
      where: { id: '00000000-0000-0000-0000-000000000102' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000102',
        tenant_id: tenant.id,
        nombre: 'Hamburguesas',
        orden_visual: 2,
      },
    }),
    prisma.categories.upsert({
      where: { id: '00000000-0000-0000-0000-000000000103' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000103',
        tenant_id: tenant.id,
        nombre: 'Bebidas',
        orden_visual: 3,
      },
    }),
  ]);

  console.log('✅ Categorías creadas:', categories.length);

  // ============================================================================
  // 6. CREAR INGREDIENTES (INSUMOS)
  // ============================================================================
  const ingredients = await Promise.all([
    prisma.ingredients.upsert({
      where: { id: '00000000-0000-0000-0000-000000001001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000001001',
        tenant_id: tenant.id,
        nombre: 'Pan para Hot Dog',
        unidad_medida: 'piezas',
        stock_actual: 100,
        stock_minimo: 20,
        costo_unitario_promedio: 2.5,
        categoria_insumo: 'Carbohidratos',
      },
    }),
    prisma.ingredients.upsert({
      where: { id: '00000000-0000-0000-0000-000000001002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000001002',
        tenant_id: tenant.id,
        nombre: 'Salchicha',
        unidad_medida: 'piezas',
        stock_actual: 150,
        stock_minimo: 30,
        costo_unitario_promedio: 5.0,
        categoria_insumo: 'Proteína',
      },
    }),
    prisma.ingredients.upsert({
      where: { id: '00000000-0000-0000-0000-000000001003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000001003',
        tenant_id: tenant.id,
        nombre: 'Mostaza',
        unidad_medida: 'ml',
        stock_actual: 500,
        stock_minimo: 100,
        costo_unitario_promedio: 0.1,
        categoria_insumo: 'Condimentos',
      },
    }),
    prisma.ingredients.upsert({
      where: { id: '00000000-0000-0000-0000-000000001004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000001004',
        tenant_id: tenant.id,
        nombre: 'Mayonesa',
        unidad_medida: 'ml',
        stock_actual: 500,
        stock_minimo: 100,
        costo_unitario_promedio: 0.15,
        categoria_insumo: 'Condimentos',
      },
    }),
    prisma.ingredients.upsert({
      where: { id: '00000000-0000-0000-0000-000000001005' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000001005',
        tenant_id: tenant.id,
        nombre: 'Cebolla',
        unidad_medida: 'gramos',
        stock_actual: 2000,
        stock_minimo: 500,
        costo_unitario_promedio: 0.05,
        categoria_insumo: 'Vegetales',
      },
    }),
  ]);

  console.log('✅ Ingredientes creados:', ingredients.length);

  // ============================================================================
  // 7. CREAR REGLAS DE IMPUESTOS
  // ============================================================================
  const taxRule = await prisma.tax_rules.upsert({
    where: { id: '00000000-0000-0000-0000-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002001',
      tenant_id: tenant.id,
      nombre: 'IVA',
      tasa: 0.16,
      is_active: true,
    },
  });

  console.log('✅ Regla de impuestos creada:', taxRule.nombre);

  // ============================================================================
  // 8. CREAR PRODUCTOS (MENÚ)
  // ============================================================================
  const products = await Promise.all([
    prisma.products.upsert({
      where: { id: '00000000-0000-0000-0000-000000003001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000003001',
        category_id: categories[0].id,
        nombre: 'Hot Dog Clásico',
        descripcion: 'Pan tostado con salchicha, mostaza y cebolla',
        precio_venta: 50.0,
        imagen_url: 'https://example.com/hotdog-clasico.jpg',
        is_available: true,
        aplica_inventario: true,
        tax_rule_id: taxRule.id,
      },
    }),
    prisma.products.upsert({
      where: { id: '00000000-0000-0000-0000-000000003002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000003002',
        category_id: categories[0].id,
        nombre: 'Hot Dog Especial',
        descripcion: 'Pan tostado con salchicha, mostaza, mayonesa y cebolla',
        precio_venta: 60.0,
        imagen_url: 'https://example.com/hotdog-especial.jpg',
        is_available: true,
        aplica_inventario: true,
        tax_rule_id: taxRule.id,
      },
    }),
  ]);

  console.log('✅ Productos creados:', products.length);

  // ============================================================================
  // 9. CREAR RECETAS (EXPLOSIÓN DE INSUMOS)
  // ============================================================================
  const recipes = await Promise.all([
    // Hot Dog Clásico
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004001',
        product_id: products[0].id,
        ingredient_id: ingredients[0].id, // Pan
        cantidad_requerida: 1,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004002',
        product_id: products[0].id,
        ingredient_id: ingredients[1].id, // Salchicha
        cantidad_requerida: 1,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004003',
        product_id: products[0].id,
        ingredient_id: ingredients[2].id, // Mostaza
        cantidad_requerida: 15,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004004',
        product_id: products[0].id,
        ingredient_id: ingredients[4].id, // Cebolla
        cantidad_requerida: 30,
      },
    }),
    // Hot Dog Especial
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004005' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004005',
        product_id: products[1].id,
        ingredient_id: ingredients[0].id, // Pan
        cantidad_requerida: 1,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004006' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004006',
        product_id: products[1].id,
        ingredient_id: ingredients[1].id, // Salchicha
        cantidad_requerida: 1,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004007' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004007',
        product_id: products[1].id,
        ingredient_id: ingredients[3].id, // Mayonesa
        cantidad_requerida: 20,
      },
    }),
    prisma.recipes.upsert({
      where: { id: '00000000-0000-0000-0000-000000004008' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000004008',
        product_id: products[1].id,
        ingredient_id: ingredients[4].id, // Cebolla
        cantidad_requerida: 30,
      },
    }),
  ]);

  console.log('✅ Recetas creadas:', recipes.length);

  // ============================================================================
  // 10. CREAR CLIENTES
  // ============================================================================
  const customers = await Promise.all([
    prisma.customers.upsert({
      where: { whatsapp: '+5215551234567' },
      update: {},
      create: {
        tenant_id: tenant.id,
        nombre: 'Juan',
        apellido: 'Pérez',
        whatsapp: '+5215551234567',
        email: 'juan@example.com',
        puntos_lealtad: 100,
        notas_preferencias: 'Sin cebolla',
        is_active: true,
      },
    }),
    prisma.customers.upsert({
      where: { whatsapp: '+5215559876543' },
      update: {},
      create: {
        tenant_id: tenant.id,
        nombre: 'María',
        apellido: 'González',
        whatsapp: '+5215559876543',
        email: 'maria@example.com',
        puntos_lealtad: 250,
        notas_preferencias: 'Extra mostaza',
        is_active: true,
      },
    }),
  ]);

  console.log('✅ Clientes creados:', customers.length);

  // ============================================================================
  // 11. CREAR DIRECCIONES DE CLIENTES
  // ============================================================================
  const addresses = await Promise.all([
    prisma.customer_addresses.upsert({
      where: { id: '00000000-0000-0000-0000-000000005001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000005001',
        customer_id: customers[0].id,
        etiqueta: 'Casa',
        calle_avenida: 'Avenida Principal',
        num_exterior: '123',
        num_interior_depto: 'Apt 4B',
        referencias: 'Frente al parque',
        codigo_postal: '28001',
        is_default: true,
      },
    }),
  ]);

  console.log('✅ Direcciones creadas:', addresses.length);

  // ============================================================================
  // 12. CREAR MÉTODOS DE PAGO
  // ============================================================================
  const paymentMethods = await Promise.all([
    prisma.payment_methods.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, nombre: 'Efectivo' },
    }),
    prisma.payment_methods.upsert({
      where: { id: 2 },
      update: {},
      create: { id: 2, nombre: 'Tarjeta Crédito' },
    }),
    prisma.payment_methods.upsert({
      where: { id: 3 },
      update: {},
      create: { id: 3, nombre: 'Transferencia Bancaria' },
    }),
  ]);

  console.log('✅ Métodos de pago creados:', paymentMethods.length);

  // ============================================================================
  // 13. CREAR SESIÓN DE CAJA
  // ============================================================================
  const cashSession = await prisma.public_cash_sessions.create({
    data: {
      tenant_id: tenant.id,
      branch_id: branch.id,
      user_id: users[0].id,
      opening_time: new Date(),
      cash_initial: 500.0,
      status: 'OPEN',
    },
  });

  console.log('✅ Sesión de caja creada');

  // ============================================================================
  // 14. CREAR ORDEN (PEDIDO)
  // ============================================================================
  const order = await prisma.orders.create({
    data: {
      tenant_id: tenant.id,
      branch_id: branch.id,
      user_id: users[1].id,
      customer_name: 'Juan Pérez',
      customer_whatsapp: '+5215551234567',
      status: 'PENDIENTE',
      customer_id: customers[0].id,
      address_id: addresses[0].id,
      payment_method_id: 1,
      cash_session_id: cashSession.id,
      subtotal: 110.0,
      impuestos_total: 17.6,
      descuento_total: 0,
      total_neto: 127.6,
      payment_status: 'UNPAID',
      nota_especial: 'Sin cebolla en ambos',
      order_items: {
        create: [
          {
            product_id: products[0].id,
            cantidad: 1,
            precio_unitario_snapshot: 50.0,
            subtotal_item: 50.0,
            tasa_iva: 16,
          },
          {
            product_id: products[1].id,
            cantidad: 1,
            precio_unitario_snapshot: 60.0,
            subtotal_item: 60.0,
            tasa_iva: 16,
          },
        ],
      },
    },
  });

  console.log('✅ Orden creada:', order.id);

  console.log('\n✨ Seed completado exitosamente! ✨\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
