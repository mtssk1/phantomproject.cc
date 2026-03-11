// Editá estos 2 links y ya queda todo conectado.
const LINKS = {
  discord: "https://discord.gg/QWKxtrREjP",
  youtube: "https://www.youtube.com/@PhantomProyect",
  tiktok: "https://www.tiktok.com/@phantomproject.cc",
};

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function applyLinks() {
  const nodes = document.querySelectorAll("[data-link]");
  for (const el of nodes) {
    const key = el.getAttribute("data-link");
    const url = LINKS[key];
    if (!url) continue;
    if (el instanceof HTMLAnchorElement) {
      el.href = url;
      if (key === "youtube" || key === "tiktok") el.target = "_blank";
      if (key === "discord") el.target = "_self";
      el.rel = "noreferrer";
    }
  }
}

function setupMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    links.classList.remove("open");
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    links.classList.toggle("open", !isOpen);
  });

  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function formatCount(value) {
  if (Number.isNaN(value)) return "0";
  if (Number.isInteger(value)) return value.toLocaleString("es-AR");
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

function animateCounters() {
  const els = Array.from(document.querySelectorAll(".kpi-value[data-count]"));
  if (!els.length) return;
  if (prefersReducedMotion) {
    for (const el of els) {
      const target = Number(el.getAttribute("data-count") ?? "0");
      el.textContent = formatCount(target);
    }
    return;
  }

  const durationMs = 900;
  const startAt = performance.now();

  const targets = els.map((el) => ({
    el,
    target: Number(el.getAttribute("data-count") ?? "0"),
  }));

  const tick = (now) => {
    const t = Math.min(1, (now - startAt) / durationMs);
    const ease = 1 - Math.pow(1 - t, 3);

    for (const { el, target } of targets) {
      const v = target * ease;
      el.textContent = formatCount(target % 1 === 0 ? Math.round(v) : Number(v.toFixed(1)));
    }

    if (t < 1) requestAnimationFrame(tick);
  };

  // Solo dispara cuando el hero está visible
  const hero = document.querySelector("#inicio");
  if (!hero || !("IntersectionObserver" in window)) {
    requestAnimationFrame(tick);
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      if (entries.some((x) => x.isIntersecting)) {
        obs.disconnect();
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.35 }
  );
  obs.observe(hero);
}

// --- Background animado: network + partículas (canvas) + orbes (DOM) + parallax ---
const PARALLAX_STRENGTH = 0.025;
const SCROLL_PARALLAX = 0.03;
const MOUSE_THROTTLE_MS = 32;

function setupAnimatedBackground() {
  const canvas = document.getElementById("bg-canvas");
  const orbsContainer = document.getElementById("bg-orbs");
  if (!(canvas instanceof HTMLCanvasElement) || !orbsContainer) return;

  const rand = (min, max) => min + Math.random() * (max - min);
  const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  let w = 0, h = 0;
  let nodes = [];
  let particles = [];
  let mouseX = 0.5, mouseY = 0.5;
  let scrollY = 0;
  let rafId = null;

  // --- Canvas: nodos (red) + partículas ---
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const NODE_COUNT = 48;
  const PARTICLE_COUNT = 120;
  const LINE_DIST = 140;
  const NODE_OPACITY = 0.12;
  const LINE_OPACITY = 0.10;
  const PARTICLE_OPACITY = 0.15;

  function resizeCanvas() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-0.75, 0.75),
      vy: rand(-0.6, 0.75),
    }));
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-1.2, 1.2),
      vy: rand(-1.0, 1.2),
      r: rand(0.8, 1.5),
      a: rand(0.06, PARTICLE_OPACITY),
    }));
  }

  function drawFrame() {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    // Drift nodos (solo si no reduced motion)
    if (!prefersReducedMotion) {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
      }
    }

    // Líneas entre nodos cercanos (red/constelación)
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < LINE_DIST) {
          const alpha = (1 - d / LINE_DIST) * LINE_OPACITY;
          ctx.strokeStyle = `rgba(165, 140, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Puntos de la red
    for (const n of nodes) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(200, 180, 255, ${NODE_OPACITY})`;
      ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Partículas pequeñas (1–2px)
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 210, 255, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(drawFrame);
  }

  resizeCanvas();
  window.addEventListener("resize", () => {
    resizeCanvas();
  }, { passive: true });

  if (prefersReducedMotion) {
    drawFrame(); // un solo frame estático
  } else {
    rafId = requestAnimationFrame(drawFrame);
  }

  // --- Orbes: crear 8 divs con tamaños/posiciones random ---
  const orbVariants = ["bg-orb--1", "bg-orb--2", "bg-orb--3", "bg-orb--4", "bg-orb--5", "bg-orb--6", "bg-orb--7", "bg-orb--8"];
  const floatClasses = ["bg-orb--float", "bg-orb--float-slow", "bg-orb--float-slower"];
  const rotateClasses = ["bg-orb--rotate", "bg-orb--rotate-slow"];
  const orbCount = 8;
  const orbElements = [];

  for (let i = 0; i < orbCount; i++) {
    const size = Math.floor(rand(70, 180));
    const wrap = document.createElement("div");
    wrap.className = "bg-orb-wrap";
    wrap.style.left = rand(5, 85) + "%";
    wrap.style.top = rand(10, 80) + "%";
    const el = document.createElement("div");
    el.className = "bg-orb " + orbVariants[i % orbVariants.length] + " " + floatClasses[i % floatClasses.length] + " " + (i % 2 === 0 ? rotateClasses[0] : rotateClasses[1]);
    el.style.width = size + "px";
    el.style.height = size + "px";
    wrap.appendChild(el);
    orbsContainer.appendChild(wrap);
    orbElements.push(wrap);
  }

  // Parallax: mouse (throttled) + scroll — aplicado al wrapper para no pisar animación CSS
  let lastMouseTime = 0;
  let currentMouseX = 0.5, currentMouseY = 0.5;
  let targetMouseX = 0.5, targetMouseY = 0.5;

  function updateOrbParallax() {
    const centerX = w / 2, centerY = h / 2;
    const moveX = (currentMouseX * w - centerX) * PARALLAX_STRENGTH;
    const moveY = (currentMouseY * h - centerY) * PARALLAX_STRENGTH;
    const scrollOffset = scrollY * SCROLL_PARALLAX;

    orbElements.forEach((wrap, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      const tx = moveX * (0.5 + (i % 3) * 0.3) * sign;
      const ty = moveY * (0.5 + (i % 2) * 0.4) + scrollOffset * 0.5;
      wrap.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
    });
  }

  function onMouseMove(e) {
    const t = performance.now();
    if (t - lastMouseTime < MOUSE_THROTTLE_MS) return;
    lastMouseTime = t;
    targetMouseX = e.clientX / w;
    targetMouseY = e.clientY / h;
  }

  function tickParallax() {
    currentMouseX += (targetMouseX - currentMouseX) * 0.08;
    currentMouseY += (targetMouseY - currentMouseY) * 0.08;
    updateOrbParallax();
    requestAnimationFrame(tickParallax);
  }

  window.addEventListener("mousemove", onMouseMove, { passive: true });
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY ?? document.documentElement.scrollTop;
  }, { passive: true });

  tickParallax();
}

