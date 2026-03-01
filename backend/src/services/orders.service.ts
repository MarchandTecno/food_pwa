import type { Prisma } from '@prisma/client';
import type { Context } from '../context';
import { getAuthenticatedUserId } from '../utils/authGuard';
import { badUserInputError, forbiddenError, notFoundError } from '../utils/graphqlErrors';
import { executeDbOperation, withTransaction } from '../database';
import { toOrderListOutput, toOrderOutput, type OrderOutput, type OrderWithRelations } from '../models/order.model';

export interface CreateOrderItemInput {
  product_id: string;
  cantidad: number;
}

export interface CreateOrderArgs {
  customer_name: string;
  customer_whatsapp: string;
  customer_id?: string;
  address_id?: string;
  payment_method_id?: number;
  items: CreateOrderItemInput[];
}

export interface IdArgs {
  id: string;
}

export interface LimitArgs {
  limit?: number;
}

export interface CursorPaginationArgs extends LimitArgs {
  offset?: number;
  cursor?: string;
}

export interface DateRangeInput {
  from?: string;
  to?: string;
}

export interface OrderFilterInput {
  status?: string;
  date_range?: DateRangeInput;
  customer_name?: string;
}

export type SortDirection = 'asc' | 'desc';
export type OrderSortField = 'created_at' | 'total_neto' | 'nombre';

export interface OrderSortInput {
  field: OrderSortField;
  direction?: SortDirection;
}

export interface ListOrdersArgs extends CursorPaginationArgs {
  filter?: OrderFilterInput;
  sort?: OrderSortInput;
}

export interface PageInfo {
  total: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  limit: number;
  offset: number | null;
}

export interface OrderPageResult {
  items: OrderOutput[];
  pageInfo: PageInfo;
}

export interface UpdateOrderStatusArgs {
  id: string;
  status: string;
}

interface AuthScope {
  tenantId?: string;
  branchId?: string;
}

interface AuditLogPayload {
  action: string;
  tenantId?: string;
  userId: string;
  recordId?: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

type DbClient = Context['prisma'] | Prisma.TransactionClient;

const MAX_PAGE_SIZE = 100;
const VALID_ORDER_STATUS = new Set(['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'COMPLETADO', 'CANCELADO']);

function parseDateOrThrow(value: string, field: string, endOfDay = false): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badUserInputError(`Invalid input: ${field} must be a valid date string`);
  }

  if (endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  } else {
    parsed.setUTCHours(0, 0, 0, 0);
  }

  return parsed;
}

function normalizeStatusOrThrow(value: string, fieldName: string): string {
  const status = value.trim().toUpperCase();
  if (!status) {
    throw badUserInputError(`Invalid input: ${fieldName} must not be empty`);
  }

  if (!VALID_ORDER_STATUS.has(status)) {
    throw badUserInputError(
      `Invalid input: ${fieldName} must be one of: ${Array.from(VALID_ORDER_STATUS).join(', ')}`,
    );
  }

  return status;
}

function validateOrderCustomerPayloadOrThrow(args: CreateOrderArgs): {
  customerName: string;
  customerWhatsapp: string;
} {
  const customerName = args.customer_name.trim();
  if (!customerName) {
    throw badUserInputError('Invalid input: customer_name must not be empty');
  }

  const customerWhatsapp = args.customer_whatsapp.trim();
  if (!customerWhatsapp) {
    throw badUserInputError('Invalid input: customer_whatsapp must not be empty');
  }

  return { customerName, customerWhatsapp };
}

function validateOrderItemsPayloadOrThrow(items: CreateOrderItemInput[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw badUserInputError('Invalid input: items must not be empty');
  }

  for (const [index, item] of items.entries()) {
    if (!item.product_id?.trim()) {
      throw badUserInputError(`Invalid input: items[${index}].product_id must not be empty`);
    }

    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw badUserInputError(`Invalid input: items[${index}].cantidad must be an integer greater than 0`);
    }
  }
}

