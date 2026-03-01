import type { order_items, orders, products, users } from '@prisma/client';
import type { Context } from '../context';
import { createContext } from '../context';
import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  listOrdersPage,
  updateOrderStatus,
  type CreateOrderArgs,
  type IdArgs,
  type ListOrdersArgs,
  type UpdateOrderStatusArgs,
} from '../services/orders.service';

export const orderQueryResolvers = {
  orders: async (_: unknown, args: ListOrdersArgs, ctx: Context = createContext()) => {
    return listOrders(ctx, args);
  },
  ordersPage: async (_: unknown, args: ListOrdersArgs, ctx: Context = createContext()) => {
    return listOrdersPage(ctx, args);
  },
  order: async (_: unknown, args: IdArgs, ctx: Context = createContext()) => {
    return getOrderById(ctx, args);
  },
};

export const orderMutationResolvers = {
  createOrder: async (_: unknown, args: CreateOrderArgs, ctx: Context = createContext()) => {
    return createOrder(ctx, args);
  },
  updateOrderStatus: async (_: unknown, args: UpdateOrderStatusArgs, ctx: Context = createContext()) => {
    return updateOrderStatus(ctx, args);
  },
  deleteOrder: async (_: unknown, args: IdArgs, ctx: Context = createContext()) => {
    return deleteOrder(ctx, args);
  },
};

export const orderFieldResolvers = {
  Order: {
    users: async (parent: orders & { users?: users | null }, _: unknown, ctx: Context = createContext()) => {
      if (parent.users) return parent.users;
      if (!parent.user_id) return null;
      return ctx.prisma.users.findUnique({ where: { id: parent.user_id } });
    },
  },

  OrderItem: {
    product: async (parent: order_items & { products?: products | null }, _: unknown, ctx: Context = createContext()) => {
      if (parent.products) return parent.products;
      if (!parent.product_id) return null;
      return ctx.prisma.products.findUnique({ where: { id: parent.product_id } });
    },
  },
};
