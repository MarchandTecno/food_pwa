import { useMemo, useState } from 'react';
import type { HighlightItem } from '../types/product';

interface ImageCarouselProps {
  items: HighlightItem[];
}

export function ImageCarousel({ items }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeItem = useMemo(() => items[activeIndex], [items, activeIndex]);

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <section className="carousel" aria-label="Productos destacados">
      <button type="button" className="carousel-nav" onClick={goPrev} aria-label="Anterior">
        ‹
      </button>
      <article className="carousel-card">
        <p className="carousel-tag">Lunes</p>
        <h2>{activeItem.title}</h2>
        <p>{activeItem.subtitle}</p>
        <div className="carousel-emoji" aria-hidden="true">
          {activeItem.emoji}
        </div>
      </article>
      <button type="button" className="carousel-nav" onClick={goNext} aria-label="Siguiente">
        ›
      </button>
      <div className="carousel-dots" role="tablist" aria-label="Selector de destacados">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={index === activeIndex ? 'dot dot-active' : 'dot'}
            onClick={() => setActiveIndex(index)}
            aria-label={`Ir a ${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}
