import type { products } from '@prisma/client';

export interface ProductOutput {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  precio_venta: number | null;
  imagen_url: string | null;
  is_available: boolean | null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toProductOutput(product: products): ProductOutput {
  return {
    id: product.id,
    nombre: product.nombre,
    descripcion: product.descripcion,
    precio_venta: toNumberOrNull(product.precio_venta),
    imagen_url: product.imagen_url,
    is_available: product.is_available,
  };
}

export function toProductListOutput(items: products[]): ProductOutput[] {
  return items.map(toProductOutput);
}
