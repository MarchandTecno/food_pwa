import type { Context } from '../context';
import { createContext } from '../context';
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  listProductsPage,
  updateProduct,
  type CreateProductArgs,
  type IdArgs,
  type ListProductsArgs,
  type UpdateProductArgs,
} from '../services/products.service';

export const productQueryResolvers = {
  products: async (_: unknown, args: ListProductsArgs, ctx: Context = createContext()) => {
    return listProducts(ctx, args);
  },
  productsPage: async (_: unknown, args: ListProductsArgs, ctx: Context = createContext()) => {
    return listProductsPage(ctx, args);
  },
  product: async (_: unknown, args: IdArgs, ctx: Context = createContext()) => {
    return getProductById(ctx, args);
  },
};

export const productMutationResolvers = {
  createProduct: async (_: unknown, args: CreateProductArgs, ctx: Context = createContext()) => {
    return createProduct(ctx, args);
  },
  updateProduct: async (_: unknown, args: UpdateProductArgs, ctx: Context = createContext()) => {
    return updateProduct(ctx, args);
  },
  deleteProduct: async (_: unknown, args: IdArgs, ctx: Context = createContext()) => {
    return deleteProduct(ctx, args);
  },
};
