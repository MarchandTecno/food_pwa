interface FloatingCartButtonProps {
  count: number;
}

export function FloatingCartButton({ count }: FloatingCartButtonProps) {
  return (
    <button type="button" className="cart-fab" aria-label={`Carrito con ${count} productos`}>
      🛒
      <span className="cart-count">{count}</span>
    </button>
  );
}
