/**
 * Phantom Project — Configuración centralizada de packs y servicios.
 * Integración con carrito y checkout real de Shopify.
 *
 * DÓNDE EDITAR:
 * - shopifyStoreUrl: URL de tu tienda (ej: "phantom-store.myshopify.com").
 * - Precios: "price" de cada producto (en euros).
 * - Textos: "title", "shortDescription", "description" (full), "features", "advantages".
 * - variantId: ID de la variante en Shopify (obligatorio para Add to Cart). Ver en Shopify Admin → Producto → Variante.
 */
window.PACKS_CONFIG = {
  /** URL de tu tienda Shopify (sin https://). Ej: "phantom-store.myshopify.com". Requerido para carrito real. */
  shopifyStoreUrl: "",

  /** Moneda para mostrar precios */
  currency: "USD",

  /** Packs principales (index) — Custom + 100m, 250m, 500m, 1b + Explorar (en HTML) */
  mainPackIds: ["custom", "100m", "250m", "500m", "1b"],

  /**
   * Configurador Custom Pack — precio base y opciones por categoría.
   * Editar aquí para cambiar precios o añadir opciones.
   */
  customPackConfig: {
    basePrice: 9.99,
    currency: "USD",
    dinero: [
      { label: "100 millones", value: "100m", extra: 0 },
      { label: "250 millones", value: "250m", extra: 4 },
      { label: "500 millones", value: "500m", extra: 8 },
      { label: "1000 millones", value: "1000m", extra: 13 },
      { label: "2000 millones", value: "2000m", extra: 21 },
      { label: "3000 millones", value: "3000m", extra: 28 },
    ],
    nivel: [
      { label: "1", value: "1", extra: 0 },
      { label: "50", value: "50", extra: 1.99 },
      { label: "120", value: "120", extra: 1.99 },
      { label: "200", value: "200", extra: 1.99 },
      { label: "300", value: "300", extra: 1.99 },
      { label: "500", value: "500", extra: 1.99 },
      { label: "750", value: "750", extra: 1.99 },
    ],
    autos: [
      { label: "0", value: "0", extra: 0 },
      { label: "25 coches + 5 conjuntos", value: "25-5", extra: 6 },
      { label: "50 coches + 10 conjuntos", value: "50-10", extra: 10 },
      { label: "100 coches + 15 conjuntos", value: "100-15", extra: 15 },
      { label: "250 coches + 20 conjuntos", value: "250-20", extra: 29.99 },
    ],
    defaultDinero: "100m",
    defaultNivel: "1",
    defaultAutos: "0",
  },

  /** IDs de servicios (mas-packs) */
  serviceIds: [
    "gta-plus",
    "all-unlocks",
    "max-stats",
    "custom-level",
    "luxury-mansions",
    "all-businesses",
    "modded-outfits",
    "modded-vehicles",
  ],

  products: {
    "custom": {
      id: "custom",
      title: "Custom Pack",
      shortDescription: "Hasta 3 billones. Pack a medida.",
      price: 9.99,
      image: "./custom-pack.png",
      description: "Pack personalizado según lo que necesites. Hasta 3 billones de GTA$. Coordinamos todo por Discord.",
      features: [
        "Hasta 3 billones GTA$",
        "Entrega coordinada",
        "Soporte Discord",
      ],
      advantages: [],
      platform: "PC",
      delivery: "A coordinar",
      productId: "",
      variantId: "",
    },

    "100m": {
      id: "100m",
      title: "100M Starter Money Pack",
      shortDescription: "100M GTA$, rango 50, 5 vehículos y outfits. Listo para jugar.",
      price: 14.99,
      image: "./100m.png",
      description:
        "Sumérgete en GTA 5 Online con una cuenta preparada para comenzar a dominar Los Santos desde el primer momento. Este pack incluye dinero, vehículos y equipamiento inicial para disfrutar el juego sin tener que pasar horas grindeando.",
      features: [
        "100.000.000 GTA$",
        "Rango 50 listo para jugar",
        "5 vehículos personalizados premium",
        "5 outfits exclusivos",
        "Estadísticas del personaje optimizadas",
      ],
      advantages: [
        "Cuenta lista para jugar inmediatamente",
        "Entrega rápida",
        "Soporte disponible después de la compra",
      ],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "250m": {
      id: "250m",
      title: "250M Premium Money Pack",
      shortDescription: "250M GTA$, rango 125, 10 vehículos. Cuenta premium.",
      badge: "MOST POPULAR",
      price: 24.99,
      image: "./250m.png",
      description:
        "Cuenta premium optimizada para dominar Los Santos desde el primer momento.",
      features: [
        "250.000.000 GTA$",
        "Rango 125",
        "10 vehículos premium",
        "10 outfits exclusivos",
        "Todas las armas desbloqueadas",
        "Mejoras permanentes de personaje",
      ],
      advantages: [
        "Acceso completo al contenido del juego",
        "Gran cantidad de dinero",
        "Entrega rápida",
        "Soporte Discord",
      ],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "500m": {
      id: "500m",
      title: "500M Ultimate Money Pack",
      shortDescription: "500M GTA$, rango 200, 15 vehículos. Cuenta avanzada.",
      price: 34.99,
      image: "./500m.png",
      description:
        "Cuenta avanzada con gran cantidad de dinero, vehículos premium y mejoras completas.",
      features: [
        "500.000.000 GTA$",
        "Rango 200",
        "15 vehículos premium",
        "15 outfits exclusivos",
        "Todas las armas desbloqueadas",
        "Propiedades preparadas",
        "Estadísticas optimizadas",
      ],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "1b": {
      id: "1b",
      title: "1B Billionaire Pack",
      shortDescription: "1.000M GTA$, rango 300, 20 vehículos. Multimillonario.",
      price: 59.99,
      image: "./1b.png",
      description:
        "Cuenta totalmente optimizada para dominar GTA Online como multimillonario.",
      features: [
        "1.000.000.000 GTA$",
        "Rango 300",
        "20 vehículos premium",
        "Propiedades desbloqueadas",
        "20 outfits exclusivos",
        "Todas las armas desbloqueadas",
        "Estadísticas optimizadas",
      ],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "gta-plus": {
      id: "gta-plus",
      title: "GTA+ Activation Service",
      shortDescription: "Activación de beneficios GTA+ en tu cuenta.",
      price: 2.99,
      image: "./gta.png",
      description: "Activación de beneficios GTA+ en tu cuenta.",
      features: ["Beneficios GTA+ activados", "Soporte por Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "all-unlocks": {
      id: "all-unlocks",
      title: "All Unlocks Pack",
      shortDescription: "Todo el contenido del juego desbloqueado.",
      price: 4.99,
      image: "./all-unlocked.png",
      description: "Todo el contenido del juego desbloqueado.",
      features: ["Contenido desbloqueado", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "max-stats": {
      id: "max-stats",
      title: "Max Stats Boost",
      shortDescription: "Estadísticas del personaje al máximo.",
      price: 3.49,
      image: "./max-stats.png",
      description: "Estadísticas del personaje al máximo.",
      features: ["Estadísticas máximas", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "custom-level": {
      id: "custom-level",
      title: "Custom Level Boost",
      shortDescription: "Subida de nivel personalizada.",
      price: 5.49,
      image: "./level.png",
      description: "Subida de nivel personalizada.",
      features: ["Nivel personalizado", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "luxury-mansions": {
      id: "luxury-mansions",
      title: "Luxury Mansions Pack",
      shortDescription: "Desbloqueo de mansiones premium.",
      price: 6.99,
      image: "./mansiones.png",
      description: "Desbloqueo de mansiones premium.",
      features: ["Mansiones [PC]", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "all-businesses": {
      id: "all-businesses",
      title: "All Businesses & Properties Pack",
      shortDescription: "Todos los negocios y propiedades desbloqueados.",
      price: 4.99,
      image: "./negocios-propiedades.png",
      description: "Todos los negocios y propiedades desbloqueados.",
      features: [
        "Todas las propiedades",
        "Todos los negocios",
        "Soporte Discord",
      ],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "modded-outfits": {
      id: "modded-outfits",
      title: "Modded Outfits Pack",
      shortDescription: "Outfits exclusivos modificados.",
      price: 4.99,
      image: "./outfits.png",
      description: "Outfits exclusivos modificados.",
      features: ["Mod de outfits", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },

    "modded-vehicles": {
      id: "modded-vehicles",
      title: "Modded Vehicles Pack",
      shortDescription: "Vehículos premium modificados.",
      price: 6.99,
      image: "./vehiculos.png",
      description: "Vehículos premium modificados.",
      features: ["Mod de vehículos", "Entrega coordinada", "Soporte Discord"],
      advantages: [],
      platform: "PC",
      delivery: "5-30 minutos",
      productId: "",
      variantId: "",
    },
  },
};
