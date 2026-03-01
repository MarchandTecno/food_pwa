import type { order_items, orders, products, users } from '@prisma/client';
import { toOrderListOutput, toOrderOutput } from '../../src/models/order.model';

describe('models/order.model', () => {
  it('maps order with nested user and items including product relation', () => {
    const user = {
      id: 'u1',
      email: 'u1@test.com',
      nombre: 'User 1',
    } as unknown as users;

    const product = {
      id: 'p1',
      nombre: 'Burger',
      descripcion: null,
      precio_venta: '50.25',
      imagen_url: null,
      is_available: true,
    } as unknown as products;

    const item = {
      id: 'oi1',
      product_id: 'p1',
      cantidad: 2,
      precio_unitario_snapshot: '50.25',
      subtotal_item: '100.50',
      products: product,
    } as unknown as order_items & { products?: products | null };

    const order = {
      id: 'o1',
      user_id: 'u1',
      customer_name: 'Cliente',
      customer_whatsapp: '+521111111111',
      subtotal: '100.50',
      total_neto: '100.50',
      status: 'PENDIENTE',
      order_items: [item],
      users: user,
      created_at: new Date('2026-01-03T00:00:00.000Z'),
    } as unknown as orders & { order_items?: Array<order_items & { products?: products | null }>; users?: users | null };

    const dto = toOrderOutput(order);

    expect(dto.id).toBe('o1');
    expect(dto.subtotal).toBe(100.5);
    expect(dto.total_neto).toBe(100.5);
    expect(dto.users?.email).toBe('u1@test.com');
    expect(dto.order_items?.[0]?.precio_unitario_snapshot).toBe(50.25);
    expect(dto.order_items?.[0]?.subtotal_item).toBe(100.5);
    expect(dto.order_items?.[0]?.products?.precio_venta).toBe(50.25);
  });

  it('maps order list output', () => {
    const ordersList = [
      {
        id: 'o1',
        user_id: null,
        customer_name: 'A',
        customer_whatsapp: null,
        subtotal: 10,
        total_neto: 10,
        status: 'PENDIENTE',
        created_at: null,
      },
      {
        id: 'o2',
        user_id: null,
        customer_name: 'B',
        customer_whatsapp: null,
        subtotal: 20,
        total_neto: 20,
        status: 'CONFIRMADO',
        created_at: null,
      },
    ] as unknown as orders[];

    const output = toOrderListOutput(ordersList);

    expect(output).toHaveLength(2);
    expect(output[0].id).toBe('o1');
    expect(output[1].total_neto).toBe(20);
  });
});
