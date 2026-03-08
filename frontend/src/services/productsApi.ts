import type { MenuCategory, Product } from '../types/product';

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT?.trim() || 'http://localhost:4001/graphql';

const PRODUCTS_QUERY = `
  query ClientProducts($filter: ProductFilterInput, $sort: ProductSortInput) {
    products(filter: $filter, sort: $sort) {
      id
      nombre
      descripcion
      precio_venta
      imagen_url
      is_available
    }
  }
`;

interface GraphQLError {
  message: string;
}

interface ProductsResponse {
  data?: {
    products?: ApiProduct[];
  };
  errors?: GraphQLError[];
}

interface ApiProduct {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  precio_venta: number | null;
  imagen_url: string | null;
  is_available: boolean | null;
}

function inferCategory(name: string, description: string): MenuCategory {
  const searchableText = `${name} ${description}`.toLowerCase();

  if (searchableText.includes('oferta') || searchableText.includes('combo') || searchableText.includes('promo')) {
    return 'Ofertas';
  }

  if (searchableText.includes('hot dog') || searchableText.includes('perro')) {
    return 'MasOrdenado';
  }

  if (searchableText.includes('especial') || searchableText.includes('nacho') || searchableText.includes('gourmet')) {
    return 'Especialidades';
  }

  return 'Recomendados';
}

function inferEmoji(name: string, description: string): string {
  const searchableText = `${name} ${description}`.toLowerCase();

  if (searchableText.includes('hot dog') || searchableText.includes('perro')) return '🌭';
  if (searchableText.includes('nacho') || searchableText.includes('papas') || searchableText.includes('fries')) return '🍟';
  if (searchableText.includes('pollo') || searchableText.includes('chicken')) return '🍗';
  if (searchableText.includes('bebida') || searchableText.includes('soda') || searchableText.includes('cola')) return '🥤';

  return '🍔';
}

function mapApiProductToProduct(item: ApiProduct): Product {
  const name = item.nombre?.trim() || 'Producto';
  const description = item.descripcion?.trim() || 'Sin descripción';
  const category = inferCategory(name, description);

  return {
    id: item.id,
    name,
    description,
    category,
    price: item.precio_venta ?? 0,
    emoji: inferEmoji(name, description),
    imageUrl: item.imagen_url ?? undefined,
  };
}

export async function fetchAvailableProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: PRODUCTS_QUERY,
      variables: {
        filter: { is_available: true },
        sort: { field: 'nombre', direction: 'asc' },
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar productos (${response.status})`);
  }

  const payload = (await response.json()) as ProductsResponse;

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message || 'Error inesperado en GraphQL');
  }

  return (payload.data?.products ?? []).map(mapApiProductToProduct);
}
