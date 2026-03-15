import type { Prisma } from '@prisma/client';
import type { Context } from '../context';
import { getAuthenticatedUserId } from '../utils/authGuard';
import { badUserInputError } from '../utils/graphqlErrors';
import type { CursorPaginationArgs, PageInfo, SortDirection } from '../types/pagination';
import {
  parseCreateProductArgsOrThrow,
  parseIdArgsOrThrow,
  parseListProductsArgsOrThrow,
  parseUpdateProductArgsOrThrow,
} from '../schemas/products.schema';
import { executeDbOperation, withTransaction } from '../database';
import { toProductListOutput, toProductOutput, type ProductOutput } from '../models/product.model';
import { createAuditLog, toAuditJsonRecord } from '../utils/audit';

export interface ProductFilterInput {
  is_available?: boolean;
  text?: string;
}

export type ProductSortField = 'nombre';

export interface ProductSortInput {
  field: ProductSortField;
  direction?: SortDirection;
}

export interface ListProductsArgs extends CursorPaginationArgs {
  filter?: ProductFilterInput;
  sort?: ProductSortInput;
}

export interface ProductPageResult {
  items: ProductOutput[];
  pageInfo: PageInfo;
}

export interface IdArgs {
  id: string;
}

export interface CreateProductArgs {
  nombre: string;
  descripcion?: string;
  precio_venta?: number;
  imagen_url?: string;
  category_id?: string;
}

export interface UpdateProductArgs extends CreateProductArgs {
  id: string;
  is_available?: boolean;
}

interface ProductScope {
  tenantId?: string;
}

const AUDIT_ACTION_PRODUCT_CREATE = 'PRODUCT_CREATE';
const AUDIT_ACTION_PRODUCT_UPDATE = 'PRODUCT_UPDATE';
const AUDIT_ACTION_PRODUCT_DELETE = 'PRODUCT_DELETE';

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toProductAuditRecord(product: {
  category_id?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  precio_venta?: unknown;
  imagen_url?: string | null;
  is_available?: boolean | null;
}): Prisma.InputJsonValue {
  return toAuditJsonRecord({
    category_id: product.category_id ?? null,
    nombre: product.nombre ?? null,
    descripcion: product.descripcion ?? null,
    precio_venta: toNullableNumber(product.precio_venta),
    imagen_url: product.imagen_url ?? null,
    is_available: product.is_available ?? null,
  });
}

async function getAuthenticatedScope(ctx: Context): Promise<ProductScope> {
  if (!ctx.authContext?.isAuthenticated || !ctx.authContext.user) return {};

  const user = await ctx.prisma.users.findUnique({
    where: { id: ctx.authContext.user.userId },
    select: { tenant_id: true },
  });

  return {
    tenantId: user?.tenant_id ?? undefined,
  };
}

function buildProductScopeWhere(scope: ProductScope): Prisma.productsWhereInput {
  if (scope.tenantId) {
    return {
      categories: {
        is: {
          tenant_id: scope.tenantId,
        },
      },
    };
  }

  return {};
}

async function validateCategoryOrThrow(ctx: Context, categoryId: string | undefined, scope: ProductScope): Promise<string | undefined> {
  if (!categoryId) {
    if (scope.tenantId) {
      throw badUserInputError('Invalid input: category_id is required for tenant-scoped product creation');
    }

    return undefined;
  }

  const category = await ctx.prisma.categories.findUnique({
    where: { id: categoryId },
    select: { id: true, tenant_id: true },
  });

  if (!category) {
    throw badUserInputError('Invalid input: category_id does not exist');
  }

  if (scope.tenantId && category.tenant_id !== scope.tenantId) {
    throw badUserInputError('Invalid input: category_id does not belong to current tenant');
  }

  return category.id;
}

export async function listProducts(ctx: Context, args: ListProductsArgs) {
  return executeDbOperation(async () => {
    const page = await listProductsPage(ctx, args);
    return page.items;
  });
}

