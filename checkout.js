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
const SUCCESS_PAGE_URL = "https://phantomproject.cc/success.html";
/** Textos seguros enviados a PayPal en purchase_units (no mencionar marcas). */
const PAYPAL_SAFE_NAME = "Digital Gaming Service";
const PAYPAL_SAFE_DESCRIPTION = "Online Progress Service";

/* ——— NOWPayments (Crypto) ———
 * Crea invoice en api.nowpayments.io y redirige al link de pago. Tras el pago, NOWPayments redirige a success_url (success.html).
 * pay_currency: forzar USDT TRC20 (usdttrc20). Si la API no lo acepta, se ignora y se muestra la recomendación en checkout.
 */
const NOWPAYMENTS_API_KEY = "ZJFNCBG-H6EM4PZ-MDAYGTW-8G968V8";
const NOWPAYMENTS_INVOICE_URL = "https://api.nowpayments.io/v1/invoice";
const NOWPAYMENTS_SUCCESS_URL = "https://phantomproject.cc/success.html";
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
    const url = (API_BASE.startsWith("http") ? API_BASE : window.location.origin + API_BASE) + "/create-order";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("syncOrderToBackend:", e);
    return false;
  }
}

/**
 * Carga el pedido desde storage. Prioriza localStorage, luego sessionStorage.
 * Reutilizable para resumen, PayPal, Crypto y total. Clave: phantom_checkout.
 */
