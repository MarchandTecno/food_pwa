# Arranque local (backend + frontend + frontend-admin)

## Requisitos
- Node.js 18+
- Base de datos configurada para el backend
- Variables de entorno del backend en `backend/.env`

## Primer arranque
Desde la raíz del proyecto:

```bash
npm install
npm run install:all
```

## Desarrollo con un solo comando
Desde la raíz del proyecto:

```bash
npm run dev
```

Esto levanta en paralelo:
- Backend GraphQL: `http://localhost:4001/graphql`
- Frontend Vite: `http://localhost:5173`

## Desarrollo incluyendo panel SuperAdmin
Desde la raíz del proyecto:

```bash
npm run dev:all
```

Esto levanta en paralelo:
- Backend GraphQL: `http://localhost:4001/graphql`
- Frontend cliente: `http://localhost:5173`
- Frontend SuperAdmin: `http://localhost:5174`

## Scripts útiles (raíz)
- `npm run dev` → backend + frontend
- `npm run dev:all` → backend + frontend + frontend-admin
- `npm run dev:backend` → solo backend
- `npm run dev:frontend` → solo frontend
- `npm run dev:admin` → solo frontend-admin
- `npm run build` → build backend + frontend + frontend-admin

## Endpoint frontend
El frontend usa `VITE_GRAPHQL_ENDPOINT`.

Valor por defecto sugerido en `frontend/.env.example`:

```bash
VITE_GRAPHQL_ENDPOINT=http://localhost:4001/graphql
```