const COUPON_CODE = "STREAMS";
const COUPON_STORAGE_KEY = "phantom_discount_10";

function setupCouponModal() {
  const btn = document.getElementById("rewards-tab-btn");
  const modal = document.getElementById("coupon-modal");
  const form = document.getElementById("coupon-form");
  const input = document.getElementById("coupon-input");
  const messageEl = document.getElementById("coupon-message");
  const backdrop = modal?.querySelector(".coupon-modal-backdrop");
  const closeBtn = modal?.querySelector(".coupon-modal-close");

  if (!btn || !modal || !form || !input || !messageEl) return;

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "coupon-message " + (type === "success" ? "success" : type === "error" ? "error" : "");
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function openModal() {
    messageEl.textContent = "";
    messageEl.className = "coupon-message";
    input.value = "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    input.focus();
  }

  btn.addEventListener("click", openModal);

  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (code === COUPON_CODE) {
      try {
        localStorage.setItem(COUPON_STORAGE_KEY, "10");
      } catch (_) {}
      showMessage("¡10% de descuento aplicado! Al coordinar tu pedido en Discord, mencioná que tenés el código.", "success");
      setTimeout(closeModal, 2800);
    } else {
      showMessage("Código inválido. Revisá e intentá de nuevo.", "error");
    }
  });
}

function setupPolicyModal() {
  const modal = document.getElementById("policy-modal");
  const body = document.getElementById("policy-modal-body");
  const backdrop = modal?.querySelector(".policy-modal-backdrop");
  const closeBtn = modal?.querySelector(".policy-modal-close");
  const links = document.querySelectorAll(".footer-policy-link[data-section]");

  if (!modal || !body) return;

  function closePolicyModal() {
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    document.body.style.overflow = "";
  }

  function openPolicyModal(sectionId) {
    modal.setAttribute("aria-hidden", "false");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    const el = sectionId ? document.getElementById(sectionId) : null;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  links.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openPolicyModal(btn.getAttribute("data-section"));
    });
  });

  closeBtn?.addEventListener("click", closePolicyModal);
  backdrop?.addEventListener("click", closePolicyModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closePolicyModal();
  });
}

// --- Shopify: base URL y API del carrito ---
function getShopifyBaseUrl() {
  const config = window.PACKS_CONFIG;
  const url = config && config.shopifyStoreUrl && String(config.shopifyStoreUrl).trim();
  if (!url) return "";
  const clean = url.replace(/^https?:(\/\/)?/, "");
  return "https://" + clean;
}

function isShopifyEnabled() {
  return !!getShopifyBaseUrl();
}

