import { z } from 'zod';
import { parseLoginArgsOrThrow, parseRegisterArgsOrThrow } from '../../src/schemas/auth.schema';
import {
  parseCreateProductArgsOrThrow,
  parseListProductsArgsOrThrow,
  parseUpdateProductArgsOrThrow,
} from '../../src/schemas/products.schema';
import { parseCreateOrderArgsOrThrow, parseListOrdersArgsOrThrow } from '../../src/schemas/orders.schema';
import { parseOrThrow } from '../../src/schemas/schemaUtils';

function expectBadUserInput(fn: () => unknown, pathFragment: string) {
  try {
    fn();
    throw new Error('Expected BAD_USER_INPUT error');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('BAD_USER_INPUT');
    expect(message).toContain(pathFragment);
  }
}

describe('schemas validation', () => {
  it('normalizes login and register auth fields', () => {
    const login = parseLoginArgsOrThrow({
      email: '  USER@MAIL.COM ',
      password: 'Password123',
    });

    expect(login.email).toBe('user@mail.com');
    expect(login.password).toBe('Password123');

    const register = parseRegisterArgsOrThrow({
      email: '  New@Mail.COM ',
      password: 'Password123',
      nombre: '  Juan  ',
    });

    expect(register.email).toBe('new@mail.com');
    expect(register.nombre).toBe('Juan');
  });

  it('rejects invalid auth payloads', () => {
    expectBadUserInput(
      () =>
        parseLoginArgsOrThrow({
          email: 'not-an-email',
          password: 'Password123',
        }),
      'email',
    );

    expectBadUserInput(
      () =>
        parseRegisterArgsOrThrow({
          email: 'valid@mail.com',
          password: 'short',
        }),
      'password',
    );
  });

  it('enforces cursor/offset exclusivity for products and orders pagination', () => {
    expectBadUserInput(
      () =>
        parseListProductsArgsOrThrow({
          cursor: 'prod_1',
          offset: 10,
        }),
      'offset and cursor cannot be used together',
    );

    expectBadUserInput(
      () =>
        parseListOrdersArgsOrThrow({
          cursor: 'ord_1',
          offset: 5,
        }),
      'offset and cursor cannot be used together',
    );
  });

  it('requires at least one mutable field on update product', () => {
    expectBadUserInput(
      () =>
        parseUpdateProductArgsOrThrow({
          id: 'prod_1',
        }),
      'at least one field must be provided to updateProduct',
    );
  });

  it('validates create product and create order constraints', () => {
    const product = parseCreateProductArgsOrThrow({
      nombre: '  Hamburguesa  ',
      precio_venta: 100,
    });
    expect(product.nombre).toBe('Hamburguesa');

    expectBadUserInput(
      () =>
        parseCreateOrderArgsOrThrow({
          customer_name: 'Cliente',
          customer_whatsapp: '+521111111111',
          payment_method_id: 0,
          items: [{ product_id: 'p1', cantidad: 1 }],
        }),
      'payment_method_id',
    );

    expectBadUserInput(
      () =>
        parseCreateOrderArgsOrThrow({
          customer_name: 'Cliente',
          customer_whatsapp: '+521111111111',
          items: [],
        }),
      'items',
    );
  });

  it('parseOrThrow reports issue path from nested fields', () => {
    const nestedSchema = z.object({
      payload: z.object({
        amount: z.number().min(1),
      }),
    });

    expectBadUserInput(
      () =>
        parseOrThrow(nestedSchema, {
          payload: { amount: 0 },
        }),
      'payload.amount',
    );
  });
});
