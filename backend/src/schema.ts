import { gql } from 'graphql-tag';
import { createContext } from './context';
import { generateToken } from './auth';
import bcrypt from 'bcrypt';

export const typeDefs = gql`
  type User {
    id: String!
    email: String!
    nombre: String
    created_at: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Product {
    id: String!
    nombre: String
    descripcion: String
    precio_venta: Float
    imagen_url: String
    is_available: Boolean
    created_at: String
  }

  type OrderItem {
    id: String!
    product_id: String
    product: Product
    cantidad: Int
    precio_unitario_snapshot: Float
    subtotal_item: Float
  }

  type Order {
    id: String!
    user_id: String
    users: User
    customer_name: String
    customer_whatsapp: String
    subtotal: Float
    total_neto: Float
    status: String
    order_items: [OrderItem!]
    created_at: String
  }

  type Tenant {
    id: String!
    nombre: String
    email: String
    whatsapp: String
    created_at: String
  }

  type Query {
    # Auth
    me: User

    # Products
    products(limit: Int): [Product!]
    product(id: String!): Product

    # Orders
    orders(limit: Int): [Order!]
    order(id: String!): Order

    # Tenants
    tenants(limit: Int): [Tenant!]
    tenant(id: String!): Tenant
  }

  type Mutation {
    # Auth
    login(email: String!, password: String!): AuthPayload
    register(email: String!, password: String!, nombre: String): AuthPayload

    # Products
    createProduct(nombre: String!, descripcion: String, precio_venta: Float, imagen_url: String): Product
    updateProduct(id: String!, nombre: String, descripcion: String, precio_venta: Float, imagen_url: String, is_available: Boolean): Product
    deleteProduct(id: String!): Boolean

    # Orders
    createOrder(customer_name: String!, customer_whatsapp: String!, items: [OrderItemInput!]!): Order
    updateOrderStatus(id: String!, status: String!): Order
    deleteOrder(id: String!): Boolean
  }

  input OrderItemInput {
    product_id: String!
    cantidad: Int!
  }
`;

export const resolvers = {
  Query: {
    me: async (_: any, __: any, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated || !ctx.authContext.user) {
        throw new Error('Not authenticated');
      }
      const userId = ctx.authContext.user.userId;
      return ctx.prisma.users.findUnique({ where: { id: userId } });
    },

    products: async (_: any, args: { limit?: number }, ctx = createContext()) => {
      return ctx.prisma.products.findMany({ take: args.limit ?? 50, where: { is_available: true } });
    },

    product: async (_: any, args: { id: string }, ctx = createContext()) => {
      return ctx.prisma.products.findUnique({ where: { id: args.id } });
    },

    orders: async (_: any, args: { limit?: number }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }
      return ctx.prisma.orders.findMany({
        take: args.limit ?? 50,
        include: { order_items: true, users: true },
      });
    },

    order: async (_: any, args: { id: string }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }
      return ctx.prisma.orders.findUnique({
        where: { id: args.id },
        include: { order_items: { include: { products: true } }, users: true },
      });
    },

    tenants: async (_: any, args: { limit?: number }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }
      return ctx.prisma.tenants.findMany({
        take: args.limit ?? 50,
      });
    },

    tenant: async (_: any, args: { id: string }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }
      return ctx.prisma.tenants.findUnique({
        where: { id: args.id },
      });
    },
  },

  Mutation: {
    login: async (_: any, args: { email: string; password: string }, ctx = createContext()) => {
      const user = await ctx.prisma.users.findUnique({ where: { email: args.email } });
      if (!user) {
        throw new Error('User not found');
      }

      const passwordMatch = await bcrypt.compare(args.password, user.password_hash || '');
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      return { token, user };
    },

    register: async (_: any, args: { email: string; password: string; nombre?: string }, ctx = createContext()) => {
      const existingUser = await ctx.prisma.users.findUnique({ where: { email: args.email } });
      if (existingUser) {
        throw new Error('User already exists');
      }

      const password_hash = await bcrypt.hash(args.password, 10);

      const user = await ctx.prisma.users.create({
        data: {
          email: args.email,
          password_hash,
          nombre: args.nombre || 'New User',
        },
      });

      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      return { token, user };
    },

    createProduct: async (
      _: any,
      args: { nombre: string; descripcion?: string; precio_venta?: number; imagen_url?: string },
      ctx = createContext(),
    ) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      return ctx.prisma.products.create({
        data: {
          nombre: args.nombre,
          descripcion: args.descripcion,
          precio_venta: args.precio_venta ?? 0,
          imagen_url: args.imagen_url,
          is_available: true,
        },
      });
    },

    updateProduct: async (
      _: any,
      args: { id: string; nombre?: string; descripcion?: string; precio_venta?: number; imagen_url?: string; is_available?: boolean },
      ctx = createContext(),
    ) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      const updateData: any = {};
      if (args.nombre) updateData.nombre = args.nombre;
      if (args.descripcion) updateData.descripcion = args.descripcion;
      if (args.precio_venta) updateData.precio_venta = args.precio_venta;
      if (args.imagen_url) updateData.imagen_url = args.imagen_url;
      if (args.is_available !== undefined) updateData.is_available = args.is_available;

      return ctx.prisma.products.update({
        where: { id: args.id },
        data: updateData,
      });
    },

    deleteProduct: async (_: any, args: { id: string }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      await ctx.prisma.products.delete({
        where: { id: args.id },
      });

      return true;
    },

    createOrder: async (
      _: any,
      args: { customer_name: string; customer_whatsapp: string; items: Array<{ product_id: string; cantidad: number }> },
      ctx = createContext(),
    ) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      const userId = ctx.authContext.user!.userId;

      // Calcular subtotal
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of args.items) {
        const product = await ctx.prisma.products.findUnique({ where: { id: item.product_id } });
        if (!product) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const subtotal_item = (Number(product.precio_venta) || 0) * item.cantidad;
        subtotal += subtotal_item;

        orderItemsData.push({
          product_id: item.product_id,
          cantidad: item.cantidad,
          precio_unitario_snapshot: Number(product.precio_venta) || 0,
          subtotal_item,
        });
      }

      return ctx.prisma.orders.create({
        data: {
          user_id: userId,
          customer_name: args.customer_name,
          customer_whatsapp: args.customer_whatsapp,
          subtotal,
          total_neto: subtotal,
          status: 'PENDIENTE',
          order_items: {
            createMany: {
              data: orderItemsData,
            },
          },
        },
        include: { order_items: true, users: true },
      });
    },

    updateOrderStatus: async (_: any, args: { id: string; status: string }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      return ctx.prisma.orders.update({
        where: { id: args.id },
        data: { status: args.status },
        include: { order_items: true, users: true },
      });
    },

    deleteOrder: async (_: any, args: { id: string }, ctx = createContext()) => {
      if (!ctx.authContext?.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      await ctx.prisma.orders.delete({
        where: { id: args.id },
      });

      return true;
    },
  },

  Order: {
    users: async (parent: any, _: any, ctx = createContext()) => {
      if (parent.users) return parent.users;
      return ctx.prisma.users.findUnique({ where: { id: parent.user_id } });
    },
  },

  OrderItem: {
    product: async (parent: any, _: any, ctx = createContext()) => {
      if (parent.products) return parent.products;
      return ctx.prisma.products.findUnique({ where: { id: parent.product_id } });
    },
  },
};