async function fetchCartShopify() {
  const base = getShopifyBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(base + "/cart.js", { method: "GET", credentials: "omit" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function changeCartItemShopify(lineItemKey, quantity) {
  const base = getShopifyBaseUrl();
  if (!base || !lineItemKey) return { ok: false };
  try {
    const res = await fetch(base + "/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: String(lineItemKey), quantity: Number(quantity) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.description || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// --- Carrito (drawer): Shopify real o local ---
const CART_STORAGE_KEY = "phantom_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function setCart(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (_) {}
  if (!isShopifyEnabled()) {
    updateCartBadge();
    renderCart();
  }
}

function addToCart(id, name, image, price, quantity = 1, customData = null) {
  const cart = getCart();
  const numPrice = Number(price) || 0;
  const existing = cart.find((i) => i.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ id, name, image, price: numPrice, quantity, ...(customData || {}) });
  }
  setCart(cart);
}

function removeFromCart(id) {
  setCart(getCart().filter((i) => i.id !== id));
}

function updateCartItemQuantity(id, quantity) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  const q = Math.max(0, Math.floor(Number(quantity)));
  if (q < 1) {
    removeFromCart(id);
    return;
  }
  item.quantity = q;
  setCart([...cart]);
}

function formatPrice(price, currency) {
  if (price === 0) return "Consultar";
  const cur = currency || (window.PACKS_CONFIG && window.PACKS_CONFIG.currency) || "USD";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(price);
}

function formatMoney(cents, currency) {
  return formatPrice(cents / 100, currency);
}

// --- Checkout: guardar datos y redirigir a checkout.html ---
const CHECKOUT_STORAGE_KEY = "phantom_checkout";

function saveCheckoutAndRedirect(payload) {
  if (!payload || (typeof payload !== "object")) {
    console.error("[Checkout] saveCheckoutAndRedirect: payload inválido", payload);
    return;
  }
  var base = {
    productName: payload.productName != null ? String(payload.productName) : "",
    productPrice: payload.productPrice != null ? Number(payload.productPrice) : 0,
    productImage: payload.productImage != null ? String(payload.productImage) : "",
    quantity: payload.quantity != null ? Math.max(1, Math.floor(Number(payload.quantity))) : 1,
  };
  if (payload.productType != null) base.productType = payload.productType;
  if (payload.productId != null) base.productId = payload.productId;
  if (payload.customPackSelections != null) base.customPackSelections = payload.customPackSelections;
  if (payload.selectedMoney != null) base.selectedMoney = payload.selectedMoney;
  if (payload.selectedLevel != null) base.selectedLevel = payload.selectedLevel;
  if (payload.selectedVehicles != null) base.selectedVehicles = payload.selectedVehicles;
  if (base.customPackSelections && !base.selectedMoney) base.selectedMoney = base.customPackSelections.dinero;
  if (base.customPackSelections && !base.selectedLevel) base.selectedLevel = base.customPackSelections.nivel;
  if (base.customPackSelections && !base.selectedVehicles) base.selectedVehicles = base.customPackSelections.autos;
  if (!base.productName && (base.productPrice > 0 || payload.name)) base.productName = payload.name || "Producto";

  console.log("[Checkout] Payload armado en tienda:", base);
  try {
    var json = JSON.stringify(base);
    localStorage.setItem(CHECKOUT_STORAGE_KEY, json);
    localStorage.setItem("checkoutProduct", json);
    sessionStorage.setItem(CHECKOUT_STORAGE_KEY, json);
    sessionStorage.setItem("checkoutProduct", json);
    console.log("[Checkout] Guardado en phantom_checkout y checkoutProduct (localStorage + sessionStorage)");
  } catch (e) {
    console.error("[Checkout] Error al guardar en storage:", e);
  }
  console.log("[Checkout] Redirigiendo a checkout");
  window.location.href = "/checkout";
}

function buildCheckoutPayloadFromPack(pack, price, customPackSelections) {
  var payload = {
    productName: pack.title,
    productImage: pack.image || "",
    productPrice: price != null ? Number(price) : pack.price,
    quantity: 1,
    productType: customPackSelections ? "custom" : "normal",
    productId: pack.id || "",
    customPackSelections: customPackSelections || undefined,
  };
  if (customPackSelections) {
    payload.selectedMoney = customPackSelections.dinero;
    payload.selectedLevel = customPackSelections.nivel;
    payload.selectedVehicles = customPackSelections.autos;
  }
  return payload;
}

function buildCheckoutPayloadFromCartItem(item) {
  var isCustom = !!(item.customPackSelections || (item.id && String(item.id).startsWith("custom")));
  var qty = item.quantity != null ? Math.max(1, Math.floor(Number(item.quantity))) : 1;
  var payload = {
    productName: item.name,
    productImage: item.image || "",
    productPrice: Number(item.price) || 0,
    quantity: qty,
    productType: isCustom ? "custom" : "normal",
    productId: isCustom ? "custom" : (item.id || ""),
    customPackSelections: item.customPackSelections || undefined,
  };
  if (item.customPackSelections) {
    payload.selectedMoney = item.customPackSelections.dinero;
    payload.selectedLevel = item.customPackSelections.nivel;
    payload.selectedVehicles = item.customPackSelections.autos;
  }
  return payload;
}

/** Botón "Finalizar compra" del carrito: guarda primer ítem y redirige a checkout.html */
function applyCheckoutButton() {
  var btn = document.getElementById("cart-checkout");
  if (!btn) return;
  btn.textContent = "Finalizar compra";
  btn.href = "/checkout";
  btn.removeAttribute("data-link");
  btn.addEventListener("click", function goToCheckout(e) {
    e.preventDefault();
    if (isShopifyEnabled()) {
      fetchCartShopify().then(function (cart) {
        var first = cart && cart.items && cart.items[0];
        if (first) {
          var qty = first.quantity != null ? Math.max(1, Math.floor(Number(first.quantity))) : 1;
          saveCheckoutAndRedirect({
            productName: first.title,
            productImage: first.image || "",
            productPrice: (first.price || 0) / 100,
            quantity: qty,
            productType: "normal",
            productId: first.variant_id || "",
          });
        } else {
          window.location.href = "/checkout";
        }
      });
      return;
    }
    var cart = getCart();
    var first = cart[0];
    if (first) {
      saveCheckoutAndRedirect(buildCheckoutPayloadFromCartItem(first));
    } else {
      window.location.href = "/checkout";
    }
  });
}

function renderCart() {
  const container = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const subtotalEl = document.getElementById("cart-subtotal");
  const checkoutBtn = document.getElementById("cart-checkout");
  const viewCartLink = document.getElementById("cart-view-cart");
  if (!container || !emptyEl || !subtotalEl) return;

  if (isShopifyEnabled()) {
    fetchCartShopify().then((cart) => {
      applyCheckoutButton();
      if (viewCartLink) {
        viewCartLink.href = getShopifyBaseUrl() + "/cart";
        viewCartLink.classList.remove("hidden");
      }
      if (!cart || !cart.items || cart.items.length === 0) {
        container.innerHTML = "";
        emptyEl.classList.remove("hidden");
        subtotalEl.textContent = formatMoney(0);
        if (checkoutBtn) checkoutBtn.classList.add("opacity-50", "pointer-events-none");
        return;
      }
      emptyEl.classList.add("hidden");
      if (checkoutBtn) checkoutBtn.classList.remove("opacity-50", "pointer-events-none");
      subtotalEl.textContent = formatMoney(cart.total_price);
      container.innerHTML = cart.items
        .map(
          (item) => `
        <div class="cart-item flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3" data-cart-key="${item.key}">
          <img src="${item.image || ""}" alt="" class="h-16 w-16 flex-shrink-0 rounded-lg object-cover bg-white/5" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-white truncate">${item.title}</p>
            <p class="text-sm text-white/60">${item.variant_title || ""}</p>
            <div class="mt-2 flex items-center gap-1.5">
              <span class="text-sm text-white/50">x</span>
              <input type="number" min="0" value="${item.quantity}" class="cart-qty-input h-8 w-14 rounded-lg border border-white/15 bg-white/5 px-2 text-center text-sm text-white" data-cart-key="${item.key}" aria-label="Cantidad" />
            </div>
            <p class="mt-1.5 text-xs text-white/50">${formatMoney(item.price)} c/u</p>
            <p class="mt-0.5 text-sm font-semibold text-white/90">${formatMoney(item.line_price)}</p>
          </div>
          <button type="button" class="cart-item-remove flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white/50 hover:bg-red-500/20 hover:text-red-400" data-cart-key="${item.key}" aria-label="Quitar">×</button>
        </div>
      `
        )
        .join("");
      container.querySelectorAll(".cart-qty-input").forEach((input) => {
        input.addEventListener("keydown", async (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const key = input.getAttribute("data-cart-key");
          const q = Math.max(0, Math.floor(Number(input.value)));
          if (!key) return;
          input.disabled = true;
          const result = await changeCartItemShopify(key, q);
          input.disabled = false;
          if (result.ok) {
            renderCart();
            updateCartBadge();
          } else if (result.error) alert(result.error);
        });
      });
      container.querySelectorAll(".cart-item-remove").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const key = btn.getAttribute("data-cart-key");
          if (!key) return;
          btn.disabled = true;
          const result = await changeCartItemShopify(key, 0);
          btn.disabled = false;
          if (result.ok) {
            renderCart();
            updateCartBadge();
          } else if (result.error) {
            alert(result.error);
          }
        });
      });
    });
    return;
  }

  const cart = getCart();
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  if (viewCartLink) viewCartLink.classList.add("hidden");

  if (cart.length === 0) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    subtotalEl.textContent = formatPrice(0);
    if (checkoutBtn) checkoutBtn.classList.add("opacity-50", "pointer-events-none");
    return;
  }

  emptyEl.classList.add("hidden");
  if (checkoutBtn) checkoutBtn.classList.remove("opacity-50", "pointer-events-none");
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  subtotalEl.textContent = formatPrice(subtotal);
  container.innerHTML = cart
    .map(
      (item) => {
        const selectionsHtml = item.customPackSelections
          ? `<p class="mt-1 text-xs text-white/60">${[item.customPackSelections.dinero, item.customPackSelections.nivel, item.customPackSelections.autos].filter(Boolean).join(" · ")}</p>`
          : "";
        return `
    <div class="cart-item flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3" data-cart-id="${item.id}">
      <img src="${item.image}" alt="" class="h-16 w-16 flex-shrink-0 rounded-lg object-cover bg-white/5" />
      <div class="min-w-0 flex-1">
        <p class="font-medium text-white truncate">${item.name}</p>
        ${selectionsHtml}
        <div class="mt-2 flex items-center gap-1.5">
          <span class="text-sm text-white/50">x</span>
          <input type="number" min="0" value="${item.quantity}" class="cart-qty-input h-8 w-14 rounded-lg border border-white/15 bg-white/5 px-2 text-center text-sm text-white" data-cart-id="${item.id}" aria-label="Cantidad" />
        </div>
        <p class="mt-1.5 text-xs text-white/50">${formatPrice(item.price)} c/u</p>
        <p class="mt-0.5 text-sm font-semibold text-white/90">${formatPrice(item.price * item.quantity)}</p>
      </div>
      <button type="button" class="cart-item-remove flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white/50 hover:bg-red-500/20 hover:text-red-400" data-cart-id="${item.id}" aria-label="Quitar">×</button>
    </div>
  `;
      }
    )
    .join("");
  container.querySelectorAll(".cart-qty-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const id = input.getAttribute("data-cart-id");
      const q = Math.max(0, Math.floor(Number(input.value)));
      if (id) {
        updateCartItemQuantity(id, q);
      }
    });
  });
  container.querySelectorAll(".cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-cart-id");
      if (id) {
        removeFromCart(id);
      }
    });
  });
}

