import type { MenuCategory } from '../types/product';

interface CategoryTabsProps {
  categories: MenuCategory[];
  activeCategory: MenuCategory;
  onSelect: (category: MenuCategory) => void;
}

export function CategoryTabs({ categories, activeCategory, onSelect }: CategoryTabsProps) {
  return (
    <nav className="tabs" aria-label="Categorías del menú">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={category === activeCategory ? 'tab tab-active' : 'tab'}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </nav>
  );
}
