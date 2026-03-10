/**
 * Checkout — Phantom Project
 * Métodos de pago: PayPal, Crypto, Discord (Argentina).
 *
 * ORDER ID: se genera solo aquí (al entrar al checkout o antes de PayPal/Crypto). Si ya existe en storage, se reutiliza.
 * success.html NUNCA genera orderId; solo lo lee y lo muestra.
 *
 * CONFIGURACIÓN (buscar en este archivo):
 * - Link de Discord: CHECKOUT_DISCORD_URL
 * - PayPal: PAYPAL_CLIENT_ID, PAYPAL_CURRENCY, PAYPAL_CREATE_ORDER_URL; onApprove redirige a success.html
 * - Crypto: CRYPTO_PAYMENT_LINK o integrar API en el handler "Continuar con Crypto"; redirigir a success.html al confirmar pago
 *
 * Funciones principales:
 * - getOrderFromStorage(): carga pedido desde localStorage y sessionStorage.
 * - getOrderTotal() / formatOrderTotal(): total del pedido con cupón; resumen, PayPal, Crypto.
 * - renderSummary(): resumen con estado vacío "Ir a la tienda" si no hay pedido.
 * - completeOrderAndRedirectToSuccess(): guarda orden y redirige a success.html; limpia sessionStorage.
 * - setupForm(): previene submit del form (pago solo por PayPal/Crypto/Discord).
 */

const CHECKOUT_STORAGE_KEY = "phantom_checkout";
const SUCCESS_STORAGE_KEY = "phantom_success_order";
const COUPON_CODE = "STREAMS";
const COUPON_DISCOUNT_PERCENT = 10;

/** Base para APIs (Supabase, confirm-payment, etc.). Mismo origen en Vercel. */
const API_BASE = "/api";

/** [EDITAR] Enlace de Discord para "Comprar por Discord". */
const CHECKOUT_DISCORD_URL = "https://discord.gg/QWKxtrREjP";

/* ——— PayPal LIVE: SDK en checkout.html; createOrder usa productName y paypalAmount (total con quantity/cupón). */
const PAYPAL_CLIENT_ID = "AWYpiARmUhLVbBIm1h5K0CNIfcNOTNDDiRyrp3Bj5PVz-ii7PnstyZXHu2d9L3EdVLde3kpfC7v6PrLM";
const PAYPAL_CURRENCY = "USD";
/** Redirección tras pago aprobado. */
const SUCCESS_PAGE_URL = "https://www.phantomproject.cc/success";
/** Textos seguros enviados a PayPal en purchase_units (no mencionar marcas). */
const PAYPAL_SAFE_NAME = "Digital Gaming Service";
const PAYPAL_SAFE_DESCRIPTION = "Online Progress Service";

/* ——— NOWPayments (Crypto) ———
 * Crea invoice en api.nowpayments.io y redirige al link de pago. Tras el pago, NOWPayments redirige a success_url (success.html).
 * pay_currency: forzar USDT TRC20 (usdttrc20). Si la API no lo acepta, se ignora y se muestra la recomendación en checkout.
 */
const NOWPAYMENTS_API_KEY = "ZJFNCBG-H6EM4PZ-MDAYGTW-8G968V8";
const NOWPAYMENTS_INVOICE_URL = "https://api.nowpayments.io/v1/invoice";
const NOWPAYMENTS_SUCCESS_URL = "https://www.phantomproject.cc/success";
const NOWPAYMENTS_CANCEL_URL = "https://phantomproject.cc";
/** Moneda de pago: USDT red TRC20. Valor según API NOWPayments (p. ej. usdttrc20). */
const NOWPAYMENTS_PAY_CURRENCY = "usdttrc20";

/**
 * Genera un Order ID único (ej: PP-483921). Una sola vez por pedido; si ya existe en checkout, reutilizarlo.
 */
function generateOrderId() {
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(Math.random() * 90 + 10);
  return "PP-" + t + r;
}

/**
 * Asegura que el pedido actual en storage tenga orderId. Si no existe, lo genera y guarda.
 * Llamar antes de iniciar PayPal o Crypto para que el mismo ID se use en success.
 */
function ensureCheckoutOrderId() {
  const order = getOrderFromStorage();
  if (!order) return null;
  if (order.orderId && String(order.orderId).trim()) return order.orderId;
  const orderId = generateOrderId();
  order.orderId = orderId;
  try {
    const json = JSON.stringify(order);
    localStorage.setItem(CHECKOUT_STORAGE_KEY, json);
    sessionStorage.setItem(CHECKOUT_STORAGE_KEY, json);
  } catch (_) {}
  return orderId;
}