function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  if (isShopifyEnabled()) {
    fetchCartShopify().then((cart) => {
      const total = cart && cart.item_count ? cart.item_count : 0;
      badge.textContent = total;
      badge.style.display = total > 0 ? "flex" : "none";
    });
    return;
  }
  const total = getCart().reduce((s, i) => s + i.quantity, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? "flex" : "none";
}

function openCart() {
  renderCart();
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (drawer) drawer.classList.add("cart-drawer--open");
  if (overlay) {
    overlay.classList.remove("opacity-0");
    overlay.setAttribute("aria-hidden", "false");
  }
  document.body.style.overflow = "hidden";
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (drawer) drawer.classList.remove("cart-drawer--open");
  if (overlay) {
    overlay.classList.add("opacity-0");
    overlay.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "";
}

function setupCart() {
  const trigger = document.getElementById("cart-trigger");
  const closeBtn = document.querySelector(".cart-close");
  const overlay = document.getElementById("cart-overlay");

  trigger?.addEventListener("click", openCart);
  closeBtn?.addEventListener("click", closeCart);
  overlay?.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const drawer = document.getElementById("cart-drawer");
      if (drawer?.classList.contains("cart-drawer--open")) closeCart();
    }
  });

  document.querySelectorAll(".btn-add-cart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest("[data-pack-id]");
      if (!card) return;
      const id = card.getAttribute("data-pack-id");
      const pack = getPackById(id);
      if (pack) handleAddToCart(pack, btn, () => openCart());
    });
  });

  applyCheckoutButton();
  updateCartBadge();
  renderCart();
}

