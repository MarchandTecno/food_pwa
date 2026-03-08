import { useEffect, useMemo, useState } from 'react';
import { CategoryTabs } from '../components/CategoryTabs';
import { FloatingCartButton } from '../components/FloatingCartButton';
import { ImageCarousel } from '../components/ImageCarousel';
import { ProductList } from '../components/ProductList';
import { highlightItems, menuCategories } from '../services/mockProducts';
import { fetchAvailableProducts } from '../services/productsApi';
import type { MenuCategory } from '../types/product';
import type { Product } from '../types/product';

export function ClientHomePage() {
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('Recomendados');
  const [cartCount, setCartCount] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const items = await fetchAvailableProducts(controller.signal);
        setProducts(items);
      } catch (error) {
        if (controller.signal.aborted) return;

        const message = error instanceof Error ? error.message : 'No se pudieron cargar los productos';
        setErrorMessage(message);
        setProducts([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  const handleAddProduct = () => {
    setCartCount((prev) => prev + 1);
  };

  return (
    <main className="client-home">
      <header className="hero">
        <h1>2x1 Comida</h1>
        <p>Promociones visuales, rápidas y listas para ordenar.</p>
      </header>

      <ImageCarousel items={highlightItems} />
      <CategoryTabs
        categories={menuCategories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />
      {isLoading ? <p className="status-message">Cargando menú...</p> : null}
      {errorMessage ? <p className="status-message status-error">{errorMessage}</p> : null}
      {!isLoading && !errorMessage ? <ProductList products={filteredProducts} onAdd={handleAddProduct} /> : null}
      <FloatingCartButton count={cartCount} />
    </main>
  );
}