/**
 * Lee email y Discord del formulario de checkout.
 */
function getCheckoutCustomerData() {
  const emailEl = document.getElementById("checkout-email");
  const discordEl = document.getElementById("checkout-discord");
  const discordIdEl = document.getElementById("checkout-discord-id");
  return {
    customer_email: (emailEl && emailEl.value && emailEl.value.trim()) || "",
    customer_discord: (discordEl && discordEl.value && discordEl.value.trim()) || "",
    customer_discord_id: (discordIdEl && discordIdEl.value && discordIdEl.value.trim()) || null,
  };
}

/**
 * Crea o actualiza el pedido en el backend (Supabase) con estado pending.
 * Devuelve true si ok, false si falló.
 */
async function syncOrderToBackend() {
  const order = getOrderFromStorage();
  const customer = getCheckoutCustomerData();
  if (!order || !order.orderId || !customer.customer_email || !customer.customer_discord) {
    return false;
  }
  const total = getOrderTotal();
  const quantity = getOrderQuantity();
  const payload = {
    order_id: order.orderId,
    product_name: order.productName || "",
    product_price: Number(order.productPrice) || 0,
    quantity: quantity,
    total: total,
    customer_email: customer.customer_email,
    customer_discord: customer.customer_discord,
    customer_discord_id: customer.customer_discord_id || undefined,
    product_image: order.productImage || undefined,
    product_type: order.productType || undefined,
    selected_money: order.customPackSelections ? order.customPackSelections.dinero : undefined,
    selected_level: order.customPackSelections ? order.customPackSelections.nivel : undefined,
    selected_vehicles: order.customPackSelections ? order.customPackSelections.autos : undefined,
  };
  try {
    var url = (API_BASE.startsWith("http") ? API_BASE : window.location.origin + API_BASE) + "/create-order";
    console.log("[Checkout] Enviando a create-order:", payload.order_id, payload.product_name, payload.total);
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("[Checkout] syncOrderToBackend:", e);
    return false;
  }
}

/**
 * Carga el pedido desde storage. Prioriza phantom_checkout (local + session), luego checkoutProduct.
 * Así el resumen y PayPal/Crypto encuentran el pedido aunque solo se haya guardado en una clave.
 */
