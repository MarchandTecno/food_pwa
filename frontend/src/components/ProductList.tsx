import type { Product } from '../types/product';

interface ProductListProps {
  products: Product[];
  onAdd: (productId: string) => void;
}

export function ProductList({ products, onAdd }: ProductListProps) {
  if (!products.length) {
    return <p className="empty-state">No hay productos para esta categoría.</p>;
  }

  return (
    <section className="product-list" aria-label="Lista de productos">
      {products.map((product) => (
        <article key={product.id} className="product-card">
          <div className="product-icon" aria-hidden="true">
            {product.emoji}
          </div>
          <div className="product-body">
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <span className="price">${product.price.toFixed(2)}</span>
          </div>
          <button
            type="button"
            className="add-button"
            onClick={() => onAdd(product.id)}
            aria-label={`Agregar ${product.name}`}
          >
            +
          </button>
        </article>
      ))}
    </section>
  );
}
