import { gql } from 'graphql-tag';
import { adminObservabilityQueryResolvers } from './resolvers/adminObservability.resolver';
import { adminTenantMutationResolvers, adminTenantQueryResolvers } from './resolvers/adminTenants.resolver';
import { adminUserMutationResolvers, adminUserQueryResolvers } from './resolvers/adminUsers.resolver';
import { authMutationResolvers, authQueryResolvers } from './resolvers/auth.resolver';
import { orderFieldResolvers, orderMutationResolvers, orderQueryResolvers } from './resolvers/orders.resolver';
import { productMutationResolvers, productQueryResolvers } from './resolvers/products.resolver';
import { tenantQueryResolvers } from './resolvers/tenants.resolver';

export const typeDefs = gql`
  type User {
    id: String!
    email: String!
    nombre: String
    role: String
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

  enum TenantSubscriptionStatus {
    ACTIVE
    SUSPENDED
    CANCELED
  }

  enum AdminGlobalRole {
    SUPERADMIN
    OWNER
    KITCHEN
    DELIVERY
  }

  type CssVariable {
    key: String!
    value: String!
  }

  type AdminTenant {
    id: String!
    nombre_comercial: String!
    razon_social: String
    rfc_tax_id: String
    email_admin: String!
    telefono_contacto: String
    logo_url: String
    moneda: String
    region_code: String
    time_zone: String
    palette_css: [CssVariable!]!
    subscription_status: TenantSubscriptionStatus!
    subscription_note: String
    subscription_updated_at: String
    is_active: Boolean!
    created_at: String
    updated_at: String
  }

  type AdminBranch {
    id: String!
    tenant_id: String
    nombre_sucursal: String!
    direccion_fisica: String
    horario_apertura: String
    horario_cierre: String
    is_open: Boolean!
    is_suspended: Boolean!
    suspension_reason: String
  }

  type AdminRolePermission {
    role: AdminGlobalRole!
    hierarchy_level: Int!
    label: String!
    scope: String!
    permissions: [String!]!
  }

  type AdminUserRecord {
    id: String!
    nombre: String!
    email: String!
    role: AdminGlobalRole
    role_label: String!
    tenant_id: String
    tenant_nombre: String
    branch_id: String
    branch_nombre: String
    is_active: Boolean!
    last_login: String
    created_at: String
  }

  type AdminSessionLog {
    id: String!
    user_id: String
    user_email: String
    user_nombre: String
    tenant_id: String
    tenant_nombre: String
    role: AdminGlobalRole
    action: String!
    ip_address: String
    happened_at: String
    last_access: String
  }

  type AdminSessionLogPage {
    items: [AdminSessionLog!]!
    pageInfo: PageInfo!
  }

  type AdminAuditLog {
    id: String!
    actor_user_id: String
    actor_user_email: String
    actor_user_nombre: String
    actor_role: AdminGlobalRole
    tenant_id: String
    tenant_nombre: String
    entity: String!
    action: String!
    record_id: String
    ip_address: String
    happened_at: String
    previous_value: String
    new_value: String
  }

  type AdminAuditLogPage {
    items: [AdminAuditLog!]!
    pageInfo: PageInfo!
  }

  type AdminMetricCount {
    label: String!
    count: Int!
  }

  type AdminMetricPoint {
    timestamp: String!
    label: String!
    value: Float!
  }

  type AdminMetricBreakdown {
    label: String!
    count: Int!
    avg_ms: Float!
    min_ms: Float!
    max_ms: Float!
  }

  type AdminHealthSnapshot {
    status: String!
    db: String!
    uptime_seconds: Int!
    checked_at: String!
    db_ping_ms: Float
    error: String
  }

  type AdminServerMetrics {
    total_requests: Int!
    avg_latency_ms: Float!
    peak_latency_ms: Float!
    recent_latency: [AdminMetricPoint!]!
    operations: [AdminMetricBreakdown!]!
    errors_by_code: [AdminMetricCount!]!
  }

  type AdminDatabaseMetrics {
    total_queries: Int!
    avg_query_ms: Float!
    slow_queries: Int!
    last_query_at: String
    recent_queries: [AdminMetricPoint!]!
    queries_by_type: [AdminMetricBreakdown!]!
  }

  type AdminObservabilitySnapshot {
    checked_at: String!
    health: AdminHealthSnapshot!
    server: AdminServerMetrics!
    database: AdminDatabaseMetrics!
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

    # SuperAdmin
    adminTenants(limit: Int, offset: Int, filter: AdminTenantListFilterInput): [AdminTenant!]
    adminTenant(id: String!): AdminTenant
    adminTenantBranches(tenant_id: String!): [AdminBranch!]
    adminRolePermissions: [AdminRolePermission!]!
    adminUsers(limit: Int, offset: Int, filter: AdminUserFilterInput): [AdminUserRecord!]
    adminSessionLogs(limit: Int, offset: Int, filter: AdminSessionLogFilterInput): [AdminSessionLog!]
    adminSessionLogsPage(limit: Int, offset: Int, filter: AdminSessionLogFilterInput): AdminSessionLogPage!
    adminAuditLogsPage(limit: Int, offset: Int, filter: AdminAuditLogFilterInput): AdminAuditLogPage!
    adminObservabilitySnapshot: AdminObservabilitySnapshot!
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

    # SuperAdmin
    adminCreateTenant(input: AdminCreateTenantInput!): AdminTenant!
    adminUpdateTenantBranding(tenant_id: String!, input: AdminTenantBrandingInput!): AdminTenant!
    adminUpdateTenantRegion(tenant_id: String!, input: AdminTenantRegionInput!): AdminTenant!
    adminUpdateTenantSubscription(tenant_id: String!, status: TenantSubscriptionStatus!, reason: String): AdminTenant!
    adminCreateBranch(input: AdminCreateBranchInput!): AdminBranch!
    adminSetBranchSuspended(branch_id: String!, suspended: Boolean!, reason: String): AdminBranch!
    adminCreateUser(input: AdminCreateUserInput!): AdminUserRecord!
    adminUpdateUserAssignment(input: AdminUpdateUserAssignmentInput!): AdminUserRecord!
    adminResetUserPassword(user_id: String!, new_password: String!): Boolean!
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

  input CssVariableInput {
    key: String!
    value: String!
  }

  input AdminTenantListFilterInput {
    search: String
    subscription_status: TenantSubscriptionStatus
  }

  input AdminCreateTenantInput {
    nombre_comercial: String!
    razon_social: String
    rfc_tax_id: String
    email_admin: String!
    telefono_contacto: String
    logo_url: String
    moneda: String
    region_code: String
    time_zone: String
    palette_css: [CssVariableInput!]
    subscription_status: TenantSubscriptionStatus
  }

  input AdminTenantBrandingInput {
    logo_url: String
    palette_css: [CssVariableInput!]
  }

  input AdminTenantRegionInput {
    moneda: String
    region_code: String
    time_zone: String
  }

  input AdminCreateBranchInput {
    tenant_id: String!
    nombre_sucursal: String!
    direccion_fisica: String
    horario_apertura: String
    horario_cierre: String
    is_open: Boolean
  }

  input AdminUserFilterInput {
    search: String
    tenant_id: String
    branch_id: String
    role: AdminGlobalRole
    is_active: Boolean
  }

  input AdminCreateUserInput {
    nombre: String!
    email: String!
    password: String!
    role: AdminGlobalRole!
    tenant_id: String
    branch_id: String
    is_active: Boolean
  }

  input AdminUpdateUserAssignmentInput {
    user_id: String!
    role: AdminGlobalRole
    tenant_id: String
    branch_id: String
    is_active: Boolean
  }

  input AdminSessionLogFilterInput {
    tenant_id: String
    user_id: String
    role: AdminGlobalRole
    action: String
    search: String
  }

  input AdminAuditLogFilterInput {
    tenant_id: String
    actor_user_id: String
    actor_search: String
    entity: String
    action: String
    search: String
    from: String
    to: String
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
    ...adminObservabilityQueryResolvers,
    ...adminUserQueryResolvers,
    ...adminTenantQueryResolvers,
    ...authQueryResolvers,
    ...orderQueryResolvers,
    ...productQueryResolvers,
    ...tenantQueryResolvers,
  },

  Mutation: {
    ...adminUserMutationResolvers,
    ...adminTenantMutationResolvers,
    ...authMutationResolvers,
    ...orderMutationResolvers,
    ...productMutationResolvers,
  },

  ...orderFieldResolvers,
};
