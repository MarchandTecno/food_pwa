import type { products } from '@prisma/client';
import { toProductListOutput, toProductOutput } from '../../src/models/product.model';

describe('models/product.model', () => {
  it('maps product fields to output DTO and normalizes numeric fields', () => {
    const product = {
      id: 'prod_1',
      nombre: 'Pizza',
      descripcion: 'Grande',
      precio_venta: '99.5',
      imagen_url: 'https://img.test/pizza.png',
      is_available: true,
    } as unknown as products;

    const dto = toProductOutput(product);

    expect(dto).toEqual({
      id: 'prod_1',
      nombre: 'Pizza',
      descripcion: 'Grande',
      precio_venta: 99.5,
      imagen_url: 'https://img.test/pizza.png',
      is_available: true,
    });
  });

  it('maps list of products', () => {
    const items = [
      {
        id: 'prod_1',
        nombre: 'A',
        descripcion: null,
        precio_venta: 10,
        imagen_url: null,
        is_available: true,
      },
      {
        id: 'prod_2',
        nombre: 'B',
        descripcion: null,
        precio_venta: 20,
        imagen_url: null,
        is_available: false,
      },
    ] as unknown as products[];

    const output = toProductListOutput(items);

    expect(output).toHaveLength(2);
    expect(output[0].id).toBe('prod_1');
    expect(output[1].precio_venta).toBe(20);
  });
});
