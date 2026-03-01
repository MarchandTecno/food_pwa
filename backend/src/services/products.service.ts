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
import { executeDbOperation } from '../database';
import { toProductListOutput, toProductOutput, type ProductOutput } from '../models/product.model';

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
    getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    const precioVenta = validatedArgs.precio_venta ?? 0;
    const categoryId = await validateCategoryOrThrow(ctx, validatedArgs.category_id, scope);

    const createdProduct = await ctx.prisma.products.create({
      data: {
        category_id: categoryId,
        nombre: validatedArgs.nombre,
        descripcion: validatedArgs.descripcion,
        precio_venta: precioVenta,
        imagen_url: validatedArgs.imagen_url,
        is_available: true,
      },
    });

    return toProductOutput(createdProduct);
  });
}

export async function updateProduct(ctx: Context, args: UpdateProductArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseUpdateProductArgsOrThrow(args);
    getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    const existing = await ctx.prisma.products.findFirst({
      where: {
        id: validatedArgs.id,
        ...buildProductScopeWhere(scope),
      },
      select: { id: true },
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

    const updatedProduct = await ctx.prisma.products.update({
      where: { id: validatedArgs.id },
      data: updateData,
    });

    return toProductOutput(updatedProduct);
  });
}

export async function deleteProduct(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const validatedArgs = parseIdArgsOrThrow(args);
    getAuthenticatedUserId(ctx);
    const scope = await getAuthenticatedScope(ctx);

    const existing = await ctx.prisma.products.findFirst({
      where: {
        id: validatedArgs.id,
        ...buildProductScopeWhere(scope),
      },
      select: { id: true },
    });

    if (!existing) {
      throw badUserInputError('Invalid input: product is not accessible for current tenant scope');
    }

    await ctx.prisma.products.delete({
      where: { id: validatedArgs.id },
    });

    return true;
  });
}
