# FoodFlow ERP - Backend

Backend GraphQL SaaS para gestión de pedidos, inventario y ventas de micro-negocios de comida.

## 🎯 Características

✅ **Multitenant** - Soporte para múltiples clientes (SaaS)  
✅ **GraphQL** - API flexible y eficiente con Apollo Server  
✅ **Prisma ORM** - Tipado seguro y migraciones automáticas  
✅ **PostgreSQL** - Base de datos relacional robusta  
✅ **Autenticación JWT** - Protección de endpoints  
✅ **Triggers BD** - Lógica automatizada (inventario, auditoría, lealtad)  
✅ **WhatsApp Integration** - Contacto directo con clientes  
✅ **Auditoría Forense** - Registro de cambios sensibles  

---

## 🏗️ Arquitectura

### Estado Fase 4 (REST)

- Por decisión operativa actual, el backend expone **solo GraphQL**.
- La carpeta `src/controllers/` se mantiene vacía intencionalmente mientras no exista alcance REST.
- Si se habilita REST en una fase futura, `controllers` será la capa de entrada HTTP y reutilizará `services` y `database` sin duplicar reglas.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React PWA)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    GraphQL API
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Apollo Server (Node.js/Express)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Resolvers GraphQL                   │ │
│  │  - Tenants       - Orders        - Customers          │ │
│  │  - Products      - Inventory     - Payments           │ │
│  │  - Categories    - Recipes       - Audit Logs         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Middleware (Auth, Validation, CORS)         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Prisma Client (ORM Layer)                │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  public.* (Operación)      core.* (Seguridad)         │ │
│  │  - Orders                  - Audit Logs               │ │
│  │  - Products                - Tax Rules                │ │
│  │  - Inventory               - Coupons                  │ │
│  │  - Customers               - Payments                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

> Nota: `src/controllers` está reservada para una posible API REST futura; hoy no se usa en runtime.

---

## 📦 Stack Tecnológico

| Layer | Tecnología |
|-------|-----------|
| **Servidor** | Node.js + Express.js |
| **API** | Apollo Server (GraphQL) |
| **ORM** | Prisma |
| **BD** | PostgreSQL 14+ |
| **Lenguaje** | TypeScript |
| **Auth** | JWT (JSON Web Tokens) |
| **Validación** | GraphQL Schema + Zod |

---

## 🚀 Quick Start

### 1. Clonar y Navegar
```bash
cd backend
```

### 2. Instalar y Configurar
```bash
npm install
cp .env.example .env
# Editar .env con tus credenciales
# En producción, usa .env.production.example como plantilla segura
```

### 3. Configurar BD
```bash
npm run prisma:migrate -- --name init
npm run prisma:generate
npm run prisma:seed
```

### 4. Iniciar Servidor
```bash
npm run dev
```

✅ Servidor listo en `http://localhost:4001`  
✅ GraphQL Endpoint en `http://localhost:4001/graphql`  
✅ Health Check en `http://localhost:4001/health`  

### 5. Primeras Queries (Autenticación)

Abre `http://localhost:4001/graphql` y ejecuta:

**Registrarse:**
```graphql
mutation {
  register(email: "test@example.com", password: "password123", nombre: "Test User") {
    token
    user {
      id
      email
      nombre
    }
  }
}
```

**Login:**
```graphql
mutation {
  login(email: "test@example.com", password: "password123") {
    token
    user {
      id
      email
    }
  }
}
```

Copia el `token` y añade en **Headers** (⚙️ icon):
```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

**Obtener Usuario Actual:**
```graphql
query {
  me {
    id
    email
    nombre
  }
}
```

> 📖 Para más ejemplos, ver [GRAPHQL_API.md](./GRAPHQL_API.md)

---

## 📂 Estructura de Carpetas

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts         # Configuración Prisma
│   ├── controllers/             # Lógica REST (opcional)
│   ├── resolvers/
│   │   ├── tenant.resolver.ts
│   │   ├── order.resolver.ts
│   │   ├── product.resolver.ts
│   │   ├── inventory.resolver.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.ts             # Verificación JWT
│   │   ├── validation.ts       # Validación de entrada
│   │   └── errorHandler.ts     # Manejo de errores
│   ├── services/
│   │   ├── order.service.ts
│   │   ├── inventory.service.ts
│   │   ├── whatsapp.service.ts
│   │   └── email.service.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── jwt.ts
│   │   └── helpers.ts
│   ├── types/
│   │   └── index.ts            # Tipos generados por Prisma
│   ├── schemas/
│   │   ├── tenant.graphql
│   │   ├── order.graphql
│   │   └── ...
│   └── index.ts                # Entry point
├── prisma/
│   ├── schema.prisma           # Definición de modelos
│   ├── migrations/             # Historial de cambios BD
│   └── seed.ts                 # Datos iniciales
├── tests/                      # Pruebas unitarias
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── .gitignore
└── PRISMA_SETUP.md
```