export async function listProductsPage(ctx: Context, args: ListProductsArgs): Promise<ProductPageResult> {
  return executeDbOperation(async () => {
    const validatedArgs = parseListProductsArgsOrThrow(args);

    const take = validatedArgs.limit ?? 50;
    const direction: Prisma.SortOrder = validatedArgs.sort?.direction === 'asc' ? 'asc' : 'desc';
    const useCursor = Boolean(validatedArgs.cursor);
    const safeOffset = useCursor ? 0 : Math.max(validatedArgs.offset ?? 0, 0);
    const scope = await getAuthenticatedScope(ctx);

    const where: Prisma.productsWhereInput = {
      is_available: validatedArgs.filter?.is_available ?? true,
      ...buildProductScopeWhere(scope),
    };

    if (validatedArgs.filter?.text) {
      where.nombre = {
        contains: validatedArgs.filter.text,
        mode: 'insensitive',
      };
    }

    let orderBy: Prisma.productsOrderByWithRelationInput;
    if (validatedArgs.sort?.field === 'nombre') {
      orderBy = { nombre: direction };
    } else {
      orderBy = { id: direction };
    }

    const [rows, total] = await Promise.all([
      ctx.prisma.products.findMany({
        take: take + 1,
        skip: useCursor ? 1 : safeOffset,
        cursor: useCursor ? { id: validatedArgs.cursor! } : undefined,
        where,
        orderBy: [orderBy, { id: direction }],
      }),
      ctx.prisma.products.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const items = hasNextPage ? rows.slice(0, take) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

    return {
      items: toProductListOutput(items),
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

export async function getProductById(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseIdArgsOrThrow(args);
    const scope = await getAuthenticatedScope(ctx);
    if (!scope.tenantId) {
      const product = await ctx.prisma.products.findUnique({ where: { id: validatedArgs.id } });
      return product ? toProductOutput(product) : null;
    }

    const product = await ctx.prisma.products.findFirst({
      where: {
        id: validatedArgs.id,
        ...buildProductScopeWhere(scope),
      },
    });

    return product ? toProductOutput(product) : null;
  });
}

export async function createProduct(ctx: Context, args: CreateProductArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseCreateProductArgsOrThrow(args);
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    const precioVenta = validatedArgs.precio_venta ?? 0;
    const categoryId = await validateCategoryOrThrow(ctx, validatedArgs.category_id, scope);

    return withTransaction(ctx.prisma, async (tx) => {
      const createdProduct = await tx.products.create({
        data: {
          category_id: categoryId,
          nombre: validatedArgs.nombre,
          descripcion: validatedArgs.descripcion,
          precio_venta: precioVenta,
          imagen_url: validatedArgs.imagen_url,
          is_available: true,
        },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'products',
        action: AUDIT_ACTION_PRODUCT_CREATE,
        actorUserId: userId,
        tenantId: scope.tenantId,
        recordId: createdProduct.id,
        newValue: toProductAuditRecord(createdProduct),
      });

      return toProductOutput(createdProduct);
    });
  });
}

export async function updateProduct(ctx: Context, args: UpdateProductArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseUpdateProductArgsOrThrow(args);
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    return withTransaction(ctx.prisma, async (tx) => {
      const existing = await tx.products.findFirst({
        where: {
          id: validatedArgs.id,
          ...buildProductScopeWhere(scope),
        },
        select: {
          id: true,
          category_id: true,
          nombre: true,
          descripcion: true,
          precio_venta: true,
          imagen_url: true,
          is_available: true,
        },
      });

      if (!existing) {
        throw badUserInputError('Invalid input: product is not accessible for current tenant scope');
      }

      const updateData: Prisma.productsUpdateInput = {};
      if (validatedArgs.nombre !== undefined) {
        updateData.nombre = validatedArgs.nombre;
      }
      if (validatedArgs.descripcion !== undefined) updateData.descripcion = validatedArgs.descripcion;
      if (validatedArgs.precio_venta !== undefined) {
        updateData.precio_venta = validatedArgs.precio_venta;
      }
      if (validatedArgs.imagen_url !== undefined) updateData.imagen_url = validatedArgs.imagen_url;
      if (validatedArgs.is_available !== undefined) updateData.is_available = validatedArgs.is_available;
      if (validatedArgs.category_id !== undefined) {
        updateData.categories = {
          connect: { id: await validateCategoryOrThrow(ctx, validatedArgs.category_id, scope) },
        };
      }

      const updatedProduct = await tx.products.update({
        where: { id: validatedArgs.id },
        data: updateData,
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'products',
        action: AUDIT_ACTION_PRODUCT_UPDATE,
        actorUserId: userId,
        tenantId: scope.tenantId,
        recordId: updatedProduct.id,
        previousValue: toProductAuditRecord(existing),
        newValue: toProductAuditRecord(updatedProduct),
      });

      return toProductOutput(updatedProduct);
    });
  });
}

export async function deleteProduct(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseIdArgsOrThrow(args);
    const userId = getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    return withTransaction(ctx.prisma, async (tx) => {
      const existing = await tx.products.findFirst({
        where: {
          id: validatedArgs.id,
          ...buildProductScopeWhere(scope),
        },
        select: {
          id: true,
          category_id: true,
          nombre: true,
          descripcion: true,
          precio_venta: true,
          imagen_url: true,
          is_available: true,
        },
      });

      if (!existing) {
        throw badUserInputError('Invalid input: product is not accessible for current tenant scope');
      }

      await tx.products.delete({
        where: { id: validatedArgs.id },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'products',
        action: AUDIT_ACTION_PRODUCT_DELETE,
        actorUserId: userId,
        tenantId: scope.tenantId,
        recordId: existing.id,
        previousValue: toProductAuditRecord(existing),
      });

      return true;
    });
  });
}