function validateAndNormalizeListArgs(args: ListOrdersArgs): {
  take: number;
  useCursor: boolean;
  safeOffset: number;
  normalizedStatus?: string;
  fromDate?: Date;
  toDate?: Date;
} {
  if (args.limit !== undefined && (args.limit < 1 || args.limit > MAX_PAGE_SIZE)) {
    throw badUserInputError(`Invalid input: limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  if (args.offset !== undefined && args.offset < 0) {
    throw badUserInputError('Invalid input: offset must be greater than or equal to 0');
  }

  if (args.cursor !== undefined && !args.cursor.trim()) {
    throw badUserInputError('Invalid input: cursor must not be empty');
  }

  if (args.cursor && args.offset !== undefined) {
    throw badUserInputError('Invalid input: offset and cursor cannot be used together');
  }

  const fromDate = args.filter?.date_range?.from
    ? parseDateOrThrow(args.filter.date_range.from, 'date_range.from')
    : undefined;
  const toDate = args.filter?.date_range?.to
    ? parseDateOrThrow(args.filter.date_range.to, 'date_range.to', true)
    : undefined;

  if (fromDate && toDate && fromDate > toDate) {
    throw badUserInputError('Invalid input: date_range.from must be earlier than or equal to date_range.to');
  }

  return {
    take: args.limit ?? 50,
    useCursor: Boolean(args.cursor),
    safeOffset: args.cursor ? 0 : Math.max(args.offset ?? 0, 0),
    normalizedStatus: args.filter?.status ? normalizeStatusOrThrow(args.filter.status, 'status') : undefined,
    fromDate,
    toDate,
  };
}

async function getAuthenticatedScope(ctx: Context, userId: string): Promise<AuthScope> {
  const user = await ctx.prisma.users.findUnique({
    where: { id: userId },
    select: { tenant_id: true, branch_id: true },
  });

  return {
    tenantId: user?.tenant_id ?? undefined,
    branchId: user?.branch_id ?? undefined,
  };
}

function buildOrderScopeWhere(userId: string, scope: AuthScope): Prisma.ordersWhereInput {
  const where: Prisma.ordersWhereInput = {};

  if (scope.tenantId) where.tenant_id = scope.tenantId;
  if (scope.branchId) where.branch_id = scope.branchId;

  if (!scope.tenantId && !scope.branchId) {
    where.user_id = userId;
  }

  return where;
}

function normalizeIpForAudit(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return ip.slice(0, 45);
}

async function createAuditLog(db: DbClient, ctx: Context, payload: AuditLogPayload): Promise<void> {
  await db.audit_logs.create({
    data: {
      tenant_id: payload.tenantId,
      user_id: payload.userId,
      accion: payload.action,
      tabla_afectada: 'orders',
      registro_id: payload.recordId,
      valor_anterior: payload.previousValue,
      valor_nuevo: payload.newValue,
      ip_address: normalizeIpForAudit(ctx.requestIp),
    },
  });
}

export async function listOrders(ctx: Context, args: ListOrdersArgs) {
  return executeDbOperation(async () => {
    const page = await listOrdersPage(ctx, args);
    return page.items;
  });
}

export async function listOrdersPage(ctx: Context, args: ListOrdersArgs): Promise<OrderPageResult> {
  return executeDbOperation(async () => {
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx, userId);
    const { take, useCursor, safeOffset, normalizedStatus, fromDate, toDate } = validateAndNormalizeListArgs(args);
    const direction: Prisma.SortOrder = args.sort?.direction === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ordersWhereInput = {
      ...buildOrderScopeWhere(userId, scope),
    };

    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    if (args.filter?.customer_name?.trim()) {
      where.customer_name = {
        contains: args.filter.customer_name.trim(),
        mode: 'insensitive',
      };
    }

    if (fromDate || toDate) {
      where.created_at = {
        gte: fromDate,
        lte: toDate,
      };
    }

    let orderBy: Prisma.ordersOrderByWithRelationInput;
    switch (args.sort?.field) {
      case 'total_neto':
        orderBy = { total_neto: direction };
        break;
      case 'nombre':
        orderBy = { customer_name: direction };
        break;
      default:
        orderBy = { created_at: direction };
        break;
    }

    const [rows, total] = await Promise.all([
      ctx.prisma.orders.findMany({
        take: take + 1,
        skip: useCursor ? 1 : safeOffset,
        cursor: useCursor ? { id: args.cursor! } : undefined,
        where,
        orderBy: [orderBy, { id: direction }],
        include: { order_items: true, users: true },
      }),
      ctx.prisma.orders.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const items = hasNextPage ? rows.slice(0, take) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

    return {
      items: toOrderListOutput(items as OrderWithRelations[]),
      pageInfo: {
        total,
        hasNextPage,
        nextCursor,
        limit: take,
        offset: useCursor ? null : safeOffset,
      },
    };
  });
}

export async function getOrderById(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx, userId);

    const order = await ctx.prisma.orders.findFirst({
      where: {
        id: args.id,
        ...buildOrderScopeWhere(userId, scope),
      },
      include: { order_items: { include: { products: true } }, users: true },
    });

    return order ? toOrderOutput(order) : null;
  });
}

export async function createOrder(ctx: Context, args: CreateOrderArgs) {
  return executeDbOperation(async () => {
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx, userId);
    const { customerName, customerWhatsapp } = validateOrderCustomerPayloadOrThrow(args);
    validateOrderItemsPayloadOrThrow(args.items);

  let customerIdToUse: string | undefined;
  if (args.customer_id) {
    const customer = await ctx.prisma.customers.findFirst({
      where: {
        id: args.customer_id,
        ...(scope.tenantId ? { tenant_id: scope.tenantId } : {}),
      },
      select: { id: true },
    });

    if (!customer) {
      throw notFoundError(`Resource not found: customer ${args.customer_id}`);
    }

    customerIdToUse = customer.id;
  }

  let addressIdToUse: string | undefined;
  if (args.address_id) {
    const address = await ctx.prisma.customer_addresses.findFirst({
      where: {
        id: args.address_id,
        customers: scope.tenantId
          ? {
              is: { tenant_id: scope.tenantId },
            }
          : undefined,
      },
      select: { id: true, customer_id: true },
    });

    if (!address) {
      throw notFoundError(`Resource not found: customer_address ${args.address_id}`);
    }

    if (customerIdToUse && address.customer_id && customerIdToUse !== address.customer_id) {
      throw badUserInputError('Invalid input: address_id does not belong to customer_id');
    }

    addressIdToUse = address.id;
    if (!customerIdToUse && address.customer_id) {
      customerIdToUse = address.customer_id;
    }
  }

  let paymentMethodIdToUse: number | undefined;
  if (args.payment_method_id !== undefined) {
    if (!Number.isInteger(args.payment_method_id) || args.payment_method_id <= 0) {
      throw badUserInputError('Invalid input: payment_method_id must be a positive integer');
    }

    const paymentMethod = await ctx.prisma.payment_methods.findUnique({
      where: { id: args.payment_method_id },
      select: { id: true },
    });

    if (!paymentMethod) {
      throw notFoundError(`Resource not found: payment_method ${args.payment_method_id}`);
    }

    paymentMethodIdToUse = paymentMethod.id;
  }

  let subtotal = 0;
  const orderItemsData: Array<{
    product_id: string;
    cantidad: number;
    precio_unitario_snapshot: number;
    subtotal_item: number;
  }> = [];

  for (const item of args.items) {
    const product = await ctx.prisma.products.findUnique({ where: { id: item.product_id } });
    if (!product) {
      throw notFoundError(`Resource not found: product ${item.product_id}`);
    }

    if (!product.is_available) {
      throw forbiddenError(`Operation not allowed: product ${item.product_id} is inactive`);
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

    return withTransaction(ctx.prisma, async (tx) => {
      const createdOrder = await tx.orders.create({
      data: {
        tenant_id: scope.tenantId,
        branch_id: scope.branchId,
        user_id: userId,
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        customer_id: customerIdToUse,
        address_id: addressIdToUse,
        payment_method_id: paymentMethodIdToUse,
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

      await tx.order_status_history.create({
      data: {
        order_id: createdOrder.id,
        status_anterior: null,
        status_nuevo: createdOrder.status,
        user_id: userId,
      },
    });

      await createAuditLog(tx, ctx, {
      action: 'CREATE_ORDER',
      tenantId: scope.tenantId,
      userId,
      recordId: createdOrder.id,
      newValue: {
        requestId: ctx.requestId,
        status: createdOrder.status,
        total_neto: Number(createdOrder.total_neto),
        itemCount: createdOrder.order_items.length,
      } as Prisma.InputJsonValue,
    });

      return toOrderOutput(createdOrder);
    });
  });
}

export async function updateOrderStatus(ctx: Context, args: UpdateOrderStatusArgs) {
  return executeDbOperation(async () => {
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx, userId);
    const normalizedStatus = normalizeStatusOrThrow(args.status, 'status');

    return withTransaction(ctx.prisma, async (tx) => {
      const existing = await tx.orders.findFirst({
      where: {
        id: args.id,
        ...buildOrderScopeWhere(userId, scope),
      },
      select: { id: true, status: true, tenant_id: true },
    });

      if (!existing) {
        throw notFoundError(`Resource not found: order ${args.id}`);
      }

      const updatedOrder = await tx.orders.update({
      where: { id: args.id },
      data: { status: normalizedStatus },
      include: { order_items: true, users: true },
    });

      if (existing.status !== normalizedStatus) {
        await tx.order_status_history.create({
        data: {
          order_id: updatedOrder.id,
          status_anterior: existing.status,
          status_nuevo: normalizedStatus,
          user_id: userId,
        },
      });
    }

      await createAuditLog(tx, ctx, {
      action: 'UPDATE_ORDER',
      tenantId: existing.tenant_id ?? scope.tenantId,
      userId,
      recordId: updatedOrder.id,
      previousValue: {
        requestId: ctx.requestId,
        status: existing.status,
      } as Prisma.InputJsonValue,
      newValue: {
        requestId: ctx.requestId,
        status: normalizedStatus,
      } as Prisma.InputJsonValue,
    });

      return toOrderOutput(updatedOrder);
    });
  });
}

export async function deleteOrder(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx, userId);

    const existing = await ctx.prisma.orders.findFirst({
      where: {
        id: args.id,
        ...buildOrderScopeWhere(userId, scope),
      },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError(`Resource not found: order ${args.id}`);
    }

    await ctx.prisma.orders.delete({
      where: { id: args.id },
    });
    return true;
  });
}
