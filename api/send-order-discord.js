/**
 * Vercel Serverless Function — Phantom Project
 * Endpoint: POST /api/send-order-discord
 *
 * Recibe los datos del pedido desde success.js y envía un mensaje al webhook de Discord.
 * La URL del webhook NUNCA se expone en el frontend; solo se usa aquí vía variable de entorno.
 *
 * En Vercel: Settings → Environment Variables → DISCORD_WEBHOOK_URL = tu URL del webhook
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(404).json({ error: "Not found" });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith("https://")) {
    console.error("DISCORD_WEBHOOK_URL no configurada o inválida");
    return res.status(500).json({ error: "Webhook no configurada" });
  }

  const body = req.body || {};
  const orderId = body.orderId != null ? String(body.orderId) : "—";
  const productName = body.productName != null ? String(body.productName) : "—";
  const quantity = body.quantity != null ? String(body.quantity) : "—";
  const total = body.total != null ? String(body.total) : "—";
  const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod) : "—";

  const content = [
    "**PHANTOM PROJECT - NUEVA COMPRA**",
    "",
    `Order ID: ${orderId}`,
    `Producto: ${productName}`,
    `Cantidad: ${quantity}`,
    `Total: ${total} USD`,
    `Método de pago: ${paymentMethod}`,
    "",
    "Cliente, abre ticket en Discord y envía tus datos usando este ID del pedido."
  ].join("\n");

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Discord webhook error:", response.status, text);
      return res.status(500).json({ error: "Error al enviar a Discord" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Discord webhook error:", err.message);
    return res.status(500).json({ error: err.message || "Error al enviar a Discord" });
  }
}
