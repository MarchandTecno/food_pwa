# Guía de Diseño, Uso y Funcionalidad de Interfaces (Frontend)

## 1) Propósito
Definir las reglas de diseño, interacción y calidad para todas las interfaces del producto, priorizando:
- enfoque **mobile-first**,
- escalabilidad por componentes,
- diseño funcional y vistoso,
- adaptabilidad responsiva,
- alto rendimiento,
- tema visual **oscuro/nocturno** por defecto.

---

## 2) Principios de producto (obligatorios)
1. **Mobile-first real**: se diseña primero para móvil y luego se expande a tablet/desktop.
2. **Funcional antes que decorativo**: cada elemento visual debe apoyar una acción o decisión del usuario.
3. **Escalable por sistema**: construir con componentes reutilizables y reglas consistentes.
4. **Rápido por defecto**: interacción fluida incluso en dispositivos de gama media/baja.
5. **Accesible siempre**: contraste, navegación por teclado y semántica correcta.

---

## 3) Reglas de diseño visual

### 3.1 Tema
- El tema principal es **Dark/Night**.
- Se usan tokens semánticos (no colores hardcodeados en componentes):
  - `bg.app`, `bg.surface`, `bg.elevated`
  - `text.primary`, `text.secondary`, `text.muted`
  - `accent.primary`, `accent.secondary`, `accent.success`, `accent.warning`, `accent.error`
  - `border.default`, `border.strong`
- Evitar fondos con ruido visual que compitan con las fotos de productos.

### 3.2 Jerarquía visual
- Prioridad de lectura:
  1) promos/destacados,
  2) categorías,
  3) listas de productos,
  4) acciones globales (carrito, filtros, etc.).
- Tamaños y pesos tipográficos deben reflejar esta jerarquía.

### 3.3 Tipografía y espaciado
- Escala tipográfica consistente (ejemplo): `12 / 14 / 16 / 20 / 24 / 32`.
- Escala de espaciado basada en múltiplos de 4 (`4, 8, 12, 16, 24, 32`).
- Evitar textos largos en tarjetas; priorizar fragmentos breves y escaneables.

### 3.4 Iconografía e imágenes
- Iconos simples, legibles y consistentes en grosor.
- Imágenes de productos optimizadas y con proporciones consistentes.
- Evitar saturación excesiva de ilustraciones en zonas de alta interacción.

---

## 4) Reglas de interacción y uso

### 4.1 Navegación
- Navegación principal accesible con una mano en móvil.
- Acciones frecuentes al alcance del pulgar (zona inferior o lateral baja).
- El botón de carrito debe mantenerse visible sin tapar contenido crítico.

### 4.2 Carruseles y listas
- Carruseles: swipe táctil, indicadores visibles, comportamiento predecible.
- Listas: tarjetas con CTA claro (`Agregar`, `Ver detalle`, etc.).
- Nunca mezclar demasiados patrones de scroll en una sola vista.

### 4.3 Feedback del sistema
- Toda acción de usuario debe tener feedback inmediato:
  - estado de carga,
  - éxito,
  - error,
  - sin resultados.
- Evitar bloqueos de pantalla completos salvo en procesos críticos.

### 4.4 Formularios y entradas
- Etiquetas siempre visibles (no depender solo de placeholder).
- Validación en tiempo real no intrusiva.
- Mensajes de error claros, accionables y en lenguaje simple.

---

## 5) Reglas de responsividad y adaptabilidad
- Breakpoints orientativos:
  - `sm`: móviles,
  - `md`: tablet,
  - `lg+`: desktop.
- Cambios por breakpoint:
  - densidad de grilla,
  - tamaño de imagen,
  - número de columnas,
  - posición de elementos secundarios.
- Mantener consistencia: el usuario debe reconocer el mismo patrón en todos los tamaños.

---

## 6) Escalabilidad de arquitectura UI
- Estructura por capas recomendada:
  - `pages/` (composición de vistas),
  - `components/` (bloques reutilizables),
  - `hooks/` (lógica de UI),
  - `services/` (acceso a API),
  - `types/` (tipado compartido),
  - `styles/` (tokens/tema).
- Reglas:
  - componentes desacoplados,
  - props explícitas,
  - evitar lógica de negocio compleja dentro de componentes visuales,
  - reutilizar antes de crear uno nuevo.

---

## 7) Rendimiento (objetivo clave)

### 7.1 Carga y render
- Lazy loading para rutas y secciones pesadas.
- Optimización de imágenes (formatos modernos, tamaños adecuados).
- Evitar re-renderizados innecesarios (memoización cuando aplique).

### 7.2 Red y datos
- Minimizar payloads.
- Cachear datos de lectura frecuente cuando tenga sentido.
- Evitar llamadas duplicadas al entrar/salir de vistas.

### 7.3 Presupuesto de experiencia
- Primera interacción rápida en red móvil estable.
- Scroll fluido en listas/carruseles largos.
- No bloquear el hilo principal con operaciones pesadas de UI.

---

## 8) Accesibilidad (no negociable)
- Contraste suficiente en tema oscuro.
- Navegación por teclado funcional en componentes clave.
- `aria-label`/roles semánticos en controles interactivos.
- Objetivos táctiles cómodos en móvil (tamaño suficiente y separación).
- Estados de foco visibles y consistentes.

---

## 9) Consistencia funcional entre vistas
Cada vista cliente debe cubrir, como mínimo:
1. Estado de carga.
2. Estado con datos.
3. Estado vacío.
4. Estado de error y recuperación.
5. CTA principal visible y comprensible.

---

## 10) Checklist de aceptación UI (Definition of Done)
Antes de cerrar una interfaz, validar:
- [ ] Cumple mobile-first.
- [ ] Respeta tema oscuro y tokens semánticos.
- [ ] Es responsive en móvil/tablet/desktop.
- [ ] Mantiene jerarquía visual clara.
- [ ] Tiene feedback de carga/éxito/error.
- [ ] Cumple criterios básicos de accesibilidad.
- [ ] No introduce degradación de rendimiento perceptible.
- [ ] Reutiliza componentes existentes cuando aplica.

---

## 11) Convención para nuevas vistas
Toda nueva vista debe documentar brevemente:
- objetivo de la vista,
- usuario/escenario principal,
- componentes reutilizados,
- estados contemplados,
- métricas de rendimiento observadas.

---

## 12) Priorización inicial para este proyecto
1. Vista Cliente (catálogo/promos/carruseles/carrito).
2. Detalle de producto.
3. Carrito.
4. Checkout.

Estas etapas deben construirse respetando esta guía como contrato de diseño y calidad.
