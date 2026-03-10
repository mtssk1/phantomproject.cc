/**
 * Envío de email de confirmación al cliente (Resend).
 * Variables: RESEND_API_KEY, EMAIL_FROM_ADDRESS.
 */

export async function sendOrderConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada");
    return { ok: false, error: "Email no configurado" };
  }
  const to = order.customer_email;
  if (!to) return { ok: false, error: "Sin email del cliente" };

  const subject = "Phantom Project - Compra confirmada";
  const body = [
    "<p>Tu compra fue confirmada correctamente.</p>",
    "<p><strong>ID del pedido:</strong> " + (order.order_id || "—") + "</p>",
    "<p><strong>Producto:</strong> " + (order.product_name || "—") + "</p>",
    "<p><strong>Cantidad:</strong> " + (order.quantity ?? "—") + "</p>",
    "<p><strong>Total:</strong> " + (order.total ?? "—") + " USD</p>",
    "<p>Guarda este ID. Si necesitas soporte o enviar datos de tu cuenta, úsalo en Discord.</p>",
  ].join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: body,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Resend error:", res.status, err);
    return { ok: false, error: err.message || res.statusText };
  }
  return { ok: true };
}