function getOrderFromStorage() {
  try {
    var raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    raw = localStorage.getItem("checkoutProduct");
    if (raw) return JSON.parse(raw);
    raw = sessionStorage.getItem("checkoutProduct");
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Normaliza un objeto de pedido para que tenga productName, productPrice, productImage, quantity, etc.
 */
function normalizeOrderPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  var name = obj.productName || obj.name || "";
  var price = obj.productPrice != null ? Number(obj.productPrice) : (obj.price != null ? Number(obj.price) : 0);
  if (!name && price === 0 && !obj.productImage && !obj.image) return null;
  var out = {
    productName: name || "Producto",
    productPrice: Number.isNaN(price) ? 0 : price,
    productImage: obj.productImage || obj.image || "",
    quantity: obj.quantity != null ? Math.max(1, Math.floor(Number(obj.quantity))) : 1,
    productType: obj.productType || "normal",
    productId: obj.productId || obj.id || "",
    customPackSelections: obj.customPackSelections || undefined,
  };
  if (obj.selectedMoney != null) out.selectedMoney = obj.selectedMoney;
  if (obj.selectedLevel != null) out.selectedLevel = obj.selectedLevel;
  if (obj.selectedVehicles != null) out.selectedVehicles = obj.selectedVehicles;
  if (out.customPackSelections && !out.selectedMoney) out.selectedMoney = out.customPackSelections.dinero;
  if (out.customPackSelections && !out.selectedLevel) out.selectedLevel = out.customPackSelections.nivel;
  if (out.customPackSelections && !out.selectedVehicles) out.selectedVehicles = out.customPackSelections.autos;
  return out;
}

/**
 * Obtiene el pedido para el checkout: primero phantom_checkout, luego checkoutProduct, luego URL.
 * Si obtiene datos de URL o checkoutProduct, los persiste en phantom_checkout para que el resto del checkout funcione.
 */
function getCheckoutOrder() {
  var order = getOrderFromStorage();
  if (order && typeof order === "object" && (order.productName != null || order.name != null || order.productPrice != null || order.price != null)) {
    if (!order.productName && order.name) order.productName = order.name;
    if (order.productPrice == null && order.price != null) order.productPrice = Number(order.price);
    if (!order.productImage && order.image) order.productImage = order.image;
    if (!order.productName && (order.productPrice != null || order.price != null)) order.productName = order.productName || order.name || "Producto";
    console.log("[Checkout] Pedido leído:", order.productName, order.productPrice);
    var hadPhantom = !!localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!hadPhantom) {
      try {
        var json = JSON.stringify(order);
        localStorage.setItem(CHECKOUT_STORAGE_KEY, json);
        sessionStorage.setItem(CHECKOUT_STORAGE_KEY, json);
      } catch (_) {}
    }
    return order;
  }
  try {
    var raw = localStorage.getItem("checkoutProduct");
    if (raw) {
      order = normalizeOrderPayload(JSON.parse(raw));
      if (order) {
        console.log("[Checkout] Pedido leído desde checkoutProduct (localStorage), sincronizando a phantom_checkout");
        var json = JSON.stringify(order);
        localStorage.setItem(CHECKOUT_STORAGE_KEY, json);
        sessionStorage.setItem(CHECKOUT_STORAGE_KEY, json);
        return order;
      }
    }
  } catch (e) {
    console.error("[Checkout] Error leyendo checkoutProduct", e);
  }
  var params = new URLSearchParams(typeof window !== "undefined" && window.location ? window.location.search : "");
  var name = params.get("name");
  var price = params.get("price");
  var image = params.get("image");
  var qty = params.get("quantity");
  if (name || price || image) {
    order = normalizeOrderPayload({
      name: name || "Producto",
      price: price || "0",
      image: image || "",
      quantity: qty ? parseInt(qty, 10) : 1,
    });
    if (order) {
      var json = JSON.stringify(order);
      localStorage.setItem(CHECKOUT_STORAGE_KEY, json);
      sessionStorage.setItem(CHECKOUT_STORAGE_KEY, json);
      console.log("[Checkout] Pedido construido desde URL, guardado en storage");
      return order;
    }
  }
  console.log("[Checkout] No se encontró pedido (ni phantom_checkout ni checkoutProduct ni URL)");
  return null;
}

/** Alias: devuelve el pedido para el resumen (usa getCheckoutOrder para tener fallback URL/checkoutProduct). */
function getCheckoutData() {
  return getCheckoutOrder();
}

/**
 * Devuelve la cantidad del pedido (por defecto 1). Usa phantom_checkout (ya sincronizado por getCheckoutOrder).
 */
function getOrderQuantity() {
  var order = getOrderFromStorage();
  if (!order) return 1;
  var q = order.quantity != null ? Math.max(1, Math.floor(Number(order.quantity))) : 1;
  return Number.isNaN(q) || q < 1 ? 1 : q;
}

/**
 * Devuelve el total numérico del pedido: (precio unitario * cantidad), con cupón si aplica.
 */
function getOrderTotal() {
  var order = getOrderFromStorage();
  if (!order || (order.productPrice == null && order.price == null)) return 0;
  var unitPrice = Number(order.productPrice != null ? order.productPrice : order.price);
  if (Number.isNaN(unitPrice) || unitPrice < 0) return 0;
  var qty = getOrderQuantity();
  var total = Math.round(unitPrice * qty * 100) / 100;
  if (Number.isNaN(total) || total < 0) return 0;
  if (window.checkoutDiscountApplied) {
    total = Math.round((total * (1 - COUPON_DISCOUNT_PERCENT / 100)) * 100) / 100;
  }
  return total;
}

/**
 * Total para checkout: pedido real o fallback 39.98. Usar en resumen, PayPal y Crypto.
 */
function getCheckoutTotal() {
  var total = getOrderTotal();
  if (total != null && !Number.isNaN(total) && total > 0) return total;
  console.log("[Checkout] getCheckoutTotal: sin pedido válido, fallback 39.98");
  return 39.98;
}

/** Formatea el total en USD para mostrar en resumen, PayPal, Crypto. */
function formatOrderTotal(total) {
  return formatPrice(total, "USD");
}

/**
 * Total para PayPal: string con dos decimales y punto (ej: "249.90"). Usa getCheckoutTotal (fallback 39.98).
 */
function getPaymentAmountString() {
  var total = getCheckoutTotal();
  var num = Number(total);
  if (Number.isNaN(num) || num < 0) return "39.98";
  console.log("[Checkout] getPaymentAmountString:", num.toFixed(2));
  return num.toFixed(2);
}

