import { ApolloServer } from '@apollo/server';
import type { NextFunction, Request, Response } from 'express';
import { typeDefs, resolvers } from '../src/schema';
import { createContext, prisma } from '../src/context';
import { graphqlRateLimitMiddleware } from '../src/config/security';
import { createGraphqlObservabilityPlugin } from '../src/middleware/graphqlObservability';

type SingleResult = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

let server: ApolloServer;

function buildContext(token?: string) {
  if (!token) return createContext();

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  } as unknown as Request;

  return createContext(req);
}

function buildContextWithAuthHeader(authorization?: string) {
  if (!authorization) return createContext();

  const req = {
    headers: {
      authorization,
    },
  } as unknown as Request;

  return createContext(req);
}

async function executeGraphQL(query: string, variables?: Record<string, unknown>, token?: string): Promise<SingleResult> {
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: buildContext(token) } as any,
  );

  if (response.body.kind !== 'single') {
    throw new Error('Expected single GraphQL response body');
  }

  return response.body.singleResult as SingleResult;
}

async function executeGraphQLWithAuthHeader(
  query: string,
  variables?: Record<string, unknown>,
  authorization?: string,
): Promise<SingleResult> {
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: buildContextWithAuthHeader(authorization) } as any,
  );

  if (response.body.kind !== 'single') {
    throw new Error('Expected single GraphQL response body');
  }

  return response.body.singleResult as SingleResult;
}

async function registerAndGetToken(email: string, nombre: string): Promise<string> {
  const registerResult = await executeGraphQL(
    `
    mutation Register($email: String!, $password: String!, $nombre: String!) {
      register(email: $email, password: $password, nombre: $nombre) {
        token
      }
    }
    `,
    {
      email,
      password: 'TestPassword123!',
      nombre,
    },
  );

  expect(registerResult.errors).toBeUndefined();
  const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
  expect(token).toBeTruthy();
  return String(token);
}

