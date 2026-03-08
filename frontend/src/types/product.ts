export type MenuCategory = 'Recomendados' | 'MasOrdenado' | 'Especialidades' | 'Ofertas';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  emoji: string;
  imageUrl?: string;
}

export interface HighlightItem {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
}