/** Total numérico para PayPal/Crypto. Usa getCheckoutTotal (fallback 39.98). */
function getPaymentAmountNumber() {
  var total = getCheckoutTotal();
  var num = Number(total);
  if (Number.isNaN(num) || num < 0) return 39.98;
  return Math.round(num * 100) / 100;
}

function getPackById(id) {
  try {
    const config = typeof window !== "undefined" ? window.PACKS_CONFIG : null;
    if (!config || typeof config.products !== "object") return null;
    return config.products[id] || null;
  } catch (_) {
    return null;
  }
}

function getPackByProductName(productName) {
  try {
    const config = typeof window !== "undefined" ? window.PACKS_CONFIG : null;
    if (!config || typeof config.products !== "object" || !productName) return null;
    const name = String(productName).trim().toLowerCase();
    for (const id of Object.keys(config.products)) {
      const pack = config.products[id];
      if (pack && pack.title && String(pack.title).toLowerCase() === name) return pack;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function getDeliveryEstimate(productId) {
  if (!productId || productId === "custom") return "A coordinar";
  const id = String(productId).toLowerCase();
  if (id === "100m") return "Entrega estimada: 30-60 minutos";
  if (id === "250m" || id === "500m" || id === "1b") return "Entrega estimada: 1-3 horas";
  const pack = getPackById(productId);
  if (pack && pack.delivery) return pack.delivery;
  return "Entrega estimada: 1-3 horas";
}

function isCountryArgentina(countryStr) {
  if (!countryStr || typeof countryStr !== "string") return false;
  const normalized = countryStr.trim().toLowerCase();
  return normalized === "argentina" || normalized.includes("argentina");
}

function updatePaymentByCountry() {
  const countryInput = document.getElementById("checkout-country");
  const blockArgentina = document.getElementById("checkout-payment-argentina");
  const blockOther = document.getElementById("checkout-payment-other");
  const actionsWrap = document.getElementById("checkout-actions-wrap");
  const discordBtn = document.getElementById("checkout-discord-btn");
  if (!countryInput || !blockArgentina || !blockOther) return;
  const isArgentina = isCountryArgentina(countryInput.value);
  if (isArgentina) {
    blockArgentina.classList.remove("hidden");
    blockOther.classList.add("hidden");
    if (actionsWrap) actionsWrap.classList.add("hidden");
    if (discordBtn) {
      discordBtn.href = CHECKOUT_DISCORD_URL;
      discordBtn.target = "_blank";
      discordBtn.rel = "noopener noreferrer";
    }
  } else {
    blockArgentina.classList.add("hidden");
    blockOther.classList.remove("hidden");
    if (actionsWrap) actionsWrap.classList.remove("hidden");
    setTimeout(function () {
      if (typeof initPayPalButtonsWhenReady === "function") initPayPalButtonsWhenReady();
    }, 100);
  }
}

/**
 * Construye el payload de éxito y redirige a success.html.
 * paymentMeta opcional: { paypalOrderId, cryptoInvoiceId } para confirm-payment.
 */
function completeOrderAndRedirectToSuccess(paymentMethod, paymentMeta) {
  var data = getOrderFromStorage();
  if (!data || (!data.productName && !data.name && (data.productPrice == null && data.price == null))) {
    alert("No hay producto en el pedido. Volvé a la tienda.");
    return false;
  }
  var productName = data.productName || data.name || "Producto";
  if (!data.productName) data.productName = productName;
  if (data.productPrice == null && data.price != null) data.productPrice = Number(data.price);
  var orderId = data.orderId || ensureCheckoutOrderId() || generateOrderId();
  var finalPrice = getOrderTotal();
  var quantity = getOrderQuantity();
  const meta = paymentMeta || {};
  const successPayload = {
    orderId,
    productName: data.productName,
    productPrice: finalPrice,
    quantity: quantity,
    unitPrice: Number(data.productPrice) || 0,
    productImage: data.productImage || "",
    productType: data.productType || "normal",
    paymentMethod: paymentMethod || "paypal",
    paypal_order_id: meta.paypalOrderId || null,
    crypto_invoice_id: meta.cryptoInvoiceId || null,
    customPackSelections: data.customPackSelections || null,
    selectedMoney: data.customPackSelections ? data.customPackSelections.dinero : null,
    selectedLevel: data.customPackSelections ? data.customPackSelections.nivel : null,
    selectedVehicles: data.customPackSelections ? data.customPackSelections.autos : null,
  };
  try {
    localStorage.setItem(SUCCESS_STORAGE_KEY, JSON.stringify(successPayload));
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch (_) {}
  window.location.href = SUCCESS_PAGE_URL;
  return true;
}

function setupCountryPaymentToggle() {
  const countryInput = document.getElementById("checkout-country");
  if (!countryInput) return;
  function update() {
    updatePaymentByCountry();
  }
  countryInput.addEventListener("input", update);
  countryInput.addEventListener("change", update);
  update();
}

/** Total numérico para PayPal/Crypto. Reutiliza getOrderTotal(). */
function getCheckoutTotalForPayment() {
  return getOrderTotal();
}

/**
 * Obtiene el monto para PayPal: string con dos decimales y punto (ej: "39.98").
 * Origen: getPaymentAmountString() → #checkout-total (dataset o texto) → "39.98".
 */
function getPayPalAmountString() {
  try {
    var fromOrder = getPaymentAmountString();
    if (fromOrder && /^\d+(\.\d{1,2})?$/.test(fromOrder)) return fromOrder;
  } catch (_) {}
  var totalEl = document.getElementById("checkout-total");
  if (totalEl) {
    if (totalEl.dataset && totalEl.dataset.finalPrice) {
      var n = Number(totalEl.dataset.finalPrice);
      if (!Number.isNaN(n) && n >= 0) return n.toFixed(2);
    }
    if (totalEl.textContent) {
      var parsed = totalEl.textContent.replace(/[^\d.,]/g, "").replace(",", ".");
      if (parsed && !Number.isNaN(Number(parsed))) return Number(parsed).toFixed(2);
    }
  }
  return "39.98";
}

/**
 * Inicializa el botón oficial de PayPal en #paypal-button-container.
 * Monto desde pedido o #checkout-total o "39.98". Mantiene Supabase, Discord y success.
 */
function initPayPalButtons() {
  var container = document.getElementById("paypal-button-container");
  if (!container) return;

  if (!window.paypal || typeof window.paypal.Buttons !== "function") {
    container.innerHTML = '<p class="text-sm text-white/50">PayPal no está disponible. Recargá la página.</p>';
    return;
  }

  var order = getCheckoutOrder();
  if (!order || (!order.productName && !order.name && (order.productPrice == null || order.price == null))) {
    container.innerHTML = '<p class="text-sm text-white/50">No hay pedido activo. Agregá un producto desde la tienda.</p>';
    return;
  }
  if (!order.productName) order.productName = order.name || "Producto";

  ensureCheckoutOrderId();
  container.innerHTML = "";

  try {
    window.paypal.Buttons({
      createOrder: function (data, actions) {
        var total = getPayPalAmountString();
        var totalEl = document.getElementById("checkout-total");
        if (totalEl && totalEl.textContent) {
          var parsed = (totalEl.textContent || "").replace(/[^\d.,]/g, "").replace(",", ".");
          if (parsed) total = String(Number(parsed).toFixed(2));
        }
        if (typeof total !== "string" || total.indexOf(",") >= 0) total = String(Number(total).toFixed(2));
        var customer = getCheckoutCustomerData();
        if (!customer.customer_email || !customer.customer_discord) {
          alert("Completá correo electrónico y Discord del cliente antes de pagar.");
          throw new Error("Faltan datos de contacto");
        }
        syncOrderToBackend().catch(function (e) {
          console.warn("[Checkout] syncOrderToBackend falló (el pago sigue):", e);
        });
        return actions.order.create({
          purchase_units: [{
            description: PAYPAL_SAFE_DESCRIPTION,
            amount: {
              currency_code: PAYPAL_CURRENCY,
              value: total
            }
          }]
        });
      },
      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          if (typeof completeOrderAndRedirectToSuccess === "function") {
            completeOrderAndRedirectToSuccess("paypal", { paypalOrderId: data.orderID });
          } else {
            alert("Pago completado correctamente.");
            window.location.href = typeof SUCCESS_PAGE_URL !== "undefined" ? SUCCESS_PAGE_URL : "/success";
          }
        });
      },
      onError: function (err) {
        console.error("[Checkout] PayPal onError:", err);
        var msg = (err && err.message) ? err.message : (err && err.toString ? err.toString() : "Error desconocido");
        console.error("[Checkout] PayPal detalle:", msg);
        alert("Hubo un error al iniciar el pago con PayPal. Revisá que correo y Discord estén completos. Detalle: " + msg);
      }
    }).render("#paypal-button-container");
  } catch (err) {
    console.error("PayPal render error:", err);
    container.innerHTML = '<p class="text-sm text-white/50">No se pudo cargar el botón de PayPal. Recargá la página.</p>';
  }
}

/**
 * Espera a que window.paypal esté disponible (SDK cargado) y luego inicializa los botones.
 * Evita renderizar antes de que el SDK esté listo. No vuelve a renderizar si ya hay botón.
 */
function initPayPalButtonsWhenReady() {
  var container = document.getElementById("paypal-button-container");
  if (!container) return;
  if (container.querySelector("iframe")) return;

  var order = getCheckoutOrder();
  if (!order || (!order.productName && (order.productPrice == null || order.productPrice <= 0))) {
    container.innerHTML = '<p class="text-sm text-white/50">No hay pedido activo. Agregá un producto desde la tienda.</p>';
    return;
  }
  if (!order.productName) order.productName = "Producto";

  if (window.paypal) {
    initPayPalButtons();
    return;
  }

  let attempts = 0;
  const maxAttempts = 25;
  const interval = setInterval(function () {
    attempts++;
    if (window.paypal) {
      clearInterval(interval);
      if (!container.querySelector("iframe")) initPayPalButtons();
      return;
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      if (!container.querySelector("iframe")) {
        container.innerHTML = '<p class="text-sm text-white/50">PayPal no está disponible. Recargá la página.</p>';
      }
    }
  }, 200);
}

/**
 * Crea una invoice en NOWPayments con el precio del pedido actual y redirige al usuario al link de pago.
 * Si el pago se completa, NOWPayments redirige a success_url (success.html).
 * OrderId se asegura ANTES de crear la invoice; success.html solo lee ese mismo valor (no lo regenera).
 */
async function createNowPaymentsInvoice() {
  console.log("[Checkout] Crypto: click en Continuar con Crypto");
  var order = getCheckoutOrder();
  if (!order || (!order.productName && (order.productPrice == null || order.price == null))) {
    console.warn("[Checkout] Crypto: no hay pedido válido");
    alert("No hay producto en el pedido. Agregá un producto desde la tienda.");
    return;
  }
  if (!order.productName) order.productName = order.name || "Producto";
  ensureCheckoutOrderId();
  var customer = getCheckoutCustomerData();
  if (!customer.customer_email || !customer.customer_discord) {
    alert("Completá correo electrónico y Discord del cliente antes de continuar.");
    return;
  }

  var synced = await syncOrderToBackend();
  if (!synced) console.warn("[Checkout] Crypto: no se pudo sincronizar el pedido con el servidor.");

  var priceAmount = getPaymentAmountNumber();
  console.log("[Checkout] Crypto: total calculado", priceAmount, "USD");
  if (!priceAmount || priceAmount <= 0) {
    alert("El total del pedido no es válido. Revisá el resumen del pedido.");
    return;
  }

  var orderId = order.orderId || ensureCheckoutOrderId();
  var quantity = getOrderQuantity();
  var orderDescription = quantity > 1 ? (order.productName || "Phantom Project Order") + " x" + quantity : (order.productName || "Phantom Project Order");
  console.log("[Checkout] Crypto: enviando a NOWPayments — order_id:", orderId, "price_amount:", priceAmount, "producto:", order.productName);

  const successPayload = {
    orderId: orderId,
    productName: order.productName,
    productPrice: priceAmount,
    quantity: quantity,
    unitPrice: Number(order.productPrice) || 0,
    productImage: order.productImage || "",
    productType: order.productType || "normal",
    paymentMethod: "crypto",
    customPackSelections: order.customPackSelections || null,
    selectedMoney: order.customPackSelections ? order.customPackSelections.dinero : null,
    selectedLevel: order.customPackSelections ? order.customPackSelections.nivel : null,
    selectedVehicles: order.customPackSelections ? order.customPackSelections.autos : null,
  };
  try {
    localStorage.setItem(SUCCESS_STORAGE_KEY, JSON.stringify(successPayload));
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch (_) {}

  var body = {
    price_amount: Number(priceAmount),
    price_currency: "usd",
    order_id: orderId,
    order_description: orderDescription,
    success_url: NOWPAYMENTS_SUCCESS_URL,
    cancel_url: NOWPAYMENTS_CANCEL_URL,
    pay_currency: NOWPAYMENTS_PAY_CURRENCY,
  };

  const cryptoBtn = document.getElementById("cryptoPayButton") || document.getElementById("checkout-crypto-btn");
  if (cryptoBtn) {
    cryptoBtn.disabled = true;
    cryptoBtn.textContent = "Creando enlace de pago…";
  }

  fetch(NOWPAYMENTS_INVOICE_URL, {
    method: "POST",
    headers: {
      "x-api-key": NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.message || data.err || "Error al crear la invoice");
        return data;
      });
    })
    .then(function (data) {
      var invoiceUrl = data.invoice_url;
      if (invoiceUrl) {
        if (data.id) successPayload.crypto_invoice_id = data.id;
        try { localStorage.setItem(SUCCESS_STORAGE_KEY, JSON.stringify(successPayload)); } catch (_) {}
        window.location.href = invoiceUrl;
      } else {
        throw new Error("No se recibió el link de pago.");
      }
    })
    .catch(function (err) {
      console.error("[Checkout] NOWPayments error:", err);
      alert(err.message || "No se pudo crear el enlace de pago. Intentá de nuevo o usá otro método.");
      try {
        var currentOrder = getCheckoutOrder();
        if (currentOrder) {
          localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(currentOrder));
          sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(currentOrder));
        }
      } catch (_) {}
      if (cryptoBtn) {
        cryptoBtn.disabled = false;
        cryptoBtn.textContent = "Continuar con Crypto";
      }
    });
}