// --- Modal de producto y packs desde config ---
function getPackById(id) {
  return window.PACKS_CONFIG && window.PACKS_CONFIG.products && window.PACKS_CONFIG.products[id];
}

function renderPackCard(pack) {
  const isCustomPack = pack.id === "custom";
  const card = document.createElement("div");
  card.className =
    "pack-card group relative flex cursor-pointer flex-col rounded-2xl border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-xl transition hover:border-accent/30 hover:shadow-glass-hover";
  card.setAttribute("data-pack-id", pack.id);
  let badgeHtml = "";
  if (pack.badge) {
    badgeHtml = `<span class="pack-badge">${pack.badge}</span>`;
  }
  const verMasHtml = isCustomPack ? "" : `<button type="button" class="pack-card-vermas mt-4 self-start text-sm font-medium text-white/60 underline-offset-2 hover:text-white hover:underline">Ver más</button>`;
  const mainButtonText = isCustomPack ? "Personalizar pack" : "Add to Cart";
  card.innerHTML = `
    ${badgeHtml}
    <div class="pack-card-content cursor-pointer flex flex-col flex-1" role="button" tabindex="0">
      <img src="${pack.image}" alt="${pack.title}" class="mb-5 h-52 w-full rounded-xl object-contain object-center bg-white/5" />
      <h3 class="pack-card-title font-heading text-2xl font-extrabold tracking-tight text-white">${pack.title}</h3>
      <p class="mt-2 text-base font-semibold text-violet-400">${formatPrice(pack.price, "USD")}</p>
      ${verMasHtml}
    </div>
    <div class="mt-6 flex flex-col gap-2">
      <button type="button" class="btn-add-cart btn-primary w-full rounded-xl py-3 text-base font-semibold">${mainButtonText}</button>
      <a href="#" data-link="discord" rel="noreferrer" class="pack-card-discord mt-1 text-center text-sm font-medium text-white/50 hover:text-white/80">Need help? Contact on Discord</a>
    </div>
  `;
  const content = card.querySelector(".pack-card-content");
  const discordLink = card.querySelector(".pack-card-discord");
  const addBtn = card.querySelector(".btn-add-cart");
  const verMasBtn = card.querySelector(".pack-card-vermas");
  content.addEventListener("click", () => openProductModal(pack.id));
  content.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProductModal(pack.id);
    }
  });
  if (verMasBtn) {
    verMasBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      openProductModal(pack.id);
    });
  }
  if (discordLink) {
    if (typeof LINKS !== "undefined" && LINKS.discord) discordLink.href = LINKS.discord;
    discordLink.addEventListener("click", (e) => e.stopPropagation());
  }
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCustomPack) {
      openProductModal(pack.id);
    } else {
      handleAddToCart(pack, addBtn, openCart);
    }
  });
  return card;
}

