# FoodFlow ERP - Backend Setup Guide

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js v18+ instalado
- PostgreSQL 14+ en ejecución
- Base de datos `foodflow_erp` ya creada

---

## 📋 Pasos Iniciales

### 1. **Instalar Dependencias**
```bash
cd backend
npm install
```

### 2. **Configurar Variables de Entorno**
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales reales
# DATABASE_URL="postgresql://usuario:password@localhost:5432/foodflow_erp?schema=public"
```

### 3. **Generar Cliente Prisma**
```bash
npm run prisma:generate
```

### 4. **Ejecutar Migraciones** (Primera vez)
```bash
npm run prisma:migrate
# Esto te pedirá un nombre para la migración, ej: "init"
```

> **Nota**: Si ya tienes la base de datos con tablas, puedes hacer un "pull" de esquema existente:
> ```bash
> npx prisma introspect
> ```

---

## 🛠️ Comandos Útiles

| Comando | Descripción |
|---------|-----------|
| `npm run dev` | Inicia servidor en modo desarrollo con hot-reload |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm start` | Ejecuta el servidor compilado |
| `npm run prisma:migrate` | Crea/aplica migraciones a la BD |
| `npm run prisma:studio` | Abre UI gráfica para ver/editar datos |
| `npm run prisma:seed` | Ejecuta script de datos iniciales |
| `npm test` | Ejecuta pruebas unitarias |
| `npm run lint` | Verifica código con ESLint |
| `npm run format` | Formatea código con Prettier |

---

## 📁 Estructura de Carpetas Backend

```
backend/
├── src/
│   ├── config/           # Configuraciones (DB, JWT, etc)
│   ├── controllers/      # Lógica de negocio (si usas REST)
│   ├── resolvers/        # Resolvers GraphQL con Prisma
│   ├── middleware/       # Autenticación, validación, CORS
│   ├── models/           # Funciones auxiliares con Prisma
│   ├── services/         # Servicios (email, WhatsApp, etc)
│   ├── utils/            # Funciones auxiliares y helpers
│   ├── types/            # Tipos TypeScript generados
│   ├── schemas/          # Esquemas GraphQL (.graphql)
│   └── index.ts          # Punto de entrada
├── prisma/
│   ├── schema.prisma     # Definición de modelos y BD
│   ├── migrations/       # Historial de cambios a BD
│   └── seed.ts           # Datos iniciales
├── tests/                # Pruebas unitarias
├── package.json          # Dependencias
├── .env                  # Variables locales (ENV)
├── .env.example          # Template de variables
└── tsconfig.json         # Configuración TypeScript
```

---

## ⚙️ Configuración TypeScript

### tsconfig.json (recomendado)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 🗄️ Workflow con Prisma

### **Cambiar el Esquema**

1. Edita `prisma/schema.prisma`
2. Ejecuta: `npm run prisma:migrate`
3. Dale un nombre descriptivo a la migración
4. Prisma genera SQL y aplica a PostgreSQL
5. Los tipos TypeScript se actualizan automáticamente

### **Ver Datos en Vivo**

```bash
npm run prisma:studio
# Abre http://localhost:5555
```

---

## 🌱 Inicializar BD con Datos de Ejemplo

Crear archivo `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear un tenant de ejemplo
  const tenant = await prisma.tenant.create({
    data: {
      nombreComercial: "Hot Dogs Don Carlo",
      emailAdmin: "admin@hotdogs.com",
      moneda: "MXN",
      razonSocial: "Comercial Don Carlo S.A. de C.V.",
      telefonoContacto: "+52 55 1234 5678"
    }
  });

  console.log('Tenant creado:', tenant);
}

main();
```

Ejecutar: `npm run prisma:seed`

---

## 🔐 Seguridad

**Importante:**
- ✅ Nunca commitear `.env` (agregar a `.gitignore`)
- ✅ Usar variables de entorno en producción
- ✅ Cambiar `JWT_SECRET` en producción
- ✅ Usar HTTPS en producción
- ✅ Configurar CORS específicamente

---

## 📚 Documentación Oficial

- **Prisma Docs**: https://www.prisma.io/docs/
- **Prisma Schema**: https://www.prisma.io/docs/concepts/components/prisma-schema
- **Prisma Client API**: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference

---

## ⚠️ Solución de Problemas

### Error: "Cannot find module @prisma/client"
```bash
npm install @prisma/client prisma
npm run prisma:generate
```

### Error: "Database connection failed"
- Verifica que PostgreSQL esté corriendo
- Comprueba `DATABASE_URL` en `.env`
- Asegúrate de que la BD `foodflow_erp` exista

### Error: "Migration failed"
```bash
# Resetear BD (CUIDADO: borra todo)
npx prisma migrate reset
```

---

**¿Preguntas?** Revisa la documentación oficial de Prisma o la guía de Apollo Server.