function setupPayPalCryptoDiscord() {
  const discordBtn = document.getElementById("checkout-discord-btn");
  const cryptoBtn = document.getElementById("cryptoPayButton") || document.getElementById("checkout-crypto-btn");

  if (discordBtn) {
    discordBtn.href = CHECKOUT_DISCORD_URL;
    discordBtn.target = "_blank";
    discordBtn.rel = "noopener noreferrer";
  }

  initPayPalButtonsWhenReady();

  if (cryptoBtn) {
    cryptoBtn.addEventListener("click", function () {
      try {
        createNowPaymentsInvoice();
      } catch (err) {
        console.error("Crypto button error:", err);
        alert("No se pudo iniciar el pago. Intentá de nuevo.");
      }
    });
  }
}

function formatPrice(price, currency = "USD") {
  if (price == null || Number.isNaN(price)) return "—";
  const num = Number(price);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(num);
}

/**
 * Renderiza el resumen del pedido en #checkout-summary-content, #checkout-subtotal, #checkout-total.
 * Muestra #checkout-totals y oculta #checkout-summary-empty si hay producto; si no, muestra vacío y oculta totals.
 * Usa getCheckoutOrder() (localStorage → checkoutProduct → URL).
 */
function renderCheckoutSummary(order) {
  var content = document.getElementById("checkout-summary-content");
  var empty = document.getElementById("checkout-summary-empty");
  var totals = document.getElementById("checkout-totals");
  var couponWrap = document.getElementById("checkout-coupon-wrap");
  var subtotalEl = document.getElementById("checkout-subtotal");
  var totalEl = document.getElementById("checkout-total");
  var cryptoAmountEl = document.getElementById("checkout-crypto-amount");

  var hasProduct = order && (order.productName || (order.productPrice != null && order.productPrice > 0));
  if (!hasProduct) {
    if (content) content.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    if (totals) totals.classList.add("hidden");
    if (couponWrap) couponWrap.classList.add("hidden");
    if (cryptoAmountEl) cryptoAmountEl.textContent = "Total: — USD";
    console.log("[Checkout] renderCheckoutSummary: sin producto, mostrando estado vacío");
    return null;
  }
  if (!order.productName) order.productName = "Producto";

  if (empty) empty.classList.add("hidden");
  if (totals) totals.classList.remove("hidden");
  if (couponWrap) couponWrap.classList.remove("hidden");
  console.log("[Checkout] renderCheckoutSummary: pintando resumen para", order.productName, order.productPrice);

  var unitPrice = Number(order.productPrice) || 0;
  var quantity = getOrderQuantity();
  var subtotalRaw = Math.round(unitPrice * quantity * 100) / 100;
  var finalPrice = getOrderTotal();
  var isCustom = order.productType === "custom" && order.customPackSelections;
  var productId = order.productId || "";
  var pack = null;
  var features = [];
  var deliveryText = "Entrega estimada: 1-3 horas";
  try {
    pack = getPackById(productId) || getPackByProductName(order.productName);
    if (pack && pack.features && Array.isArray(pack.features)) features = pack.features;
    deliveryText = getDeliveryEstimate(productId || (pack && pack.id ? pack.id : ""));
  } catch (_) {}

  var displayName = quantity > 1 ? (order.productName || "Producto") + " x" + quantity : (order.productName || "Producto");
  var unitAndQtyHtml = quantity > 1
    ? "<p class=\"checkout-summary-unit-qty text-xs text-white/60 mt-1\">Precio unitario: " + formatPrice(unitPrice) + " · Cantidad: " + quantity + "</p>"
    : "";
  var featuresHtml = features.length ? "<ul class=\"checkout-summary-features\">" + features.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : "";
  var selectionsHtml = isCustom && order.customPackSelections
    ? "<p class=\"checkout-summary-selections\">" + [order.customPackSelections.dinero, order.customPackSelections.nivel, order.customPackSelections.autos].filter(Boolean).join(" · ") + "</p>"
    : "";
  var deliveryHtml = "<p class=\"checkout-summary-delivery\">" + deliveryText + "</p>";

  var html = "<div class=\"checkout-summary-product\">" +
    "<img src=\"" + (order.productImage || "") + "\" alt=\"\" />" +
    "<div class=\"checkout-summary-details\">" +
    "<p class=\"font-semibold text-white\">" + displayName + "</p>" +
    unitAndQtyHtml +
    selectionsHtml +
    featuresHtml +
    deliveryHtml +
    "</div></div>";

  if (content) content.innerHTML = html;
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotalRaw);
  if (totalEl) {
    totalEl.textContent = formatOrderTotal(finalPrice);
    totalEl.dataset.finalPrice = String(finalPrice);
  }
  if (cryptoAmountEl) cryptoAmountEl.textContent = "Total: " + formatOrderTotal(finalPrice);
  return { data: order, unitPrice: unitPrice, finalPrice: finalPrice };
}