function getOrderFromStorage() {
  try {
    let raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/** Alias para compatibilidad. Usa getOrderFromStorage() en código nuevo. */
function getCheckoutData() {
  return getOrderFromStorage();
}

/**
 * Devuelve la cantidad del pedido (por defecto 1).
 */
function getOrderQuantity() {
  const order = getOrderFromStorage();
  if (!order) return 1;
  const q = order.quantity != null ? Math.max(1, Math.floor(Number(order.quantity))) : 1;
  return Number.isNaN(q) || q < 1 ? 1 : q;
}

/**
 * Devuelve el total numérico del pedido: (precio unitario * cantidad), con cupón si aplica.
 * Reutilizar en resumen, PayPal, Crypto y success.
 */
function getOrderTotal() {
  const order = getOrderFromStorage();
  if (!order || order.productPrice == null) return 0;
  const unitPrice = Number(order.productPrice);
  if (Number.isNaN(unitPrice) || unitPrice < 0) return 0;
  const qty = getOrderQuantity();
  let total = Math.round(unitPrice * qty * 100) / 100;
  if (Number.isNaN(total) || total < 0) return 0;
  if (window.checkoutDiscountApplied) {
    total = Math.round((total * (1 - COUPON_DISCOUNT_PERCENT / 100)) * 100) / 100;
  }
  return total;
}

/** Formatea el total en USD para mostrar en resumen, PayPal, Crypto. */
function formatOrderTotal(total) {
  return formatPrice(total, "USD");
}

/**
 * Total para PayPal: finalTotal = productPrice * quantity (con cupón si aplica); paypalAmount = finalTotal.toFixed(2).
 * Siempre string con punto decimal (ej: "249.90") para PayPal LIVE.
 */
function getPaymentAmountString() {
  const order = getOrderFromStorage();
  if (!order || order.productPrice == null) return "0.00";
  const finalTotal = getOrderTotal();
  const num = Number(finalTotal);
  if (Number.isNaN(num) || num < 0) return "0.00";
  return num.toFixed(2);
}

/** Total numérico para APIs (PayPal amount.value, NOWPayments price_amount). */
function getPaymentAmountNumber() {
  const total = getOrderTotal();
  const num = Number(total);
  if (Number.isNaN(num) || num < 0) return 0;
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
  const data = getOrderFromStorage();
  if (!data || !data.productName) {
    alert("No hay producto en el pedido. Volvé a la tienda.");
    return false;
  }
  const orderId = data.orderId || ensureCheckoutOrderId() || generateOrderId();
  const finalPrice = getOrderTotal();
  const quantity = getOrderQuantity();
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
 * Inicializa el botón oficial de PayPal (SDK cargado en checkout.html).
 * Solo renderiza si el DOM está listo, existe pedido válido y el contenedor existe.
 * El monto se envía con punto decimal (ej: "249.90") para PayPal.
 */
function initPayPalButtons() {
  const container = document.getElementById("paypal-button-container");
  if (!container) return;

  ensureCheckoutOrderId();
  const order = getOrderFromStorage();
  if (!order || !order.productName) {
    container.innerHTML = '<p class="text-sm text-white/50">No hay pedido activo. Agregá un producto desde la tienda.</p>';
    return;
  }

  if (!window.paypal) {
    container.innerHTML = '<p class="text-sm text-white/50">PayPal no está disponible. Recargá la página.</p>';
    return;
  }

  container.innerHTML = "";

  const paypalAmount = getPaymentAmountString();

  try {
    if (typeof window.paypal.Buttons !== "function") {
      throw new Error("PayPal Buttons no disponible");
    }
    window.paypal
      .Buttons({
        createOrder: async function (data, actions) {
          const customer = getCheckoutCustomerData();
          if (!customer.customer_email || !customer.customer_discord) {
            alert("Completá correo electrónico y Discord del cliente antes de pagar.");
            throw new Error("Faltan datos de contacto");
          }
          const synced = await syncOrderToBackend();
          if (!synced) console.warn("No se pudo sincronizar el pedido con el servidor.");
          return actions.order.create({
            purchase_units: [{
              description: PAYPAL_SAFE_DESCRIPTION,
              amount: {
                currency_code: PAYPAL_CURRENCY,
                value: paypalAmount
              }
            }]
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function () {
            completeOrderAndRedirectToSuccess("paypal", { paypalOrderId: data.orderID });
          });
        },
        onError: function (err) {
          console.error("PayPal error:", err);
          alert("Hubo un error al iniciar el pago con PayPal.");
        }
      })
      .render("#paypal-button-container");
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
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  if (container.querySelector("iframe")) return;

  const order = getOrderFromStorage();
  if (!order || !order.productName) {
    container.innerHTML = '<p class="text-sm text-white/50">No hay pedido activo. Agregá un producto desde la tienda.</p>';
    return;
  }

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
  ensureCheckoutOrderId();
  const order = getOrderFromStorage();
  if (!order || !order.productName) {
    alert("No hay producto en el pedido. Agregá un producto desde la tienda.");
    return;
  }
  const customer = getCheckoutCustomerData();
  if (!customer.customer_email || !customer.customer_discord) {
    alert("Completá correo electrónico y Discord del cliente antes de continuar.");
    return;
  }

  const synced = await syncOrderToBackend();
  if (!synced) console.warn("No se pudo sincronizar el pedido con el servidor.");

  const priceAmount = getPaymentAmountNumber();
  if (!priceAmount || priceAmount <= 0) {
    alert("El total del pedido no es válido.");
    return;
  }

  const orderId = order.orderId;
  const quantity = getOrderQuantity();
  const orderDescription = quantity > 1 ? (order.productName || "Phantom Project Order") + " x" + quantity : (order.productName || "Phantom Project Order");

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

  const body = {
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
      const invoiceUrl = data.invoice_url;
      if (invoiceUrl) {
        if (data.id) successPayload.crypto_invoice_id = data.id;
        try { localStorage.setItem(SUCCESS_STORAGE_KEY, JSON.stringify(successPayload)); } catch (_) {}
        window.location.href = invoiceUrl;
      } else {
        throw new Error("No se recibió el link de pago.");
      }
    })
    .catch(function (err) {
      console.error("NOWPayments error:", err);
      alert(err.message || "No se pudo crear el enlace de pago. Intentá de nuevo o usá otro método.");
      try {
        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(order));
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
 * Renderiza el resumen del pedido (imagen, nombre, características, entrega, total).
 * Usa getOrderFromStorage() y getOrderTotal() para datos y precio real.
 */
function renderSummary() {
  const content = document.getElementById("checkout-summary-content");
  const empty = document.getElementById("checkout-summary-empty");
  const totals = document.getElementById("checkout-totals");
  const couponWrap = document.getElementById("checkout-coupon-wrap");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const cryptoAmountEl = document.getElementById("checkout-crypto-amount");

  let data;
  try {
    data = getOrderFromStorage();
  } catch (e) {
    console.error("renderSummary getOrderFromStorage:", e);
    if (content) content.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    if (totals) totals.classList.add("hidden");
    if (couponWrap) couponWrap.classList.add("hidden");
    return null;
  }

  if (!data || !data.productName) {
    if (content) content.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    if (totals) totals.classList.add("hidden");
    if (couponWrap) couponWrap.classList.add("hidden");
    if (cryptoAmountEl) cryptoAmountEl.textContent = "Total: — USD";
    return null;
  }

  if (empty) empty.classList.add("hidden");
  if (totals) totals.classList.remove("hidden");
  if (couponWrap) couponWrap.classList.remove("hidden");

  const unitPrice = Number(data.productPrice) || 0;
  const quantity = getOrderQuantity();
  const subtotalRaw = Math.round(unitPrice * quantity * 100) / 100;
  const finalPrice = getOrderTotal();
  const isCustom = data.productType === "custom" && data.customPackSelections;
  const productId = data.productId || "";
  const pack = getPackById(productId) || getPackByProductName(data.productName);
  const features = pack && pack.features && Array.isArray(pack.features) ? pack.features : [];
  const deliveryText = getDeliveryEstimate(productId || (pack && pack.id ? pack.id : ""));

  const displayName = quantity > 1 ? (data.productName || "Producto") + " x" + quantity : (data.productName || "Producto");
  const unitAndQtyHtml = quantity > 1
    ? `<p class="checkout-summary-unit-qty text-xs text-white/60 mt-1">Precio unitario: ${formatPrice(unitPrice)} · Cantidad: ${quantity}</p>`
    : "";

  const featuresHtml = features.length
    ? `<ul class="checkout-summary-features">${features.map((f) => `<li>${f}</li>`).join("")}</ul>`
    : "";
  const deliveryHtml = `<p class="checkout-summary-delivery">${deliveryText}</p>`;

  const html = `
    <div class="checkout-summary-product">
      <img src="${data.productImage || ""}" alt="" />
      <div class="checkout-summary-details">
        <p class="font-semibold text-white">${displayName}</p>
        ${unitAndQtyHtml}
        ${isCustom && data.customPackSelections ? `<p class="checkout-summary-selections">${[data.customPackSelections.dinero, data.customPackSelections.nivel, data.customPackSelections.autos].filter(Boolean).join(" · ")}</p>` : ""}
        ${featuresHtml}
        ${deliveryHtml}
      </div>
    </div>
  `;

  if (content) content.innerHTML = html;

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotalRaw);
  if (totalEl) {
    totalEl.textContent = formatOrderTotal(finalPrice);
    totalEl.dataset.finalPrice = String(finalPrice);
  }
  if (cryptoAmountEl) cryptoAmountEl.textContent = "Total: " + formatOrderTotal(finalPrice);

  return { data, unitPrice, finalPrice };
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
  try {
    const data = getCheckoutData();
    renderSummary();
    setupCoupon();
    setupForm();
    setupCountryPaymentToggle();
    setupPayPalCryptoDiscord();
  } catch (err) {
    console.error("Checkout init error:", err);
    const empty = document.getElementById("checkout-summary-empty");
    const content = document.getElementById("checkout-summary-content");
    if (empty) empty.classList.remove("hidden");
    if (content) content.innerHTML = "";
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
