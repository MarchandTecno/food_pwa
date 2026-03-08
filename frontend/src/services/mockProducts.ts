import type { HighlightItem, MenuCategory } from '../types/product';

export const menuCategories: MenuCategory[] = [
  'Recomendados',
  'MasOrdenado',
  'Especialidades',
  'Ofertas',
];

export const highlightItems: HighlightItem[] = [
  { id: 'h1', title: 'Combo Monday', subtitle: 'Burger + soda', emoji: '🍔🥤' },
  { id: 'h2', title: 'Hot Dog Classic', subtitle: 'Con papas crujientes', emoji: '🌭🍟' },
  { id: 'h3', title: 'Snack Box', subtitle: 'Nachos + dipping', emoji: '🥨🧀' },
];