---

## 🔑 Modelos Principales

### Tenant (Negocio)
```typescript
{
  id: string (UUID)
  nombreComercial: string
  emailAdmin: string
  moneda: MXN (default)
}
```

### Order (Pedido)
```typescript
{
  id: string
  status: PENDIENTE | CONFIRMADO | ENTREGADO
  totalNeto: decimal
  customerId: string
  orderItems: OrderItem[]
}
```

### Product (Producto)
```typescript
{
  id: string
  nombre: string
  precioVenta: decimal
  recipes: Recipe[] // Insumos que necesita
}
```

### Ingredient (Insumo)
```typescript
{
  id: string
  nombre: string
  stockActual: decimal
  unidadMedida: string // piezas, grs, ml
}
```

**Ver [Diagrama ER](../docs/er-diagram.md) para relaciones completas**

---

## 🔐 Autenticación

### Login (Mutation)
```graphql
mutation {
  login(email: "user@example.com", password: "123456") {
    token
    user { id, nombre, rol }
  }
}
```

### Token en Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## 🛡️ Seguridad Base (Día 3)

- `JWT_SECRET` es obligatorio en `production` (el servidor no inicia si falta).
- `JWT_EXPIRATION` controla la expiración de tokens (ej. `15m`, `24h`, `7d`).
- Manejo de token inválido uniforme: el backend responde como no autenticado.
- `CORS` por entorno:
  - `development`: permite orígenes locales controlados (`localhost:3000`, `localhost:5173`).
  - `production`: requiere `CORS_ORIGINS` (o `CORS_ORIGIN`) configurado.
- `CSP` por entorno:
  - `development`: más permisivo para Apollo Sandbox.
  - `production`: política endurecida (`script-src 'self'`, sin `unsafe-eval`).
- `Rate limiting` GraphQL:
  - Siempre activo para `login/register` con `AUTH_RATE_LIMIT_MAX` y `AUTH_RATE_LIMIT_WINDOW_SEC`.
  - Opcional para mutations sensibles con `ENABLE_SENSITIVE_MUTATION_RATE_LIMIT=true`.

---

## 📊 Triggers Automáticos (Base de Datos)

| Trigger | Evento | Acción |
|---------|--------|--------|
| `trg_inventario_pedido` | Order → CONFIRMADO | Descuenta insumos |
| `trg_lealtad_cliente` | Order → ENTREGADO | Acredita puntos |
| `trg_auditar_productos` | Product UPDATE/DELETE | Registra cambio |
| `trg_recalcular_total` | OrderItem INSERT/UPDATE | Recalcula totales |

---

## 📡 Integraciones

### WhatsApp Business
```typescript
// Enviar notificación de pedido
await whatsappService.sendOrderNotification(order);
```

### Email
```typescript
// Enviar confirmación
await emailService.sendOrderConfirmation(order);
```

---

## 🧪 Testing

```bash
# Ejecutar todas las pruebas
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## 📚 Documentación Adicional

- [Prisma Setup](./PRISMA_SETUP.md) - Guía completa de Prisma
- [GraphQL Schema](./src/schemas/) - Esquemas GraphQL
- [API Endpoints](./docs/API.md) - Documentación de endpoints

---

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
npm install
npm run prisma:generate
```

### BD no se conecta
- Verifica PostgreSQL esté corriendo
- Comprueba `DATABASE_URL` en `.env`
- Asegúrate de que `foodflow_erp` exista

### Migraciones fallidas
```bash
# Ver estado
npx prisma migrate status

# Resetear (dev only - borra todo)
npx prisma migrate reset
```

---

## 🤝 Contribuir

1. Crea una rama: `git checkout -b feature/amazing-feature`
2. Commit cambios: `git commit -m 'Add amazing feature'`
3. Push: `git push origin feature/amazing-feature`
4. Open PR

---

## 📝 Licencia

MIT

---

**¿Preguntas o problemas?** Abre un issue o revisa la documentación oficial.
