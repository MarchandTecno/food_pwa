import { z } from 'zod';
import { parseLoginArgsOrThrow, parseRegisterArgsOrThrow } from '../../src/schemas/auth.schema';
import {
  parseCreateProductArgsOrThrow,
  parseListProductsArgsOrThrow,
  parseUpdateProductArgsOrThrow,
} from '../../src/schemas/products.schema';
import { parseCreateOrderArgsOrThrow, parseListOrdersArgsOrThrow } from '../../src/schemas/orders.schema';
import {
  parseAdminCreateUserArgsOrThrow,
  parseAdminListSessionLogsArgsOrThrow,
  parseAdminUpdateUserAssignmentArgsOrThrow,
} from '../../src/schemas/adminUsers.schema';
import { parseAdminListAuditLogsArgsOrThrow as parseAdminAuditLogsArgsOrThrow } from '../../src/schemas/adminObservability.schema';
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

  it('validates admin user role scope rules for tenant and branch bindings', () => {
    expectBadUserInput(
      () =>
        parseAdminCreateUserArgsOrThrow({
          input: {
            nombre: 'Owner User',
            email: 'owner@tenant.test',
            password: 'Password123!',
            role: 'OWNER',
          },
        }),
      'tenant_id',
    );

    expectBadUserInput(
      () =>
        parseAdminCreateUserArgsOrThrow({
          input: {
            nombre: 'Kitchen User',
            email: 'kitchen@tenant.test',
            password: 'Password123!',
            role: 'KITCHEN',
            tenant_id: 'tenant_1',
          },
        }),
      'branch_id',
    );

    const superAdminUser = parseAdminCreateUserArgsOrThrow({
      input: {
        nombre: 'Super Admin',
        email: 'superadmin@foodflow.local',
        password: 'Password123!',
        role: 'SUPERADMIN',
      },
    });

    expect(superAdminUser.input.tenant_id).toBeUndefined();
    expect(superAdminUser.input.branch_id).toBeUndefined();
  });

  it('requires mutable fields on admin update assignment payload', () => {
    expectBadUserInput(
      () =>
        parseAdminUpdateUserAssignmentArgsOrThrow({
          input: {
            user_id: 'user_1',
          },
        }),
      'at least one mutable field must be provided',
    );
  });

  it('requires strong password policy for admin user create/reset', () => {
    expectBadUserInput(
      () =>
        parseAdminCreateUserArgsOrThrow({
          input: {
            nombre: 'Weak User',
            email: 'weak@tenant.test',
            password: 'password123!',
            role: 'OWNER',
            tenant_id: 'tenant_1',
          },
        }),
      'password',
    );
  });

  it('normalizes search filter in admin session logs args', () => {
    const parsed = parseAdminListSessionLogsArgsOrThrow({
      limit: 25,
      offset: 0,
      filter: {
        search: '   login_ok   ',
      },
    });

    expect(parsed.filter?.search).toBe('login_ok');
  });

  it('normalizes admin audit filters and validates chronological date ranges', () => {
    const parsed = parseAdminAuditLogsArgsOrThrow({
      limit: 25,
      offset: 0,
      filter: {
        actor_search: '  supervisor@foodflow.test ',
        entity: ' ORDERS ',
        action: ' delete_order ',
        from: '2026-03-15T10:00:00.000Z',
        to: '2026-03-15T11:00:00.000Z',
      },
    });

    expect(parsed.filter?.actor_search).toBe('supervisor@foodflow.test');
    expect(parsed.filter?.entity).toBe('orders');
    expect(parsed.filter?.action).toBe('DELETE_ORDER');

    expectBadUserInput(
      () =>
        parseAdminAuditLogsArgsOrThrow({
          filter: {
            from: '2026-03-15T11:00:00.000Z',
            to: '2026-03-15T10:00:00.000Z',
          },
        }),
      'filter.from',
    );
  });
});
