import type { order_items, orders, products, users } from '@prisma/client';
import { toProductOutput, type ProductOutput } from './product.model';
import { toUserOutput, type UserOutput } from './user.model';

export interface OrderItemOutput {
  id: string;
  product_id: string | null;
  products?: ProductOutput | null;
  cantidad: number | null;
  precio_unitario_snapshot: number | null;
  subtotal_item: number | null;
}

export interface OrderOutput {
  id: string;
  user_id: string | null;
  users?: UserOutput | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  subtotal: number | null;
  total_neto: number | null;
  status: string | null;
  order_items?: OrderItemOutput[];
  created_at: Date | null;
}

export type OrderWithRelations = orders & {
  order_items?: Array<order_items & { products?: products | null }>;
  users?: users | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOrderItemOutput(item: order_items & { products?: products | null }): OrderItemOutput {
  return {
    id: item.id,
    product_id: item.product_id,
    products: item.products ? toProductOutput(item.products) : item.products,
    cantidad: item.cantidad,
    precio_unitario_snapshot: toNumberOrNull(item.precio_unitario_snapshot),
    subtotal_item: toNumberOrNull(item.subtotal_item),
  };
}

export function toOrderOutput(order: OrderWithRelations): OrderOutput {
  return {
    id: order.id,
    user_id: order.user_id,
    users: order.users ? toUserOutput(order.users) : order.users,
    customer_name: order.customer_name,
    customer_whatsapp: order.customer_whatsapp,
    subtotal: toNumberOrNull(order.subtotal),
    total_neto: toNumberOrNull(order.total_neto),
    status: order.status,
    order_items: order.order_items?.map(toOrderItemOutput),
    created_at: order.created_at,
  };
}

export function toOrderListOutput(items: OrderWithRelations[]): OrderOutput[] {
  return items.map(toOrderOutput);
}
