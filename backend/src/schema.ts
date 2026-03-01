import { gql } from 'graphql-tag';
import { authMutationResolvers, authQueryResolvers } from './resolvers/auth.resolver';
import { orderFieldResolvers, orderMutationResolvers, orderQueryResolvers } from './resolvers/orders.resolver';
import { productMutationResolvers, productQueryResolvers } from './resolvers/products.resolver';
import { tenantQueryResolvers } from './resolvers/tenants.resolver';

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

  type PageInfo {
    total: Int!
    hasNextPage: Boolean!
    nextCursor: String
    limit: Int!
    offset: Int
  }

  type ProductPage {
    items: [Product!]!
    pageInfo: PageInfo!
  }

  type OrderPage {
    items: [Order!]!
    pageInfo: PageInfo!
  }

  type Query {
    # Auth
    me: User

    # Products
    products(
      limit: Int
      offset: Int
      cursor: String
      filter: ProductFilterInput
      sort: ProductSortInput
    ): [Product!]
    productsPage(
      limit: Int
      offset: Int
      cursor: String
      filter: ProductFilterInput
      sort: ProductSortInput
    ): ProductPage!
    product(id: String!): Product

    # Orders
    orders(
      limit: Int
      offset: Int
      cursor: String
      filter: OrderFilterInput
      sort: OrderSortInput
    ): [Order!]
    ordersPage(
      limit: Int
      offset: Int
      cursor: String
      filter: OrderFilterInput
      sort: OrderSortInput
    ): OrderPage!
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
    createProduct(nombre: String!, descripcion: String, precio_venta: Float, imagen_url: String, category_id: String): Product
    updateProduct(id: String!, nombre: String, descripcion: String, precio_venta: Float, imagen_url: String, is_available: Boolean, category_id: String): Product
    deleteProduct(id: String!): Boolean

    # Orders
    createOrder(
      customer_name: String!
      customer_whatsapp: String!
      customer_id: String
      address_id: String
      payment_method_id: Int
      items: [OrderItemInput!]!
    ): Order
    updateOrderStatus(id: String!, status: String!): Order
    deleteOrder(id: String!): Boolean
  }

  input OrderItemInput {
    product_id: String!
    cantidad: Int!
  }

  enum SortDirection {
    asc
    desc
  }

  enum ProductSortField {
    nombre
  }

  input ProductSortInput {
    field: ProductSortField!
    direction: SortDirection = desc
  }

  input ProductFilterInput {
    is_available: Boolean
    text: String
  }

  enum OrderSortField {
    created_at
    total_neto
    nombre
  }

  input OrderSortInput {
    field: OrderSortField!
    direction: SortDirection = desc
  }

  input DateRangeInput {
    from: String
    to: String
  }

  input OrderFilterInput {
    status: String
    date_range: DateRangeInput
    customer_name: String
  }
`;

export const resolvers = {
  Query: {
    ...authQueryResolvers,
    ...orderQueryResolvers,
    ...productQueryResolvers,
    ...tenantQueryResolvers,
  },

  Mutation: {
    ...authMutationResolvers,
    ...orderMutationResolvers,
    ...productMutationResolvers,
  },

  ...orderFieldResolvers,
};