function initPacksGrid() {
  const config = window.PACKS_CONFIG;
  if (!config || !config.products) return;
  const packsContainer = document.getElementById("packs-container");
  if (packsContainer) {
    packsContainer.innerHTML = "";
    const ids = config.mainPackIds || [];
    for (const id of ids) {
      const pack = config.products[id];
      if (!pack) continue;
      const card = renderPackCard(pack);
      packsContainer.appendChild(card);
    }
    const verMas = document.createElement("a");
    verMas.href = "mas-packs.html";
    verMas.className = "flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-accent/30 hover:bg-white/[0.08]";
    verMas.innerHTML = '<span class="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">Ver más packs</span>';
    packsContainer.appendChild(verMas);
  }
  const servicesContainer = document.getElementById("services-container");
  if (servicesContainer) {
    servicesContainer.innerHTML = "";
    for (const id of config.serviceIds || []) {
      const pack = config.products[id];
      if (!pack) continue;
      const card = renderPackCard(pack);
      servicesContainer.appendChild(card);
    }
  }
}

// --- Configurador Custom Pack (estado y helpers) ---
function getCustomPackConfig() {
  return (window.PACKS_CONFIG && window.PACKS_CONFIG.customPackConfig) || null;
}

function getCustomPackSelections() {
  const cfg = getCustomPackConfig();
  if (!cfg) return null;
  return {
    dinero: cfg.defaultDinero,
    nivel: cfg.defaultNivel,
    autos: cfg.defaultAutos,
  };
}

function computeCustomPackTotal(selections) {
  const cfg = getCustomPackConfig();
  if (!cfg) return cfg.basePrice;
  const base = Number(cfg.basePrice) || 0;
  const findExtra = (arr, value) => (arr && arr.find((o) => o.value === value)) || { extra: 0 };
  const d = findExtra(cfg.dinero, selections.dinero);
  const n = findExtra(cfg.nivel, selections.nivel);
  const a = findExtra(cfg.autos, selections.autos);
  const total = base + Number(d.extra) + Number(n.extra) + Number(a.extra);
  return Math.round(total * 100) / 100;
}

function renderCustomPackConfigurator(containerId, options, selectedValue, groupName) {
  const container = document.getElementById(containerId);
  if (!container || !options || !Array.isArray(options)) return;
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "configurator-option-btn rounded-xl border px-4 py-2.5 text-sm font-medium transition " + (opt.value === selectedValue ? "configurator-option-btn--selected border-accent bg-accent/10 text-white" : "border-white/20 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10");
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.dataset.group = groupName;
    btn.setAttribute("aria-pressed", opt.value === selectedValue ? "true" : "false");
    container.appendChild(btn);
  });
}