describe('GraphQL integration', () => {
  beforeAll(async () => {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [createGraphqlObservabilityPlugin()],
    } as any);
    await server.start();

    const productsCount = await prisma.products.count({
      where: { is_available: true },
    });

    if (productsCount === 0) {
      await prisma.products.create({
        data: {
          nombre: `Producto Test Base ${Date.now()}`,
          descripcion: 'Producto semilla para pruebas de integración',
          precio_venta: 99,
          is_available: true,
        },
      });
    }
  });

  afterAll(async () => {
    await server.stop();
    await prisma.$disconnect();
  });

  it('returns products without authentication', async () => {
    const result = await executeGraphQL(`
      query {
        products {
          id
          nombre
          precio_venta
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    const products = (result.data?.products as Array<Record<string, unknown>>) ?? [];
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].id).toBeTruthy();
    expect(products[0].nombre).toBeTruthy();
  });

  it('returns UNAUTHENTICATED for me without token', async () => {
    const result = await executeGraphQL(`
      query {
        me {
          id
          email
        }
      }
    `);

    expect(result.data?.me ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('includes errorId in GraphQL error extensions for trace correlation', async () => {
    const result = await executeGraphQL(`
      query {
        me {
          id
        }
      }
    `);

    expect(result.data?.me ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    expect(typeof result.errors?.[0]?.extensions?.errorId).toBe('string');
    expect(String(result.errors?.[0]?.extensions?.errorId)).toContain('graphql-error-');
  });

  it('registers user and resolves me with token', async () => {
    const uniqueEmail = `integration.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
          user {
            id
            email
            nombre
          }
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Integration User',
      },
    );

    expect(registerResult.errors).toBeUndefined();
    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const meResult = await executeGraphQL(
      `
      query {
        me {
          id
          email
          nombre
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(meResult.errors).toBeUndefined();
    const me = meResult.data?.me as Record<string, unknown>;
    expect(me.email).toBe(uniqueEmail);
  });

  it('creates order and lists orders with authentication', async () => {
    const uniqueEmail = `orders.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Order User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const productsResult = await executeGraphQL(
      `
      query {
        products {
          id
          precio_venta
        }
      }
      `,
      undefined,
      String(token),
    );

    const products = (productsResult.data?.products as Array<Record<string, unknown>>) ?? [];
    expect(products.length).toBeGreaterThan(0);
    const productId = String(products[0].id);

    const createOrderResult = await executeGraphQL(
      `
      mutation CreateOrder($productId: String!) {
        createOrder(
          customer_name: "Cliente Integracion"
          customer_whatsapp: "+56911111111"
          items: [{ product_id: $productId, cantidad: 2 }]
        ) {
          id
          status
          subtotal
          order_items {
            id
            cantidad
            subtotal_item
          }
        }
      }
      `,
      { productId },
      String(token),
    );

    expect(createOrderResult.errors).toBeUndefined();
    const createdOrder = createOrderResult.data?.createOrder as Record<string, unknown>;
    expect(createdOrder.id).toBeTruthy();
    expect(createdOrder.status).toBe('PENDIENTE');

    const ordersResult = await executeGraphQL(
      `
      query {
        orders(limit: 50) {
          id
          status
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(ordersResult.errors).toBeUndefined();
    const orders = (ordersResult.data?.orders as Array<Record<string, unknown>>) ?? [];
    expect(orders.some((order) => order.id === createdOrder.id)).toBe(true);
  });

  it('returns page metadata for productsPage and ordersPage', async () => {
    const uniqueEmail = `page.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Page User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const productsPageResult = await executeGraphQL(
      `
      query {
        productsPage(limit: 1, sort: { field: nombre, direction: asc }) {
          items {
            id
            nombre
          }
          pageInfo {
            total
            hasNextPage
            nextCursor
            limit
            offset
          }
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(productsPageResult.errors).toBeUndefined();
    const productsPage = productsPageResult.data?.productsPage as Record<string, unknown>;
    const productsItems = (productsPage.items as Array<Record<string, unknown>>) ?? [];
    const productsPageInfo = productsPage.pageInfo as Record<string, unknown>;
    expect(productsPageInfo.total).toEqual(expect.any(Number));
    expect(productsPageInfo.limit).toBe(1);
    expect(productsItems.length).toBeLessThanOrEqual(1);

    if (!productsItems[0]?.id) {
      throw new Error('Expected at least one product to create an order in pagination test');
    }

    await executeGraphQL(
      `
      mutation CreateOrder($productId: String!) {
        createOrder(
          customer_name: "Cliente Paginacion"
          customer_whatsapp: "+56911111111"
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
        }
      }
      `,
      { productId: String(productsItems[0].id) },
      String(token),
    );

    const ordersPageResult = await executeGraphQL(
      `
      query {
        ordersPage(limit: 1, sort: { field: created_at, direction: desc }) {
          items {
            id
            customer_name
          }
          pageInfo {
            total
            hasNextPage
            nextCursor
            limit
            offset
          }
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(ordersPageResult.errors).toBeUndefined();
    const ordersPage = ordersPageResult.data?.ordersPage as Record<string, unknown>;
    const ordersItems = (ordersPage.items as Array<Record<string, unknown>>) ?? [];
    const ordersPageInfo = ordersPage.pageInfo as Record<string, unknown>;
    expect(ordersPageInfo.total).toEqual(expect.any(Number));
    expect(ordersPageInfo.limit).toBe(1);
    expect(ordersItems.length).toBeGreaterThan(0);
    expect(ordersItems[0].customer_name).toBeTruthy();
  });

  it('returns NOT_FOUND when creating order with unknown product', async () => {
    const uniqueEmail = `orders-negative.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Order Negative User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const createOrderResult = await executeGraphQL(
      `
      mutation CreateOrder($productId: String!) {
        createOrder(
          customer_name: "Cliente Integracion"
          customer_whatsapp: "+56911111111"
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
        }
      }
      `,
      { productId: '00000000-0000-0000-0000-000000009999' },
      String(token),
    );

    expect(createOrderResult.data?.createOrder ?? null).toBeNull();
    expect(createOrderResult.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('returns BAD_USER_INPUT when login password is invalid', async () => {
    const uniqueEmail = `login-negative.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          user {
            id
          }
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'CorrectPassword123!',
        nombre: 'Login Negative User',
      },
    );

    expect(registerResult.errors).toBeUndefined();

    const loginResult = await executeGraphQL(
      `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'WrongPassword123!',
      },
    );

    expect(loginResult.data?.login ?? null).toBeNull();
    expect(loginResult.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns generic register error for duplicate email without exposing existence details', async () => {
    const uniqueEmail = `duplicate-register.${Date.now()}@foodflow.test`;

    const firstRegister = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          user {
            id
          }
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Duplicate Register User',
      },
    );

    expect(firstRegister.errors).toBeUndefined();

    const duplicateRegister = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Duplicate Register User',
      },
    );

    expect(duplicateRegister.data?.register ?? null).toBeNull();
    expect(duplicateRegister.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(duplicateRegister.errors?.[0]?.message).toContain('registration request could not be completed');
  });

  it('returns uniform credentials error for unknown user and wrong password', async () => {
    const uniqueEmail = `uniform-login.${Date.now()}@foodflow.test`;

    await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          user {
            id
          }
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'CorrectPassword123!',
        nombre: 'Uniform Login User',
      },
    );

    const wrongPasswordResult = await executeGraphQL(
      `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'WrongPassword123!',
      },
    );

    const unknownUserResult = await executeGraphQL(
      `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
        }
      }
      `,
      {
        email: `unknown.${Date.now()}@foodflow.test`,
        password: 'WrongPassword123!',
      },
    );

    expect(wrongPasswordResult.data?.login ?? null).toBeNull();
    expect(unknownUserResult.data?.login ?? null).toBeNull();
    expect(wrongPasswordResult.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(unknownUserResult.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(wrongPasswordResult.errors?.[0]?.message).toBe(unknownUserResult.errors?.[0]?.message);
  });

  it('returns BAD_USER_INPUT when orders filter status is outside catalog', async () => {
    const uniqueEmail = `status-filter.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Status Filter User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const result = await executeGraphQL(
      `
      query {
        orders(filter: { status: "CUALQUIER_COSA" }) {
          id
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(result.data?.orders ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns BAD_USER_INPUT when orders date_range is invalid', async () => {
    const uniqueEmail = `date-filter.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Date Filter User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const result = await executeGraphQL(
      `
      query {
        orders(filter: { date_range: { from: "2026-12-31", to: "2026-01-01" } }) {
          id
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(result.data?.orders ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns BAD_USER_INPUT when createOrder items is empty', async () => {
    const uniqueEmail = `empty-items.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Empty Items User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const result = await executeGraphQL(
      `
      mutation {
        createOrder(customer_name: "Cliente", customer_whatsapp: "+56911111111", items: []) {
          id
        }
      }
      `,
      undefined,
      String(token),
    );

    expect(result.data?.createOrder ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns FORBIDDEN when createOrder includes inactive product', async () => {
    const uniqueEmail = `inactive-product.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Inactive Product User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const inactiveProduct = await prisma.products.create({
      data: {
        nombre: `Producto Inactivo ${Date.now()}`,
        precio_venta: 120,
        is_available: false,
      },
    });

    const result = await executeGraphQL(
      `
      mutation CreateOrder($productId: String!) {
        createOrder(
          customer_name: "Cliente"
          customer_whatsapp: "+56911111111"
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
        }
      }
      `,
      { productId: inactiveProduct.id },
      String(token),
    );

    expect(result.data?.createOrder ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('creates order with customer, address and payment method (MVP flow)', async () => {
    const uniqueEmail = `related-flow.${Date.now()}@foodflow.test`;

    const registerResult = await executeGraphQL(
      `
      mutation Register($email: String!, $password: String!, $nombre: String!) {
        register(email: $email, password: $password, nombre: $nombre) {
          token
        }
      }
      `,
      {
        email: uniqueEmail,
        password: 'TestPassword123!',
        nombre: 'Related Flow User',
      },
    );

    const token = registerResult.data?.register && (registerResult.data.register as Record<string, unknown>).token;
    expect(token).toBeTruthy();

    const availableProduct = await prisma.products.findFirst({ where: { is_available: true } });
    if (!availableProduct) {
      throw new Error('Expected at least one available product for related entities test');
    }

    const customer = await prisma.customers.create({
      data: {
        nombre: `Cliente Rel ${Date.now()}`,
      },
    });

    const address = await prisma.customer_addresses.create({
      data: {
        customer_id: customer.id,
        etiqueta: 'Casa',
      },
    });

    let paymentMethod = await prisma.payment_methods.findFirst({
      orderBy: { id: 'desc' },
    });

    if (!paymentMethod) {
      paymentMethod = await prisma.payment_methods.create({
        data: {
          id: 1,
          nombre: `MVP_${Date.now()}`,
        },
      });
    }

    const result = await executeGraphQL(
      `
      mutation CreateOrder($productId: String!, $customerId: String!, $addressId: String!, $paymentMethodId: Int!) {
        createOrder(
          customer_name: "Cliente Rel"
          customer_whatsapp: "+56922222222"
          customer_id: $customerId
          address_id: $addressId
          payment_method_id: $paymentMethodId
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
          customer_name
          status
        }
      }
      `,
      {
        productId: availableProduct.id,
        customerId: customer.id,
        addressId: address.id,
        paymentMethodId: paymentMethod.id,
      },
      String(token),
    );

    expect(result.errors).toBeUndefined();
    const created = result.data?.createOrder as Record<string, unknown>;
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('PENDIENTE');
  });

  it('returns BAD_USER_INPUT for productsPage when cursor and offset are sent together', async () => {
    const token = await registerAndGetToken(`products-page-invalid.${Date.now()}@foodflow.test`, 'Products Invalid Page');

    const firstPage = await executeGraphQL(
      `
      query {
        productsPage(limit: 1, sort: { field: nombre, direction: asc }) {
          pageInfo {
            nextCursor
          }
        }
      }
      `,
      undefined,
      token,
    );

    expect(firstPage.errors).toBeUndefined();
    const nextCursor = ((firstPage.data?.productsPage as Record<string, unknown>)?.pageInfo as Record<string, unknown>)
      ?.nextCursor;

    const invalidPage = await executeGraphQL(
      `
      query ProductsInvalidPagination($cursor: String!) {
        productsPage(limit: 1, offset: 1, cursor: $cursor, sort: { field: nombre, direction: asc }) {
          items {
            id
          }
        }
      }
      `,
      { cursor: String(nextCursor ?? 'fallback-cursor') },
      token,
    );

    expect(invalidPage.data?.productsPage ?? null).toBeNull();
    expect(invalidPage.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('filters orders by status in ordersPage', async () => {
    const token = await registerAndGetToken(`orders-filter.${Date.now()}@foodflow.test`, 'Orders Filter User');

    const productsResult = await executeGraphQL(
      `
      query {
        products(limit: 1) {
          id
        }
      }
      `,
      undefined,
      token,
    );

    const productId = String((((productsResult.data?.products as Array<Record<string, unknown>>) ?? [])[0] ?? {}).id ?? '');
    expect(productId).toBeTruthy();

    const createResult = await executeGraphQL(
      `
      mutation CreateOrderForStatus($productId: String!) {
        createOrder(
          customer_name: "Cliente Estado"
          customer_whatsapp: "+56911111111"
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
        }
      }
      `,
      { productId },
      token,
    );

    expect(createResult.errors).toBeUndefined();
    const orderId = String((createResult.data?.createOrder as Record<string, unknown>).id);

    const updateResult = await executeGraphQL(
      `
      mutation UpdateOrderStatus($id: String!) {
        updateOrderStatus(id: $id, status: "CONFIRMADO") {
          id
          status
        }
      }
      `,
      { id: orderId },
      token,
    );

    expect(updateResult.errors).toBeUndefined();
    expect((updateResult.data?.updateOrderStatus as Record<string, unknown>).status).toBe('CONFIRMADO');

    const filtered = await executeGraphQL(
      `
      query {
        ordersPage(limit: 20, filter: { status: "CONFIRMADO" }, sort: { field: created_at, direction: desc }) {
          items {
            id
            status
          }
        }
      }
      `,
      undefined,
      token,
    );

    expect(filtered.errors).toBeUndefined();
    const items = ((filtered.data?.ordersPage as Record<string, unknown>).items as Array<Record<string, unknown>>) ?? [];
    expect(items.some((item) => item.id === orderId)).toBe(true);
    expect(items.every((item) => item.status === 'CONFIRMADO')).toBe(true);
  });

  it('returns BAD_USER_INPUT when createOrder payment_method_id is invalid', async () => {
    const token = await registerAndGetToken(`payment-invalid.${Date.now()}@foodflow.test`, 'Payment Invalid User');

    const product = await prisma.products.findFirst({ where: { is_available: true } });
    if (!product) {
      throw new Error('Expected available product for payment_method_id validation test');
    }

    const result = await executeGraphQL(
      `
      mutation CreateOrderWithInvalidPayment($productId: String!) {
        createOrder(
          customer_name: "Cliente"
          customer_whatsapp: "+56933333333"
          payment_method_id: 0
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
        }
      }
      `,
      { productId: product.id },
      token,
    );

    expect(result.data?.createOrder ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('writes order_status_history and audit_logs when order status changes', async () => {
    const token = await registerAndGetToken(`status-history.${Date.now()}@foodflow.test`, 'Status History User');

    const product = await prisma.products.findFirst({ where: { is_available: true } });
    if (!product) {
      throw new Error('Expected available product for status history test');
    }

    const createResult = await executeGraphQL(
      `
      mutation CreateOrderForHistory($productId: String!) {
        createOrder(
          customer_name: "Cliente Historial"
          customer_whatsapp: "+56944444444"
          items: [{ product_id: $productId, cantidad: 1 }]
        ) {
          id
          user_id
        }
      }
      `,
      { productId: product.id },
      token,
    );

    expect(createResult.errors).toBeUndefined();
    const createdOrder = createResult.data?.createOrder as Record<string, unknown>;
    const orderId = String(createdOrder.id);
    const userId = String(createdOrder.user_id);

    const updateResult = await executeGraphQL(
      `
      mutation UpdateOrderForHistory($id: String!) {
        updateOrderStatus(id: $id, status: "CONFIRMADO") {
          id
          status
        }
      }
      `,
      { id: orderId },
      token,
    );

    expect(updateResult.errors).toBeUndefined();

    const historyRows = await prisma.order_status_history.findMany({
      where: { order_id: orderId },
      orderBy: { changed_at: 'asc' },
    });

    expect(historyRows.length).toBeGreaterThanOrEqual(2);
    expect(historyRows[0]?.status_nuevo).toBe('PENDIENTE');
    expect(historyRows.some((row) => row.status_anterior === 'PENDIENTE' && row.status_nuevo === 'CONFIRMADO')).toBe(
      true,
    );

    const auditRows = await prisma.audit_logs.findMany({
      where: {
        tabla_afectada: 'orders',
        registro_id: orderId,
        user_id: userId,
        accion: { in: ['CREATE_ORDER', 'UPDATE_ORDER'] },
      },
    });

    const actions = auditRows.map((row) => row.accion);
    expect(actions).toEqual(expect.arrayContaining(['CREATE_ORDER', 'UPDATE_ORDER']));
  });

  it('enforces tenant isolation between users from different tenants', async () => {
    const now = Date.now();
    const emailA = `tenant-a.${now}@foodflow.test`;
    const emailB = `tenant-b.${now}@foodflow.test`;

    const tokenA = await registerAndGetToken(emailA, 'Tenant User A');
    const tokenB = await registerAndGetToken(emailB, 'Tenant User B');

    const [userA, userB] = await Promise.all([
      prisma.users.findUnique({ where: { email: emailA } }),
      prisma.users.findUnique({ where: { email: emailB } }),
    ]);

    if (!userA || !userB) {
      throw new Error('Expected registered users for tenant isolation test');
    }

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenants.create({
        data: {
          nombre_comercial: `Tenant A ${now}`,
          email_admin: `tenant-admin-a.${now}@foodflow.test`,
        },
      }),
      prisma.tenants.create({
        data: {
          nombre_comercial: `Tenant B ${now}`,
          email_admin: `tenant-admin-b.${now}@foodflow.test`,
        },
      }),
    ]);

    await Promise.all([
      prisma.users.update({ where: { id: userA.id }, data: { tenant_id: tenantA.id } }),
      prisma.users.update({ where: { id: userB.id }, data: { tenant_id: tenantB.id } }),
    ]);

    const product = await prisma.products.findFirst({ where: { is_available: true } });
    if (!product) {
      throw new Error('Expected available product for tenant isolation test');
    }

    const createOrderForUser = async (token: string, suffix: string): Promise<string> => {
      const result = await executeGraphQL(
        `
        mutation CreateOrderByTenant($productId: String!, $customerName: String!, $whatsapp: String!) {
          createOrder(
            customer_name: $customerName
            customer_whatsapp: $whatsapp
            items: [{ product_id: $productId, cantidad: 1 }]
          ) {
            id
          }
        }
        `,
        {
          productId: product.id,
          customerName: `Cliente ${suffix}`,
          whatsapp: `+56977${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        },
        token,
      );

      expect(result.errors).toBeUndefined();
      return String((result.data?.createOrder as Record<string, unknown>).id);
    };

    const [orderAId, orderBId] = await Promise.all([
      createOrderForUser(tokenA, 'A'),
      createOrderForUser(tokenB, 'B'),
    ]);

    const userAOrders = await executeGraphQL(
      `
      query {
        orders(limit: 100) {
          id
        }
      }
      `,
      undefined,
      tokenA,
    );

    expect(userAOrders.errors).toBeUndefined();
    const orderIdsA = (((userAOrders.data?.orders as Array<Record<string, unknown>>) ?? []).map((row) => String(row.id)));
    expect(orderIdsA).toContain(orderAId);
    expect(orderIdsA).not.toContain(orderBId);

    const userAReadOrderB = await executeGraphQL(
      `
      query ReadOtherTenantOrder($id: String!) {
        order(id: $id) {
          id
        }
      }
      `,
      { id: orderBId },
      tokenA,
    );

    expect(userAReadOrderB.errors).toBeUndefined();
    expect(userAReadOrderB.data?.order ?? null).toBeNull();
  });

  it('returns UNAUTHENTICATED when Authorization header has malformed scheme', async () => {
    const result = await executeGraphQLWithAuthHeader(
      `
      query {
        me {
          id
        }
      }
      `,
      undefined,
      'Token malformed-value',
    );

    expect(result.data?.me ?? null).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('requires category_id when tenant-scoped user creates product', async () => {
    const now = Date.now();
    const email = `tenant-product.${now}@foodflow.test`;
    const token = await registerAndGetToken(email, 'Tenant Product User');

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Expected user for tenant product scope test');
    }

    const tenant = await prisma.tenants.create({
      data: {
        nombre_comercial: `Tenant Product ${now}`,
        email_admin: `tenant-product-admin.${now}@foodflow.test`,
      },
    });

    await prisma.users.update({
      where: { id: user.id },
      data: { tenant_id: tenant.id },
    });

    const createWithoutCategory = await executeGraphQL(
      `
      mutation {
        createProduct(nombre: "Producto Sin Categoria", precio_venta: 99) {
          id
        }
      }
      `,
      undefined,
      token,
    );

    expect(createWithoutCategory.data?.createProduct ?? null).toBeNull();
    expect(createWithoutCategory.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    const category = await prisma.categories.create({
      data: {
        tenant_id: tenant.id,
        nombre: `Categoria Tenant ${now}`,
      },
    });

    const createWithCategory = await executeGraphQL(
      `
      mutation CreateProductWithCategory($categoryId: String!) {
        createProduct(nombre: "Producto Tenant", precio_venta: 99, category_id: $categoryId) {
          id
          nombre
        }
      }
      `,
      { categoryId: category.id },
      token,
    );

    expect(createWithCategory.errors).toBeUndefined();
    expect((createWithCategory.data?.createProduct as Record<string, unknown>)?.id).toBeTruthy();
  });

  it('blocks auth mutation requests after rate-limit threshold', async () => {
    const query = 'mutation { login(email: "rate.limit@test", password: "invalid") { token } }';

    let blockedStatusCode: number | null = null;

    const invokeMiddleware = async () => {
      const req = {
        body: { query },
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const res = {
        status(code: number) {
          blockedStatusCode = code;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as Response;

      const next = jest.fn() as unknown as NextFunction;
      await graphqlRateLimitMiddleware(req, res, next);
      return next;
    };

    const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
    for (let index = 0; index < authLimit; index += 1) {
      const next = await invokeMiddleware();
      expect(next).toHaveBeenCalled();
      expect(blockedStatusCode).toBeNull();
    }

    const blockedNext = await invokeMiddleware();
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedStatusCode).toBe(429);
  });
});
