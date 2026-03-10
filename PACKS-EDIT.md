# Phantom Project — Dónde editar packs y carrito

## Flujo: Producto → Add to Cart → Carrito → Checkout

1. **Producto (card o modal)**  
   - En cada card: botón **"Add to Cart"** (añade con `variantId` vía Shopify API) y **"View details"** (abre modal).  
   - En el modal: **"Add to Cart"**, **"Buy Now"** (añade y redirige a `/checkout`), **"Need help? Contact us on Discord"**.

2. **Add to Cart**  
   - Se llama a `POST /cart/add.js` con `{ id: variantId, quantity: 1 }`.  
   - Si va bien: mensaje "Added to cart", se actualiza el contador del carrito, se refresca el mini cart con `GET /cart.js` y se abre el drawer.

3. **Mini cart**  
   - Contenido real de Shopify (`GET /cart.js`): ítems, subtotal.  
   - Enlace **"View cart"** → `/cart`.  
   - Botón **"Checkout"** → `/checkout` (checkout oficial de Shopify).

4. **Checkout**  
   - El usuario paga en la página de checkout de Shopify.

---

## Archivos modificados / creados

| Archivo | Cambio |
|---------|--------|
| **packs-config.js** | Configuración centralizada: `shopifyStoreUrl`, precios, textos, `shortDescription`, `description`, `features`, **variantId** por producto. |
| **index.html** | Modal con Add to Cart + Buy Now, carrito con Checkout y View cart, textos en inglés. |
| **mas-packs.html** | Mismo modal y carrito que index. |
| **script.js** | Integración Shopify: `getShopifyBaseUrl()`, `fetchCartShopify()`, `addToCartShopify()`, mini cart desde `GET /cart.js`, botón Checkout a `/checkout`, `handleAddToCart`, `buyNowFromModal`, cards con botón Add to Cart. |
| **styles.css** | Estilos del modal y del badge MOST POPULAR. |

---

## Dónde editar precios

**Archivo:** `packs-config.js`  
**Propiedad:** `price` de cada objeto en `products`.

Ejemplo:

```js
"100m": {
  ...
  price: 14.99,  // ← Editar aquí (euros)
  ...
},
```

---

## Dónde editar textos (títulos, descripciones, listas)

**Archivo:** `packs-config.js`  
**Propiedades por producto:**

- **title** — Nombre del pack/servicio.
- **description** — Descripción larga (modal).
- **shortDescription** — Descripción corta (opcional, para cards).
- **features** — Array de ítems “Incluye”.
- **advantages** — Array de ítems “Ventajas” (opcional).
- **platform** — Ej: `"PC"`.
- **delivery** — Ej: `"5-30 minutos"`.

Ejemplo:

```js
"250m": {
  title: "250M Premium Money Pack",
  description: "Cuenta premium optimizada para dominar Los Santos...",
  features: ["250.000.000 GTA$", "Rango 125", ...],
  advantages: ["Acceso completo al contenido del juego", ...],
  ...
},
```

---

## Dónde editar variantId (Shopify)

**Archivo:** `packs-config.js`  
**Propiedades por producto:**

- **variantId** — ID de la variante en Shopify (número o string). Si está vacío, Add to Cart usa solo el carrito local.
- **productId** — ID del producto en Shopify (opcional, para referencia).

Ejemplo:

```js
"100m": {
  ...
  productId: "123456789",
  variantId: "987654321",  // ← Poner el ID real de la variante en Shopify
  ...
},
```

Para ver el variant ID en Shopify: Productos → [producto] → Variantes → al inspeccionar o en la URL de la variante.

---

## Tienda Shopify

**Archivo:** `packs-config.js`  
**Variable:** `shopifyStoreUrl` (al inicio del objeto `window.PACKS_CONFIG`).

- Si lo dejas **vacío** (`""`), el botón “Add to Cart” solo añade al carrito local (localStorage) y abre el mini cart.
- Si pones tu tienda (ej: `"phantom-store.myshopify.com"`), “Add to Cart” intentará añadir con la API de Shopify (`/cart/add.js`) usando el `variantId` del producto.

Ejemplo:

```js
window.PACKS_CONFIG = {
  shopifyStoreUrl: "tu-tienda.myshopify.com",
  ...
};
```

---

## Badge “MOST POPULAR”

**Archivo:** `packs-config.js`  
En el producto que quieras destacar, añade la propiedad **badge**:

```js
"250m": {
  ...
  badge: "MOST POPULAR",
  ...
},
```

Solo un producto debería tener badge para que destaque. El estilo (rojo, arriba a la izquierda) está en `styles.css` (clase `.pack-badge`).

---

## Resumen rápido

| Qué quieres cambiar | Dónde |
|---------------------|--------|
| Precios | `packs-config.js` → `products[id].price` |
| Títulos y descripciones | `packs-config.js` → `products[id].title`, `description`, `features`, `advantages` |
| variantId Shopify | `packs-config.js` → `products[id].variantId` |
| URL tienda Shopify | `packs-config.js` → `shopifyStoreUrl` |
| Badge “MOST POPULAR” | `packs-config.js` → `products[id].badge` |
| Estilo del badge | `styles.css` → `.pack-badge` |
| Estilo del modal | `styles.css` → `.product-modal*` |