/**
 * Obtiene el pedido (getCheckoutOrder) y renderiza el resumen. Si no hay pedido, muestra estado vacío.
 */
function renderSummary() {
  var data = null;
  try {
    data = getCheckoutOrder();
  } catch (e) {
    console.error("[Checkout] renderSummary getCheckoutOrder:", e);
  }
  var result = renderCheckoutSummary(data);
  var total = getCheckoutTotal();
  console.log("[Checkout] renderSummary ejecutado, hay pedido:", !!data, "total calculado:", total);
  return result;
}

function setupCoupon() {
  const input = document.getElementById("checkout-coupon");
  const btn = document.getElementById("checkout-coupon-apply");
  const msg = document.getElementById("checkout-coupon-msg");

  if (!btn || !input || !msg) return;

  window.checkoutDiscountApplied = false;

  function applyCoupon() {
    const code = (input.value || "").trim().toUpperCase();
    if (code === COUPON_CODE) {
      window.checkoutDiscountApplied = true;
      msg.textContent = `¡${COUPON_DISCOUNT_PERCENT}% de descuento aplicado!`;
      msg.style.color = "rgba(34, 197, 94, 0.95)";
      renderSummary();
    } else if (code) {
      window.checkoutDiscountApplied = false;
      msg.textContent = "Código no válido.";
      msg.style.color = "rgba(248, 113, 113, 0.95)";
      renderSummary();
    } else {
      msg.textContent = "";
      window.checkoutDiscountApplied = false;
      renderSummary();
    }
  }

  btn.addEventListener("click", applyCoupon);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCoupon();
    }
  });
}

/** Formulario de contacto/entrega; sin submit de pago (solo PayPal/Crypto/Discord). */
function setupForm() {
  const form = document.getElementById("checkout-form");
  if (!form) return;
  form.addEventListener("submit", (e) => e.preventDefault());
}

function init() {
  console.log("[Checkout] init: cargando checkout");
  try {
    renderSummary();
    setupCoupon();
    setupForm();
    setupCountryPaymentToggle();
    setupPayPalCryptoDiscord();
    console.log("[Checkout] init: listo");
  } catch (err) {
    console.error("[Checkout] init error:", err);
    var empty = document.getElementById("checkout-summary-empty");
    var content = document.getElementById("checkout-summary-content");
    var totals = document.getElementById("checkout-totals");
    if (empty) empty.classList.remove("hidden");
    if (content) content.innerHTML = "";
    if (totals) totals.classList.add("hidden");
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
