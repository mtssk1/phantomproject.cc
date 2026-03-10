/**
 * POST /api/confirm-payment
 * Marca el pedido como paid y dispara: mensaje interno Discord, ticket automático, email.
 * Evita duplicados con flags en Supabase (discord_notified, discord_ticket_created, email_sent).
 * Body: order_id, payment_method, paypal_order_id?, crypto_invoice_id?
 */

import { ordersTable } from "./lib/supabase.js";
import { sendToInternalChannel, createTicketChannel, formatInternalMessage } from "./lib/discord.js";
import { sendOrderConfirmationEmail } from "./lib/email.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "Not found" });

  let table;
  try {
    table = ordersTable();
  } catch (e) {
    return res.status(503).json({ error: "Servicio no configurado" });
  }

  const b = req.body || {};
  const orderId = b.order_id && String(b.order_id).trim();
  if (!orderId) return res.status(400).json({ error: "Falta order_id" });

  const { data: order, error: fetchErr } = await table.select("*").eq("order_id", orderId).single();
  if (fetchErr || !order) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }
  if (order.payment_status === "paid") {
    return res.status(200).json({ ok: true, already_paid: true });
  }

  const updates = {
    payment_status: "paid",
    paid_at: new Date().toISOString(),
    payment_method: b.payment_method != null ? String(b.payment_method) : order.payment_method,
  };
  if (b.paypal_order_id) updates.paypal_order_id = String(b.paypal_order_id);
  if (b.crypto_invoice_id) updates.crypto_invoice_id = String(b.crypto_invoice_id);

  const { error: updateErr } = await table.update(updates).eq("order_id", orderId);
  if (updateErr) {
    console.error("confirm-payment update:", updateErr);
    return res.status(500).json({ error: "Error al actualizar pedido" });
  }

  const orderPaid = { ...order, ...updates };

  if (!orderPaid.discord_notified) {
    try {
      await sendToInternalChannel(formatInternalMessage(orderPaid));
      await table.update({ discord_notified: true }).eq("order_id", orderId);
    } catch (e) {
      console.error("Discord internal:", e.message);
    }
  }

  if (!orderPaid.discord_ticket_created) {
    try {
      const ticket = await createTicketChannel(orderPaid);
      if (ticket?.channelId) {
        await table.update({
          discord_ticket_created: true,
          discord_ticket_channel_id: ticket.channelId,
        }).eq("order_id", orderId);
      }
    } catch (e) {
      console.error("Discord ticket:", e.message);
    }
  }

  if (!orderPaid.email_sent) {
    try {
      const emailResult = await sendOrderConfirmationEmail(orderPaid);
      if (emailResult.ok) await table.update({ email_sent: true }).eq("order_id", orderId);
    } catch (e) {
      console.error("Email:", e.message);
    }
  }

  return res.status(200).json({ ok: true });
}
