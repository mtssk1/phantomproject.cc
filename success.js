/**
 * Success — Phantom Project
 * Lee el pedido (localStorage o API), llama a confirm-payment para marcar paid y disparar Discord/email.
 * NUNCA genera orderId; solo lo muestra.
 */

const SUCCESS_STORAGE_KEY = "phantom_success_order";
const DISCORD_URL = "https://discord.gg/QWKxtrREjP";
const API_BASE = "/api";

function getSuccessOrder() {
  try {
    const raw = localStorage.getItem(SUCCESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function formatPrice(price, currency = "USD") {
  if (price == null || Number.isNaN(price)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(price));
}

function renderOrderSummary(data) {
  const container = document.getElementById("success-order-summary");
  if (!container) return;

  const isCustom = data.productType === "custom" || (data.product_type === "custom") || (data.customPackSelections);
  const selections = data.customPackSelections || {};
  const quantity = (data.quantity != null ? Math.max(1, Math.floor(Number(data.quantity))) : 1);
  const displayName = quantity > 1 ? (data.productName || data.product_name || "Producto") + " x" + quantity : (data.productName || data.product_name || "Producto");
  const totalPrice = data.productPrice != null ? Number(data.productPrice) : (data.total != null ? Number(data.total) : 0);
  const unitPrice = data.unitPrice != null ? Number(data.unitPrice) : (data.product_price != null ? Number(data.product_price) : null);
  const unitPriceLine = quantity > 1 && unitPrice != null ? `<p class="mt-0.5 text-xs text-white/55">Precio unitario: ${formatPrice(unitPrice)} · Cantidad: ${quantity}</p>` : "";

  const details = [];
  if (data.selected_money || (selections && selections.dinero)) details.push(data.selected_money || selections.dinero);
  if (data.selected_level || (selections && selections.nivel)) details.push(data.selected_level || selections.nivel);
  if (data.selected_vehicles || (selections && selections.autos)) details.push(data.selected_vehicles || selections.autos);
  const customLine = details.length ? `<p class="success-custom-details mt-1">${details.join(" · ")}</p>` : "";

  const img = data.productImage || data.product_image || "";
  let html = `
    <div class="flex gap-4">
      <img src="${img}" alt="" class="success-order-summary-img" />
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-white">${displayName}</p>
        ${unitPriceLine}
        <p class="mt-1 text-sm font-medium text-[#7C3AED]">Total: ${formatPrice(totalPrice)}</p>
        ${customLine}
      </div>
    </div>
  `;
  container.innerHTML = html;
}

async function sendOrderToDiscordFallback(data) {
  const url = (API_BASE.startsWith("http") ? API_BASE : window.location.origin + API_BASE) + "/send-order-discord";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: data.orderId || data.order_id || "—",
        productName: data.productName || data.product_name || "—",
        quantity: data.quantity != null ? data.quantity : "—",
        total: data.productPrice != null ? data.productPrice : (data.total != null ? data.total : "—"),
        paymentMethod: data.paymentMethod || data.payment_method || "—",
        customer_email: data.customer_email || "",
        customer_discord: data.customer_discord || "",
        customer_discord_id: data.customer_discord_id || "",
      }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function confirmPaymentAndGetOrder(orderId, paymentMethod, paypalOrderId, cryptoInvoiceId, orderData) {
  const baseUrl = API_BASE.startsWith("http") ? API_BASE : window.location.origin + API_BASE;
  const confirmUrl = baseUrl + "/confirm-payment";
  const body = { order_id: orderId, payment_method: paymentMethod || "paypal" };
  if (paypalOrderId) body.paypal_order_id = paypalOrderId;
  if (cryptoInvoiceId) body.crypto_invoice_id = cryptoInvoiceId;
  try {
    const confirmRes = await fetch(confirmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!confirmRes.ok && confirmRes.status === 404 && orderData) {
      await sendOrderToDiscordFallback(orderData);
    }
  } catch (_) {
    if (orderData) sendOrderToDiscordFallback(orderData).catch(function () {});
  }

  const getUrl = baseUrl + "/order?order_id=" + encodeURIComponent(orderId);
  try {
    const res = await fetch(getUrl);
    if (res.ok) return await res.json();
  } catch (_) {}
  return null;
}

function init() {
  const content = document.getElementById("success-content");
  const empty = document.getElementById("success-empty");
  const orderIdEl = document.getElementById("success-order-id");
  const orderIdRepeat = document.getElementById("success-order-id-repeat");
  const copyBtn = document.getElementById("success-copy-id");
  const copyFeedback = document.getElementById("success-copy-feedback");
  const discordBtn = document.getElementById("success-discord-btn");
  const emailMsg = document.getElementById("success-email-msg");

  const data = getSuccessOrder();

  if (!data || !data.orderId) {
    if (content) content.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  const orderId = data.orderId;
  const paymentMethod = data.paymentMethod || "paypal";
  const paypalOrderId = data.paypal_order_id || null;
  const cryptoInvoiceId = data.crypto_invoice_id || null;

  if (content) content.classList.remove("hidden");
  if (empty) empty.classList.add("hidden");

  if (orderIdEl) orderIdEl.textContent = orderId;
  if (orderIdRepeat) orderIdRepeat.textContent = orderId;
  renderOrderSummary(data);

  confirmPaymentAndGetOrder(orderId, paymentMethod, paypalOrderId, cryptoInvoiceId, data).then(function (orderFromApi) {
    if (orderFromApi) {
      renderOrderSummary(orderFromApi);
      if (emailMsg && orderFromApi.email_sent) emailMsg.classList.remove("hidden");
    }
  }).catch(function () {});

  if (discordBtn) {
    discordBtn.href = DISCORD_URL;
    discordBtn.target = "_blank";
    discordBtn.rel = "noopener noreferrer";
  }

  if (copyBtn && orderIdEl) {
    copyBtn.addEventListener("click", function () {
      const id = data.orderId || "";
      if (!id) return;
      navigator.clipboard.writeText(id).then(function () {
        copyFeedback.classList.remove("hidden");
        copyFeedback.classList.add("inline-flex");
        copyFeedback.textContent = "ID copiado";
        copyBtn.textContent = "ID copiado";
        copyBtn.disabled = true;
        setTimeout(function () {
          copyFeedback.classList.add("hidden");
          copyFeedback.classList.remove("inline-flex");
          copyBtn.textContent = "Copiar ID del pedido";
          copyBtn.disabled = false;
        }, 2500);
      }).catch(function () {
        copyBtn.textContent = "Error al copiar";
        setTimeout(function () { copyBtn.textContent = "Copiar ID del pedido"; }, 2000);
      });
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