function initCustomPackModal(pack) {
  const cfg = getCustomPackConfig();
  if (!cfg) return;
  const normalWrap = document.getElementById("product-modal-normal-wrapper");
  const customWrap = document.getElementById("product-modal-custom-wrapper");
  const priceEl = document.getElementById("custom-config-price");
  const imgEl = document.getElementById("product-modal-img");
  if (normalWrap) normalWrap.classList.add("hidden");
  if (customWrap) {
    customWrap.classList.remove("hidden");
    customWrap.setAttribute("aria-hidden", "false");
  }
  if (imgEl) {
    imgEl.src = pack.image;
    imgEl.alt = pack.title;
  }
  var state = {
    dinero: cfg.defaultDinero,
    nivel: cfg.defaultNivel,
    autos: cfg.defaultAutos,
  };
  if (customWrap) customWrap._customPackState = state;

  function updatePrice() {
    var s = customWrap && customWrap._customPackState;
    if (!s) return;
    var total = computeCustomPackTotal(s);
    if (priceEl) priceEl.textContent = formatPrice(total, cfg.currency);
  }

  function renderAll() {
    var s = customWrap && customWrap._customPackState;
    if (!s) return;
    renderCustomPackConfigurator("custom-config-dinero", cfg.dinero, s.dinero, "dinero");
    renderCustomPackConfigurator("custom-config-nivel", cfg.nivel, s.nivel, "nivel");
    renderCustomPackConfigurator("custom-config-autos", cfg.autos, s.autos, "autos");
    updatePrice();
  }

  if (customWrap && !customWrap._customPackClickBound) {
    customWrap._customPackClickBound = true;
    customWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-group][data-value]");
      if (!btn) return;
      var group = btn.getAttribute("data-group");
      var value = btn.getAttribute("data-value");
      var st = customWrap._customPackState;
      if (!st || !group || !value || !st.hasOwnProperty(group)) return;
      st[group] = value;
      renderAll();
    });
  }

  renderAll();
}

function getCustomPackStateFromModal() {
  const wrap = document.getElementById("product-modal-custom-wrapper");
  return (wrap && wrap._customPackState) || null;
}

function getCustomPackSelectionsForCart() {
  const state = getCustomPackStateFromModal();
  const cfg = getCustomPackConfig();
  if (!state || !cfg) return null;
  const findLabel = (arr, value) => (arr && arr.find((o) => o.value === value)) || { label: value };
  return {
    dinero: findLabel(cfg.dinero, state.dinero).label,
    nivel: findLabel(cfg.nivel, state.nivel).label,
    autos: findLabel(cfg.autos, state.autos).label,
  };
}

function addCustomPackToCart(openMiniCart) {
  const state = getCustomPackStateFromModal();
  const cfg = getCustomPackConfig();
  const pack = getPackById("custom");
  if (!state || !cfg || !pack) return;
  if (!state.dinero || !state.nivel || (state.autos === undefined || state.autos === null)) {
    alert("Por favor elegí una opción en cada categoría (Dinero, Nivel, Autos y atuendos).");
    return;
  }
  const total = computeCustomPackTotal(state);
  const selections = getCustomPackSelectionsForCart();
  const customId = "custom-" + state.dinero + "-" + state.nivel + "-" + state.autos;
  addToCart(customId, pack.title, pack.image, total, 1, { customPackSelections: selections });
  const addedMsg = document.getElementById("product-modal-added-msg");
  if (addedMsg) {
    addedMsg.textContent = "Agregado al carrito";
    addedMsg.classList.remove("hidden");
  }
  closeProductModal();
  onAddedToCartFeedback(openMiniCart);
}

function buyNowCustomPack() {
  const state = getCustomPackStateFromModal();
  const cfg = getCustomPackConfig();
  const pack = getPackById("custom");
  if (!state || !cfg || !pack) return;
  if (!state.dinero || !state.nivel || (state.autos === undefined || state.autos === null)) {
    alert("Por favor elegí una opción en cada categoría (Dinero, Nivel, Autos y atuendos).");
    return;
  }
  const total = computeCustomPackTotal(state);
  const selections = getCustomPackSelectionsForCart();
  saveCheckoutAndRedirect(buildCheckoutPayloadFromPack(pack, total, selections));
  closeProductModal();
}

function openProductModal(packId) {
  const pack = getPackById(packId);
  if (!pack) return;
  const backdrop = document.getElementById("product-modal-backdrop");
  const modal = document.getElementById("product-modal");
  const normalWrap = document.getElementById("product-modal-normal-wrapper");
  const customWrap = document.getElementById("product-modal-custom-wrapper");
  const titleEl = document.getElementById("product-modal-title");
  const priceEl = document.getElementById("product-modal-price");
  const descEl = document.getElementById("product-modal-desc");
  const imgEl = document.getElementById("product-modal-img");
  const featuresEl = document.getElementById("product-modal-features");
  const advantagesWrap = document.getElementById("product-modal-advantages-wrap");
  const advantagesEl = document.getElementById("product-modal-advantages");
  const infoEl = document.getElementById("product-modal-info");
  const badgeEl = document.getElementById("product-modal-badge");
  const addBtn = document.getElementById("product-modal-add-cart");
  const addedMsg = document.getElementById("product-modal-added-msg");
  if (!modal || !titleEl) return;

  if (packId === "custom" && getCustomPackConfig()) {
    initCustomPackModal(pack);
    if (addedMsg) addedMsg.classList.add("hidden");
    backdrop.classList.add("is-open");
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    modal.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
    return;
  }

  if (normalWrap) normalWrap.classList.remove("hidden");
  if (customWrap) {
    customWrap.classList.add("hidden");
    customWrap.setAttribute("aria-hidden", "true");
  }

  titleEl.textContent = pack.title;
  priceEl.textContent = formatPrice(pack.price);
  descEl.textContent = pack.description || "";
  imgEl.src = pack.image;
  imgEl.alt = pack.title;
  featuresEl.innerHTML = (pack.features || []).map((f) => `<li class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-accent"></span> ${f}</li>`).join("");
  if (pack.advantages && pack.advantages.length) {
    advantagesWrap.classList.remove("hidden");
    advantagesEl.innerHTML = pack.advantages.map((a) => `<li class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-accent"></span> ${a}</li>`).join("");
  } else {
    advantagesWrap.classList.add("hidden");
  }
  infoEl.textContent = [pack.platform && `Plataforma ${pack.platform}`, pack.delivery && `Entrega ${pack.delivery}`].filter(Boolean).join(" · ") || "";
  if (pack.badge) {
    badgeEl.textContent = pack.badge;
    badgeEl.classList.remove("hidden");
  } else {
    badgeEl.classList.add("hidden");
  }
  addBtn.dataset.packId = pack.id;
  addedMsg.classList.add("hidden");

  backdrop.classList.add("is-open");
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  modal.setAttribute("aria-hidden", "false");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeProductModal() {
  const backdrop = document.getElementById("product-modal-backdrop");
  const modal = document.getElementById("product-modal");
  if (backdrop) {
    backdrop.classList.remove("is-open");
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "";
}

async function addToCartShopify(variantId, quantity) {
  const base = getShopifyBaseUrl();
  if (!base || !variantId) return { ok: false };
  const url = base + "/cart/add.js";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: String(variantId), quantity: quantity || 1 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.description || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function onAddedToCartFeedback(openMiniCart) {
  updateCartBadge();
  renderCart();
  if (typeof openMiniCart === "function") setTimeout(openMiniCart, 400);
}

async function handleAddToCart(pack, buttonEl, openMiniCart) {
  const addBtn = buttonEl && buttonEl.nodeType ? buttonEl : null;
  const addedMsg = document.getElementById("product-modal-added-msg");

  if (isShopifyEnabled() && pack.variantId) {
    if (addBtn) addBtn.disabled = true;
    const result = await addToCartShopify(pack.variantId, 1);
    if (addBtn) addBtn.disabled = false;
    if (result.ok) {
      if (addedMsg) addedMsg.classList.remove("hidden");
      onAddedToCartFeedback(openMiniCart);
    } else {
      if (result.error) alert(result.error);
      else if (openMiniCart) openMiniCart();
    }
    return;
  }

  if (isShopifyEnabled() && !pack.variantId) {
    alert("Configure variantId for this product in packs-config.js");
    return;
  }

  addToCart(pack.id, pack.title, pack.image, pack.price, 1);
  if (addedMsg) addedMsg.classList.remove("hidden");
  onAddedToCartFeedback(openMiniCart);
}

async function addToCartFromModal(packId) {
  const pack = getPackById(packId);
  if (!pack) return;
  const addBtn = document.getElementById("product-modal-add-cart");
  await handleAddToCart(pack, addBtn, openCart);
  closeProductModal();
}

function buyNowFromModal(packId) {
  const pack = getPackById(packId);
  if (!pack) return;
  saveCheckoutAndRedirect(buildCheckoutPayloadFromPack(pack, pack.price, null));
}

function setupProductModal() {
  const backdrop = document.getElementById("product-modal-backdrop");
  const modal = document.getElementById("product-modal");
  const closeBtn = document.querySelector(".product-modal-close");
  const addBtn = document.getElementById("product-modal-add-cart");
  const buyNowBtn = document.getElementById("product-modal-buy-now");
  if (!modal) return;

  function close() {
    closeProductModal();
  }
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });
  addBtn?.addEventListener("click", () => {
    const customWrap = document.getElementById("product-modal-custom-wrapper");
    if (customWrap && !customWrap.classList.contains("hidden")) {
      addCustomPackToCart(openCart);
      return;
    }
    const packId = addBtn.dataset.packId;
    if (packId) addToCartFromModal(packId);
  });
  buyNowBtn?.addEventListener("click", () => {
    const customWrap = document.getElementById("product-modal-custom-wrapper");
    if (customWrap && !customWrap.classList.contains("hidden")) {
      buyNowCustomPack();
      return;
    }
    const packId = addBtn.dataset.packId;
    if (packId) buyNowFromModal(packId);
  });

  const customAddBtn = document.getElementById("custom-config-add-cart");
  const customBuyBtn = document.getElementById("custom-config-buy-now");
  customAddBtn?.addEventListener("click", () => addCustomPackToCart(openCart));
  customBuyBtn?.addEventListener("click", () => buyNowCustomPack());
}

applyLinks();
setupMobileNav();
animateCounters();
setupAnimatedBackground();
setupCouponModal();
setupPolicyModal();
setupCart();
initPacksGrid();
setupProductModal();

